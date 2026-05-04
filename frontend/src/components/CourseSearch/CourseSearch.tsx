import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Term } from '../../api/types'
import { useAppStore } from '../../store/appStore'
import { AccountDropdown } from './AccountDropdown'
import { ChipInput, type Suggestion } from './ChipInput'
import { CourseList } from './CourseList'
import './CourseSearch.css'

export function CourseSearch() {
  const {
    selectedAccountId,
    setSelectedAccountId,
    courses,
    setCourses,
    updateCourseStudentCount,
    setPendingAddCourseId,
    courseSearchSettings,
    setCourseSearchSettings,
    pendingSessionLoad,
    setPendingSessionLoad,
    setPendingGraphSnapshot,
    setPendingTrendColumns,
    setLoadStatus,
  } = useAppStore()
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedTermIds, setSelectedTermIds] = useState<string[]>(courseSearchSettings.selectedTermIds)
  const [keywords, setKeywords] = useState<string[]>(courseSearchSettings.keywords)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const restoringSessionRef = useRef(false)

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
      const { courseSearch, graph, trend } = pendingSessionLoad
      restoringSessionRef.current = true
      setLoadStatus('Loading search...')
      setError(null)
      setSelectedAccountId(courseSearch.selectedAccountId)
      setSelectedTermIds(courseSearch.selectedTermIds)
      setKeywords(courseSearch.keywords)
      setCourses([])

      if (!courseSearch.selectedAccountId) {
        setPendingGraphSnapshot(graph)
        setPendingTrendColumns(trend.columns)
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
        setPendingTrendColumns(trend.columns)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Load failed')
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
    setPendingTrendColumns,
    setSelectedAccountId,
  ])

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

      <CourseList courses={courses} loading={loading} error={error} onCourseClick={(c) => setPendingAddCourseId(c.id)} />
    </div>
  )
}
