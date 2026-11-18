import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { api } from '../../api/client'
import type { Course, Student } from '../../api/types'
import { union } from '../../lib/setOperations'
import { uniqueId } from '../../lib/ids'
import { useAppStore } from '../../store/appStore'
import type { TrendColumnSnapshot, TrendCountFilter } from '../../store/appStore'
import {
  compareStudents,
  countFilterLabels,
  countFilters,
  filterByEnrollment,
  formatTick,
  layoutTrendGraph,
  scaleY,
  summarizeTrend,
  trendSummaryLines,
  type Comparison,
} from '../../lib/trendData'
import { useElementSize } from '../../lib/useElementSize'
import { CurvePopup, type CurveHover } from './CurvePopup'
import { downloadCSV, emailsString } from '../StudentList/exportUtils'
import './TrendAnalysis.css'

// --- Collection filter utilities (same logic as CourseCollectionNode) ---

function parseDepartment(courseCode: string): string {
  return courseCode.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
}

function parseCourseNumber(courseCode: string): string {
  return courseCode.match(/\d{4}/)?.[0] ?? courseCode.match(/\d+/)?.[0] ?? ''
}

function matchesWildcard(pattern: string, value: string): boolean {
  const regexStr = [...pattern]
    .map((c) => (c === '*' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${regexStr}$`).test(value)
}

function courseMatchesFilters(
  course: Course,
  selectedTerms: string[],
  department: string,
  numberPattern: string,
): boolean {
  if (selectedTerms.length > 0 && !selectedTerms.includes(course.term_name)) return false
  if (department && parseDepartment(course.course_code) !== department.trim().toUpperCase()) return false
  if (numberPattern.trim() && !matchesWildcard(numberPattern.trim(), parseCourseNumber(course.course_code))) return false
  return true
}

// --- Types ---

interface CollectionFilters {
  selectedTerms: string[]
  department: string
  numberPattern: string
}

interface TrendColumn {
  id: string
  mode: 'course' | 'collection'
  /** User-defined name; empty means use the automatic label. */
  label: string
  courseId: number | null
  collection: CollectionFilters
  matchedCourseCount: number
  loading: boolean
  error: string | null
  students: Student[]
  width: number
}

type CompareKind = keyof Comparison

const compareLabels: Record<CompareKind, string> = {
  retained: 'Retained',
  lost: 'Lost',
  added: 'New',
}

const nextColumnId = () => uniqueId('trend-column')

const makeColumn = (): TrendColumn => ({
  id: nextColumnId(),
  mode: 'course',
  label: '',
  courseId: null,
  collection: { selectedTerms: [], department: '', numberPattern: '' },
  matchedCourseCount: 0,
  loading: false,
  error: null,
  students: [],
  width: 240,
})

/**
 * Restored columns get fresh ids: saved ids are not trusted to be unique
 * (sessions saved while ids could collide may hold duplicates).
 */
function columnFromSnapshot(snapshot: TrendColumnSnapshot): TrendColumn {
  return {
    id: nextColumnId(),
    mode: snapshot.mode,
    label: snapshot.label ?? '',
    courseId: snapshot.courseId,
    collection: { ...snapshot.collection, selectedTerms: [...snapshot.collection.selectedTerms] },
    matchedCourseCount: snapshot.matchedCourseCount,
    loading: false,
    error: null,
    students: [],
    width: snapshot.width,
  }
}

function columnToSnapshot(column: TrendColumn): TrendColumnSnapshot {
  return {
    id: column.id,
    mode: column.mode,
    label: column.label,
    courseId: column.courseId,
    collection: column.collection,
    matchedCourseCount: column.matchedCourseCount,
    width: column.width,
  }
}

// --- Collection filters UI ---

function CollectionFiltersUI({
  filters,
  onChange,
  onCollect,
  loading,
}: {
  filters: CollectionFilters
  onChange: (updated: CollectionFilters) => void
  onCollect: () => void
  loading: boolean
}) {
  const courses = useAppStore((s) => s.courses)
  const availableTerms = useMemo(() => [...new Set(courses.map((c) => c.term_name))].sort(), [courses])
  const matchedCount = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, filters.selectedTerms, filters.department, filters.numberPattern)).length,
    [courses, filters.selectedTerms, filters.department, filters.numberPattern],
  )

  const toggleTerm = (term: string) =>
    onChange({
      ...filters,
      selectedTerms: filters.selectedTerms.includes(term)
        ? filters.selectedTerms.filter((t) => t !== term)
        : [...filters.selectedTerms, term],
    })

  return (
    <div className="trend-collection-filters">
      <div className="collection-filter">
        <div className="collection-filter__label">Terms</div>
        <div className="collection-terms">
          {availableTerms.length === 0 ? (
            <span className="collection-empty">Search courses first</span>
          ) : (
            availableTerms.map((term) => (
              <button
                key={term}
                className={`collection-term-chip${filters.selectedTerms.includes(term) ? ' collection-term-chip--active' : ''}`}
                onClick={() => toggleTerm(term)}
              >
                {term}
              </button>
            ))
          )}
        </div>
      </div>
      <div className="collection-filter">
        <div className="collection-filter__label">Department</div>
        <input
          placeholder="e.g. ANGD"
          value={filters.department}
          onChange={(e) => onChange({ ...filters, department: e.target.value })}
        />
      </div>
      <div className="collection-filter">
        <div className="collection-filter__label">Course Number</div>
        <input
          placeholder="e.g. 3*** or 3*7*"
          value={filters.numberPattern}
          onChange={(e) => onChange({ ...filters, numberPattern: e.target.value })}
        />
      </div>
      <div className="trend-collect-row">
        <span className="collection-empty">{matchedCount} matched</span>
        <button
          className="trend-collect-btn"
          onClick={onCollect}
          disabled={loading || matchedCount === 0}
        >
          {loading ? 'Loading…' : 'Collect'}
        </button>
      </div>
    </div>
  )
}

// --- Helpers ---

function CourseSelect({
  courses,
  value,
  onChange,
}: {
  courses: Course[]
  value: number | null
  onChange: (courseId: number) => void
}) {
  const selected = courses.find((c) => c.id === value)
  return (
    <select
      className="trend-course-select"
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">Select course</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.term_name} - {c.name}
        </option>
      ))}
      {selected && !courses.some((c) => c.id === selected.id) && (
        <option value={selected.id}>{selected.term_name} - {selected.name}</option>
      )}
    </select>
  )
}

function gradeFor(student: Student, courseId: number | null) {
  if (student.grade) return student.grade
  if (!courseId) return 'IP'
  const grades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C']
  return grades[(student.id + courseId) % grades.length]
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function truncate(value: string, max = 24): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

/** Label generated from the column's course or collection filters. */
function autoLabel(column: TrendColumn, course: Course | null): string {
  if (column.mode === 'collection') {
    const { department, numberPattern, selectedTerms } = column.collection
    if (department && numberPattern) return `${department.toUpperCase()} ${numberPattern}`
    if (department) return department.toUpperCase()
    if (selectedTerms.length === 1) return selectedTerms[0]
    if (selectedTerms.length > 1) return `${selectedTerms.length} Terms`
    return 'Collection'
  }
  if (!course) return 'No course'
  return course.name
}

/** Full column name: the user's custom label if set, otherwise the automatic one. */
function columnName(column: TrendColumn, course: Course | null): string {
  return column.label.trim() || autoLabel(column, course)
}

function axisLabel(column: TrendColumn, course: Course | null): string {
  return truncate(columnName(column, course))
}

function axisTermLabel(column: TrendColumn, course: Course | null): string {
  if (column.mode === 'collection') {
    return `${column.matchedCourseCount} course${column.matchedCourseCount !== 1 ? 's' : ''}`
  }
  return course?.term_name ?? ''
}

// --- Export data (read by the HTML snapshot download) ---

export interface TrendExportStudent extends Student {
  /** Grade as displayed in the column. */
  displayGrade: string
}

export interface TrendExportColumn {
  number: number
  mode: 'course' | 'collection'
  label: string
  axisLabel: string
  axisTerm: string
  term: string
  instructor: string | null
  meetingTime: string | null
  matchedCourseCount: number
  width: number
  /** Every student in the column, unfiltered; the export applies each count filter itself. */
  students: TrendExportStudent[]
}

export interface TrendExportData {
  /** Filter selected in the app; the snapshot opens on it. */
  countFilter: TrendCountFilter
  columns: TrendExportColumn[]
}

interface TrendAnalysisProps {
  /** Columns to restore on mount; null starts a fresh analysis. */
  initialColumns: TrendColumnSnapshot[] | null
  onColumnsChange: (columns: TrendColumnSnapshot[]) => void
  initialCountFilter: TrendCountFilter
  onCountFilterChange: (filter: TrendCountFilter) => void
  /** Called once restoring `initialColumns` has finished loading students. */
  onRestored?: () => void
  registerExporter: (exporter: (() => TrendExportData) | null) => void
}

// --- Main component ---

export function TrendAnalysis({
  initialColumns,
  onColumnsChange,
  initialCountFilter,
  onCountFilterChange,
  onRestored,
  registerExporter,
}: TrendAnalysisProps) {
  const courses = useAppStore((s) => s.courses)
  const setActiveStudentList = useAppStore((s) => s.setActiveStudentList)
  const [columns, setColumns] = useState<TrendColumn[]>(() => {
    if (!initialColumns || initialColumns.length === 0) return [makeColumn(), makeColumn()]
    return initialColumns.map((snapshot) => {
      const column = columnFromSnapshot(snapshot)
      const needsLoad = column.mode === 'collection' || (column.mode === 'course' && column.courseId)
      return needsLoad ? { ...column, loading: true } : column
    })
  })
  const [countFilter, setCountFilter] = useState<TrendCountFilter>(initialCountFilter)
  const [zoom, setZoom] = useState(1)
  // Framed: the graph fits its viewport and the axis fits the counts (Frame button / F key).
  const [framed, setFramed] = useState(false)
  const [hoveredCurve, setHoveredCurve] = useState<CurveHover | null>(null)
  const graphViewportRef = useRef<HTMLDivElement>(null)
  const graphViewportSize = useElementSize(graphViewportRef)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  // Per-column fetch cache: columnId → courseId → Student[]
  const collectCacheRef = useRef<Record<string, Record<number, Student[]>>>({})
  // Column strip navigation
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollToEndRef = useRef(false)
  const [stripScroll, setStripScroll] = useState({ position: 0, max: 0 })

  const updateStripScroll = () => {
    const strip = stripRef.current
    if (!strip) return
    const max = Math.max(0, strip.scrollWidth - strip.clientWidth)
    const position = Math.min(max, strip.scrollLeft)
    setStripScroll((prev) => (prev.position === position && prev.max === max ? prev : { position, max }))
  }

  useEffect(() => {
    if (scrollToEndRef.current && stripRef.current) {
      scrollToEndRef.current = false
      stripRef.current.scrollTo({ left: stripRef.current.scrollWidth, behavior: 'smooth' })
    }
    updateStripScroll()
  }, [columns])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const observer = new ResizeObserver(() => updateStripScroll())
    observer.observe(strip)
    return () => observer.disconnect()
  }, [])

  const scrollStripTo = (position: number) => {
    if (stripRef.current) stripRef.current.scrollLeft = position
  }

  const callbacksRef = useRef({ onColumnsChange, onCountFilterChange, onRestored })
  callbacksRef.current = { onColumnsChange, onCountFilterChange, onRestored }

  useEffect(() => {
    callbacksRef.current.onColumnsChange(columns.map(columnToSnapshot))
  }, [columns])

  useEffect(() => {
    callbacksRef.current.onCountFilterChange(countFilter)
  }, [countFilter])

  // Restore saved columns once, on mount (ref guard survives StrictMode re-runs).
  const restoreStartedRef = useRef(false)
  useEffect(() => {
    if (restoreStartedRef.current) return
    restoreStartedRef.current = true
    if (!initialColumns) return
    const restoreTrend = async () => {
      // The columns created on mount from initialColumns, keeping their ids.
      const restored = columns.map((column) => ({ ...column, loading: false }))
      const loaded = await Promise.all(restored.map(async (column) => {
        if (column.mode === 'course' && column.courseId) {
          try {
            return { ...column, students: await api.getStudents(column.courseId), loading: false }
          } catch (error) {
            return { ...column, loading: false, error: error instanceof Error ? error.message : 'Unable to load students' }
          }
        }

        if (column.mode === 'collection') {
          const { selectedTerms, department, numberPattern } = column.collection
          const matched = courses.filter((c) => courseMatchesFilters(c, selectedTerms, department, numberPattern))
          if (matched.length === 0) return { ...column, matchedCourseCount: 0, loading: false }
          try {
            const lists = await Promise.all(matched.map((course) => api.getStudents(course.id)))
            return {
              ...column,
              matchedCourseCount: matched.length,
              students: union(...lists),
              loading: false,
            }
          } catch (error) {
            return { ...column, matchedCourseCount: matched.length, loading: false, error: error instanceof Error ? error.message : 'Failed to load students' }
          }
        }

        return column
      }))
      if (loaded.length > 0) setColumns(loaded)
      callbacksRef.current.onRestored?.()
    }
    void restoreTrend()
  }, [])

  const selectedCourses = columns.map((col) => courses.find((c) => c.id === col.courseId) ?? null)
  // Students counted under the current enrollment filter, per column.
  const visibleStudents = useMemo(
    () => columns.map((col) => filterByEnrollment(col.students, countFilter)),
    [columns, countFilter],
  )
  const comparisons = visibleStudents.map((students, i) =>
    compareStudents(i > 0 ? visibleStudents[i - 1] : null, students),
  )

  const frame = framed && graphViewportSize.width > 0 && graphViewportSize.height > 0 ? graphViewportSize : undefined
  const graph = useMemo(
    () => layoutTrendGraph(columns.map((col) => col.width), visibleStudents.map((students) => students.length), frame),
    [columns, visibleStudents, frame],
  )
  const plotHeight = graph.height - graph.padTop - graph.padBottom
  const zoomBy = (delta: number) => {
    setFramed(false)
    setZoom((v) => Math.min(2, Math.max(0.6, v + delta)))
  }
  const resetView = () => {
    setFramed(false)
    setZoom(1)
  }

  const setColumnCourse = async (columnId: string, courseId: number) => {
    setColumns((curr) =>
      curr.map((col) =>
        col.id === columnId ? { ...col, courseId, loading: true, error: null, students: [] } : col,
      ),
    )
    try {
      const students = await api.getStudents(courseId)
      setColumns((curr) =>
        curr.map((col) => col.id === columnId ? { ...col, loading: false, students } : col),
      )
    } catch (err) {
      setColumns((curr) =>
        curr.map((col) =>
          col.id === columnId
            ? { ...col, loading: false, error: err instanceof Error ? err.message : 'Unable to load students' }
            : col,
        ),
      )
    }
  }

  const setColumnMode = (columnId: string, mode: 'course' | 'collection') => {
    setColumns((curr) =>
      curr.map((col) =>
        col.id === columnId
          ? { ...col, mode, courseId: null, students: [], loading: false, error: null, matchedCourseCount: 0 }
          : col,
      ),
    )
  }

  const setColumnLabel = (columnId: string, label: string) => {
    setColumns((curr) => curr.map((col) => col.id === columnId ? { ...col, label } : col))
  }

  const setCollectionFilters = (columnId: string, collection: CollectionFilters) => {
    setColumns((curr) => curr.map((col) => col.id === columnId ? { ...col, collection } : col))
  }

  const handleCollect = async (columnId: string) => {
    const column = columns.find((col) => col.id === columnId)
    if (!column || column.mode !== 'collection') return
    const { selectedTerms, department, numberPattern } = column.collection
    const matched = courses.filter((c) => courseMatchesFilters(c, selectedTerms, department, numberPattern))
    if (matched.length === 0) return

    if (!collectCacheRef.current[columnId]) collectCacheRef.current[columnId] = {}
    const cache = collectCacheRef.current[columnId]
    const missing = matched.filter((c) => !(c.id in cache))

    setColumns((curr) =>
      curr.map((col) =>
        col.id === columnId ? { ...col, loading: true, error: null, matchedCourseCount: matched.length } : col,
      ),
    )
    try {
      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map((c) => api.getStudents(c.id).then((s) => ({ id: c.id, students: s }))),
        )
        for (const r of results) cache[r.id] = r.students
      }
      const students = union(...matched.map((c) => cache[c.id] ?? []))
      setColumns((curr) =>
        curr.map((col) =>
          col.id === columnId
            ? { ...col, students, matchedCourseCount: matched.length, loading: false }
            : col,
        ),
      )
    } catch (err) {
      setColumns((curr) =>
        curr.map((col) =>
          col.id === columnId
            ? { ...col, loading: false, error: err instanceof Error ? err.message : 'Failed to load students' }
            : col,
        ),
      )
    }
  }

  const addColumn = () => {
    scrollToEndRef.current = true
    setColumns((curr) => [...curr, makeColumn()])
  }

  const removeColumn = (columnId: string) => {
    setColumns((curr) => curr.filter((col) => col.id !== columnId))
    setMenu(null)
  }

  const handleDownload = (index: number, kind: CompareKind) => {
    const column = columns[index]
    const course = selectedCourses[index]
    const customLabel = column.label.trim()
    const base = customLabel
      ? `${customLabel}-${compareLabels[kind]}`
      : column.mode === 'collection'
        ? `${autoLabel(column, course)}-${compareLabels[kind]}`
        : course
          ? `${course.term_name}-${course.name}-${compareLabels[kind]}`
          : compareLabels[kind]
    downloadCSV(comparisons[index][kind], `${safeName(base)}.csv`)
    setMenu(null)
  }

  const handleCopy = async (index: number, kind: CompareKind) => {
    await navigator.clipboard.writeText(emailsString(comparisons[index][kind]))
    setMenu(null)
  }

  const startResize = (e: ReactPointerEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = columns.find((col) => col.id === columnId)?.width ?? 240
    const handleMove = (ev: PointerEvent) => {
      const width = Math.min(420, Math.max(180, startWidth + ev.clientX - startX))
      setColumns((curr) => curr.map((col) => col.id === columnId ? { ...col, width } : col))
    }
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  // Latest render data for the HTML snapshot export.
  const exportDataRef = useRef<() => TrendExportData>(() => ({ countFilter: 'all', columns: [] }))
  exportDataRef.current = () => ({
    countFilter,
    columns: columns.map((column, index) => {
      const course = selectedCourses[index]
      return {
        number: index + 1,
        mode: column.mode,
        label: columnName(column, course),
        axisLabel: axisLabel(column, course),
        axisTerm: axisTermLabel(column, course),
        term: axisTermLabel(column, course),
        instructor: column.mode === 'course' ? course?.instructor ?? null : null,
        meetingTime: column.mode === 'course' ? course?.meeting_time ?? null : null,
        matchedCourseCount: column.matchedCourseCount,
        width: column.width,
        students: column.students.map((student) => ({
          ...student,
          displayGrade: gradeFor(student, column.courseId),
        })),
      }
    }),
  })

  useEffect(() => {
    registerExporter(() => exportDataRef.current())
    return () => registerExporter(null)
  }, [registerExporter])

  const activeMenu = menu ? comparisons[menu.index] : null
  const hoveredComparison = hoveredIndex === null ? null : comparisons[hoveredIndex]
  const curveSummary = hoveredCurve ? summarizeTrend(graph.points.map((p) => p.count)) : null
  const curvePoints = graph.points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="trend-analysis" onClick={() => setMenu(null)}>

      <section className="trend-graph" onContextMenu={(e) => e.preventDefault()}>
        <div className="trend-graph__toolbar">
          <button className="trend-icon-button" title="Zoom out" onClick={() => zoomBy(-0.2)}>
            -
          </button>
          <button className="trend-icon-button" title="Zoom in" onClick={() => zoomBy(0.2)}>
            +
          </button>
          <button
            className={`trend-icon-button trend-frame-button${framed ? ' trend-frame-button--on' : ''}`}
            title="Frame: fit the curve to the graph, horizontally and vertically (F)"
            aria-pressed={framed}
            onClick={() => setFramed(true)}
          >
            Frame
          </button>
          <button className="trend-icon-button" title="Reset to the default view (points over their columns)" onClick={resetView}>
            Reset
          </button>
          <label className="trend-count-filter" title="Which students are counted in each column">
            <span>Count</span>
            <select
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value as TrendCountFilter)}
            >
              {countFilters.map((key) => (
                <option key={key} value={key}>{countFilterLabels[key]}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          ref={graphViewportRef}
          className={`trend-graph__viewport${frame ? ' trend-graph__viewport--framed' : ''}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'f' || e.key === 'F') setFramed(true)
          }}
        >
          <svg
            className="trend-graph__svg"
            width={frame ? graph.width : graph.width * zoom}
            height={graph.height}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
          >
            <line className="trend-graph__axis" x1={graph.padX} y1={graph.height - graph.padBottom} x2={graph.width - graph.padX} y2={graph.height - graph.padBottom} />
            <line className="trend-graph__axis" x1={graph.padX} y1={graph.padTop} x2={graph.padX} y2={graph.height - graph.padBottom} />
            {graph.scale.ticks.map((tick) => {
              const y = scaleY(graph.scale, tick, graph.padTop, plotHeight)
              return (
                <g key={tick}>
                  <line className="trend-graph__grid" x1={graph.padX} y1={y} x2={graph.width - graph.padX} y2={y} />
                  <text className="trend-graph__tick" x={graph.padX - 10} y={y + 4} textAnchor="end">
                    {formatTick(tick)}
                  </text>
                </g>
              )
            })}
            {graph.points.map((point, index) => (
              <line
                key={columns[index].id}
                className="trend-graph__column-line"
                x1={point.x}
                y1={graph.padTop}
                x2={point.x}
                y2={graph.height - graph.padBottom}
              />
            ))}
            {graph.points.length > 1 && (
              <g className={`trend-curve${hoveredCurve ? ' trend-curve--highlight' : ''}`}>
                <polyline className="trend-graph__line" points={curvePoints} />
                <polyline
                  className="trend-curve__hit"
                  points={curvePoints}
                  onMouseMove={(e) => setHoveredCurve({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredCurve(null)}
                />
              </g>
            )}
            {graph.points.map((point, index) => (
              <g key={columns[index].id}>
                <circle
                  className="trend-graph__dot"
                  cx={point.x}
                  cy={point.y}
                  r={6}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setMenu({ index, x: e.clientX, y: e.clientY })
                  }}
                />
                <text className="trend-graph__count" x={point.x} y={point.y - 12} textAnchor="middle">
                  {point.count}
                </text>
                <text className="trend-graph__x-label" x={point.x} y={graph.height - 54} textAnchor="middle">
                  <title>{columnName(columns[index], selectedCourses[index])}</title>
                  {axisLabel(columns[index], selectedCourses[index])}
                </text>
                <text className="trend-graph__x-term" x={point.x} y={graph.height - 36} textAnchor="middle">
                  {axisTermLabel(columns[index], selectedCourses[index])}
                </text>
              </g>
            ))}
          </svg>
          {hoveredIndex !== null && hoveredComparison && (
            <div className="trend-tooltip">
              <div className="trend-tooltip__title">
                {columnName(columns[hoveredIndex], selectedCourses[hoveredIndex])}
              </div>
              <div>Retained: {hoveredComparison.retained.length}</div>
              <div>Lost: {hoveredComparison.lost.length}</div>
              <div>New: {hoveredComparison.added.length}</div>
            </div>
          )}
          {hoveredCurve && hoveredIndex === null && curveSummary && (
            <CurvePopup
              at={hoveredCurve}
              title="Trend"
              lines={trendSummaryLines(
                curveSummary,
                (i) => `column ${i + 1} (${axisLabel(columns[i], selectedCourses[i])})`,
              )}
            />
          )}
        </div>
      </section>

      <section className="trend-courses">
        <div className="trend-nav">
          <input
            type="range"
            className="trend-nav__slider"
            aria-label="Scroll columns"
            min={0}
            max={stripScroll.max}
            step={1}
            value={stripScroll.position}
            disabled={stripScroll.max === 0}
            onChange={(e) => scrollStripTo(Number(e.target.value))}
          />
        </div>
        <div className="trend-courses__strip" ref={stripRef} onScroll={updateStripScroll}>
          {columns.map((column, index) => {
            const course = selectedCourses[index]
            return (
              <article
                className={`trend-column${column.mode === 'collection' ? ' trend-column--collection' : ''}`}
                key={column.id}
                style={{ width: column.width, minWidth: column.width }}
                onDoubleClick={() => setActiveStudentList(visibleStudents[index])}
              >
                <div className="trend-column__header">
                  <span className="trend-column__number">{index + 1}</span>
                  <div className="trend-column__mode-tabs">
                    <button
                      className={`trend-column__tab${column.mode === 'course' ? ' trend-column__tab--active' : ''}`}
                      onClick={() => setColumnMode(column.id, 'course')}
                    >
                      Course
                    </button>
                    <button
                      className={`trend-column__tab${column.mode === 'collection' ? ' trend-column__tab--active' : ''}`}
                      onClick={() => setColumnMode(column.id, 'collection')}
                    >
                      Collection
                    </button>
                  </div>
                  <button className="trend-column__remove" title="Remove column" onClick={() => removeColumn(column.id)}>
                    x
                  </button>
                </div>

                <input
                  className="trend-column__label-input"
                  aria-label="Column label"
                  title="Custom label shown on the graph (leave empty for the automatic label)"
                  placeholder={`Label: ${autoLabel(column, course)}`}
                  value={column.label}
                  onChange={(e) => setColumnLabel(column.id, e.target.value)}
                  onDoubleClick={(e) => e.stopPropagation()}
                />

                {column.mode === 'course' ? (
                  <CourseSelect
                    courses={courses}
                    value={column.courseId}
                    onChange={(courseId) => setColumnCourse(column.id, courseId)}
                  />
                ) : (
                  <CollectionFiltersUI
                    filters={column.collection}
                    onChange={(updated) => setCollectionFilters(column.id, updated)}
                    onCollect={() => void handleCollect(column.id)}
                    loading={column.loading}
                  />
                )}

                <div className="trend-column__meta">
                  <div>
                    <span>Students</span>
                    <strong>{column.loading ? '...' : visibleStudents[index].length}</strong>
                  </div>
                  {column.mode === 'collection' ? (
                    <div>
                      <span>Courses</span>
                      <strong>{column.matchedCourseCount}</strong>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span>Time</span>
                        <strong>{course?.meeting_time ?? 'TBD'}</strong>
                      </div>
                      <div>
                        <span>Instructor</span>
                        <strong>{course?.instructor ?? 'TBD'}</strong>
                      </div>
                    </>
                  )}
                </div>

                {column.error && <div className="trend-column__error">{column.error}</div>}

                <ul className="trend-student-list">
                  {visibleStudents[index].map((student) => (
                    <li key={student.id} className="trend-student">
                      <span className="trend-student__name">{student.first_name} {student.last_name}</span>
                      <span className="trend-student__grade">{gradeFor(student, column.courseId)}</span>
                    </li>
                  ))}
                </ul>

                <div
                  className="trend-column__resize"
                  role="separator"
                  aria-orientation="vertical"
                  title="Resize column"
                  onPointerDown={(e) => startResize(e, column.id)}
                />
              </article>
            )
          })}
          <button className="trend-add-column" onClick={addColumn} title="Add column">
            +
          </button>
        </div>
      </section>

      {menu && activeMenu && (
        <div
          className="trend-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(['retained', 'lost', 'added'] as CompareKind[]).map((kind) => (
            <div className="trend-context-menu__group" key={kind}>
              <div className="trend-context-menu__label">{compareLabels[kind]} ({activeMenu[kind].length})</div>
              <button onClick={() => handleDownload(menu.index, kind)}>Download CSV</button>
              <button onClick={() => void handleCopy(menu.index, kind)}>Copy emails</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
