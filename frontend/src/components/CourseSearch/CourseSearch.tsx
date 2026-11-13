import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Course, Term } from '../../api/types'
import { useAppStore } from '../../store/appStore'
import { sessionTrendAnalyses } from '../../lib/sessionPersistence'
import { AccountDropdown } from './AccountDropdown'
import { ChipInput, type ChipPresets, type Suggestion } from './ChipInput'
import { CourseList } from './CourseList'
import { PresetEditorModal } from './PresetEditorModal'
import {
  loadTermPresets,
  newPresetId,
  resolvePresetTermIds,
  saveTermPresets,
  type TermPreset,
} from '../../lib/termPresets'
import './CourseSearch.css'

export function CourseSearch() {
  const {
    selectedAccountId,
    setSelectedAccountId,
    courses,
    setCourses,
    updateCourseStudentCount,
    setPendingAddCourseId,
    activeWorkTab,
    gradeDisplayCourseId,
    setGradeDisplayCourseId,
    courseSearchSettings,
    setCourseSearchSettings,
    pendingSessionLoad,
    setPendingSessionLoad,
    setPendingGraphSnapshot,
    setPendingTrendAnalyses,
    setLoadStatus,
  } = useAppStore()
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>(courseSearchSettings.selectedTermIds)
  const [keywords, setKeywords] = useState<string[]>(courseSearchSettings.keywords)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const restoringSessionRef = useRef(false)
  const [termPresets, setTermPresets] = useState<TermPreset[]>(loadTermPresets)
  // null: closed; 'new': creating a preset; otherwise the id of the preset being edited.
  const [presetEditor, setPresetEditor] = useState<'new' | string | null>(null)
  const editingPreset = presetEditor && presetEditor !== 'new'
    ? termPresets.find((p) => p.id === presetEditor) ?? null
    : null

  const updateTermPresets = (next: TermPreset[]) => {
    setTermPresets(next)
    saveTermPresets(next)
  }

  // Fetch terms whenever the account changes
  useEffect(() => {
    if (!selectedAccountId) { setTerms([]); return }
    api.getTerms(selectedAccountId)
      .then(setTerms)
      .catch(() => setTerms([]))
    if (!restoringSessionRef.current) setSelectedTermIds([])
  }, [selectedAccountId])

  useEffect(() => {
    setCourseSearchSettings({ selectedTermIds, keywords })
  }, [selectedTermIds, keywords, setCourseSearchSettings])

  const termSuggestions: Suggestion[] = terms.map((t) => ({
    label: t.name,
    value: String(t.id),
  }))

  const availableTerms = useMemo(() => terms.map((t) => ({ id: String(t.id), name: t.name })), [terms])

  const semesterPresets: ChipPresets = {
    items: termPresets.map((preset) => {
      const usable = resolvePresetTermIds(preset, availableTerms).length
      const names = preset.terms.map((t) => t.name).join(', ')
      return {
        id: preset.id,
        name: preset.name,
        detail: usable < preset.terms.length && availableTerms.length > 0
          ? `${names} (${usable}/${preset.terms.length} in this account)`
          : names,
      }
    }),
    onApply: (id) => {
      const preset = termPresets.find((p) => p.id === id)
      if (preset) setSelectedTermIds(resolvePresetTermIds(preset, availableTerms))
    },
    onAddNew: () => setPresetEditor('new'),
    onEdit: (id) => setPresetEditor(id),
    onDelete: (id) => {
      const preset = termPresets.find((p) => p.id === id)
      if (preset && window.confirm(`Delete preset "${preset.name}"?`)) {
        updateTermPresets(termPresets.filter((p) => p.id !== id))
      }
    },
  }

  // Terms of the edited preset that the current account doesn't have; kept
  // selectable in the editor so saving doesn't silently drop them.
  const missingPresetTerms = editingPreset
    ? editingPreset.terms.filter((term) => resolvePresetTermIds({ ...editingPreset, terms: [term] }, availableTerms).length === 0)
    : []

  const editorSuggestions: Suggestion[] = [
    ...termSuggestions,
    ...missingPresetTerms.map((t) => ({ label: `${t.name} (not in this account)`, value: t.id })),
  ]

  const editorInitialValues = editingPreset
    ? [...resolvePresetTermIds(editingPreset, availableTerms), ...missingPresetTerms.map((t) => t.id)]
    : selectedTermIds

  const savePreset = (name: string, termIds: string[]) => {
    const presetTerms = termIds.map((id) => ({
      id,
      name: availableTerms.find((t) => t.id === id)?.name
        ?? missingPresetTerms.find((t) => t.id === id)?.name
        ?? id,
    }))
    if (editingPreset) {
      updateTermPresets(termPresets.map((p) =>
        p.id === editingPreset.id ? { ...p, name, terms: presetTerms } : p,
      ))
    } else {
      updateTermPresets([...termPresets, { id: newPresetId(), name, terms: presetTerms }])
    }
    setPresetEditor(null)
  }

  const handleSearch = async () => {
    if (!selectedAccountId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getCourses({
        account_id: selectedAccountId,
        term_ids: selectedTermIds.map(Number),
        keywords,
      })
      setCourses(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!pendingSessionLoad) return
    const loadSession = async () => {
      const { courseSearch, graph } = pendingSessionLoad
      const trendAnalyses = sessionTrendAnalyses(pendingSessionLoad)
      restoringSessionRef.current = true
      setLoadStatus('Loading search...')
      setError(null)
      setSelectedAccountId(courseSearch.selectedAccountId)
      setSelectedTermIds(courseSearch.selectedTermIds)
      setKeywords(courseSearch.keywords)
      setCourses([])

      if (!courseSearch.selectedAccountId) {
        setPendingGraphSnapshot(graph)
        setPendingTrendAnalyses(trendAnalyses)
        setPendingSessionLoad(null)
        setLoadStatus(null)
        restoringSessionRef.current = false
        return
      }

      setLoading(true)
      try {
        const result = await api.getCourses({
          account_id: courseSearch.selectedAccountId,
          term_ids: courseSearch.selectedTermIds.map(Number),
          keywords: courseSearch.keywords,
        })
        setCourses(result)
        setLoadStatus('Restoring workspace...')
        setPendingGraphSnapshot(graph)
        setPendingTrendAnalyses(trendAnalyses)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Load failed')
        // Still restore the graph and trend tabs (their students load per
        // course), so a failed course search doesn't lose them — and the
        // auto-save doesn't then overwrite them with an empty workspace.
        setPendingGraphSnapshot(graph)
        setPendingTrendAnalyses(trendAnalyses)
        setLoadStatus(null)
      } finally {
        setLoading(false)
        setPendingSessionLoad(null)
        restoringSessionRef.current = false
      }
    }
    void loadSession()
  }, [
    pendingSessionLoad,
    setCourses,
    setLoadStatus,
    setPendingGraphSnapshot,
    setPendingSessionLoad,
    setPendingTrendAnalyses,
    setSelectedAccountId,
  ])

  // Every click selects the course for Course Grade Display; it only adds a graph
  // node when that tab isn't the one being looked at.
  const handleCourseClick = (course: Course) => {
    setGradeDisplayCourseId(course.id)
    if (activeWorkTab !== 'courseGrades') setPendingAddCourseId(course.id)
  }

  const handleQueryCounts = async () => {
    if (courses.length === 0) return
    setCountLoading(true)
    try {
      await Promise.all(
        courses.map(async (course) => {
          const { count } = await api.getStudentCount(course.id)
          updateCourseStudentCount(course.id, count)
        })
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Count query failed')
    } finally {
      setCountLoading(false)
    }
  }

  return (
    <div className="course-search">
      <AccountDropdown />

      <div className="course-search__filters">
        <div className="course-search__filter-row">
          <span className="course-search__filter-label">Semester</span>
          <ChipInput
            values={selectedTermIds}
            onChange={setSelectedTermIds}
            suggestions={termSuggestions}
            placeholder="Search semester…"
            presets={semesterPresets}
          />
        </div>
        <div className="course-search__filter-row">
          <span className="course-search__filter-label">Keyword</span>
          <ChipInput values={keywords} onChange={setKeywords} placeholder="Search keyword…" />
        </div>
        <div className="course-search__actions">
          <button
            className="btn btn--primary"
            onClick={handleSearch}
            disabled={!selectedAccountId || loading}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            className="btn btn--secondary"
            onClick={handleQueryCounts}
            disabled={courses.length === 0 || countLoading}
          >
            {countLoading ? 'Counting…' : 'Query Student Count'}
          </button>
        </div>
      </div>

      {presetEditor && (
        <PresetEditorModal
          key={presetEditor}
          title={editingPreset ? 'Edit semester preset' : 'New semester preset'}
          initialName={editingPreset?.name ?? ''}
          initialValues={editorInitialValues}
          suggestions={editorSuggestions}
          placeholder="Search semester…"
          onSave={savePreset}
          onCancel={() => setPresetEditor(null)}
        />
      )}

      <CourseList
        courses={courses}
        loading={loading}
        error={error}
        onCourseClick={handleCourseClick}
        clickHint={activeWorkTab === 'courseGrades' ? 'Click to display grades' : 'Click to add as node'}
        selectedCourseId={activeWorkTab === 'courseGrades' ? gradeDisplayCourseId : null}
      />
    </div>
  )
}
