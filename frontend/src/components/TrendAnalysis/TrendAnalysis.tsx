import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { api } from '../../api/client'
import type { Course, Student } from '../../api/types'
import { union } from '../../lib/setOperations'
import { useAppStore } from '../../store/appStore'
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
  courseId: number | null
  collection: CollectionFilters
  matchedCourseCount: number
  loading: boolean
  error: string | null
  students: Student[]
  width: number
}

interface Comparison {
  retained: Student[]
  lost: Student[]
  added: Student[]
}

type CompareKind = keyof Comparison

const compareLabels: Record<CompareKind, string> = {
  retained: 'Retained',
  lost: 'Lost',
  added: 'New',
}

let trendColumnCounter = 0
const nextColumnId = () => `trend-column-${++trendColumnCounter}`

const makeColumn = (): TrendColumn => ({
  id: nextColumnId(),
  mode: 'course',
  courseId: null,
  collection: { selectedTerms: [], department: '', numberPattern: '' },
  matchedCourseCount: 0,
  loading: false,
  error: null,
  students: [],
  width: 240,
})

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

function studentKey(student: Student) {
  return student.id
}

function compareStudents(previous: Student[] | null, current: Student[]): Comparison {
  if (!previous) return { retained: current, lost: [], added: [] }
  const previousMap = new Map(previous.map((s) => [studentKey(s), s]))
  const currentMap = new Map(current.map((s) => [studentKey(s), s]))
  return {
    retained: current.filter((s) => previousMap.has(studentKey(s))),
    lost: previous.filter((s) => !currentMap.has(studentKey(s))),
    added: current.filter((s) => !previousMap.has(studentKey(s))),
  }
}

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

function axisLabel(column: TrendColumn, course: Course | null): string {
  if (column.mode === 'collection') {
    const { department, numberPattern, selectedTerms } = column.collection
    if (department && numberPattern) return `${department.toUpperCase()} ${numberPattern}`
    if (department) return department.toUpperCase()
    if (selectedTerms.length === 1) return selectedTerms[0]
    if (selectedTerms.length > 1) return `${selectedTerms.length} Terms`
    return 'Collection'
  }
  if (!course) return 'No course'
  return course.name.length > 24 ? `${course.name.slice(0, 21)}...` : course.name
}

function axisTermLabel(column: TrendColumn, course: Course | null): string {
  if (column.mode === 'collection') {
    return `${column.matchedCourseCount} course${column.matchedCourseCount !== 1 ? 's' : ''}`
  }
  return course?.term_name ?? ''
}

// --- Main component ---

export function TrendAnalysis() {
  const courses = useAppStore((s) => s.courses)
  const setActiveStudentList = useAppStore((s) => s.setActiveStudentList)
  const [columns, setColumns] = useState<TrendColumn[]>([makeColumn(), makeColumn()])
  const [zoom, setZoom] = useState(1)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)
  // Per-column fetch cache: columnId → courseId → Student[]
  const collectCacheRef = useRef<Record<string, Record<number, Student[]>>>({})

  const selectedCourses = columns.map((col) => courses.find((c) => c.id === col.courseId) ?? null)
  const comparisons = columns.map((col, i) =>
    compareStudents(i > 0 ? columns[i - 1].students : null, col.students),
  )

  const maxCount = Math.max(1, ...columns.map((col) => col.students.length))
  const graph = useMemo(() => {
    const gap = 8
    const contentWidth = columns.reduce((sum, col) => sum + col.width, 0) + Math.max(0, columns.length - 1) * gap
    const width = Math.max(640, contentWidth + 112)
    const height = 320
    const padX = 56
    const padTop = 24
    const padBottom = 88
    const plotHeight = height - padTop - padBottom
    let offset = padX
    const points = columns.map((col) => {
      const x = offset + col.width / 2
      const y = padTop + plotHeight - (col.students.length / maxCount) * plotHeight
      offset += col.width + gap
      return { x, y, count: col.students.length }
    })
    return { width, height, padX, padTop, padBottom, points }
  }, [columns, maxCount])

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

  const addColumn = () => setColumns((curr) => [...curr, makeColumn()])

  const removeColumn = (columnId: string) => {
    setColumns((curr) => curr.filter((col) => col.id !== columnId))
    setMenu(null)
  }

  const handleDownload = (index: number, kind: CompareKind) => {
    const column = columns[index]
    const course = selectedCourses[index]
    const base =
      column.mode === 'collection'
        ? `Collection-${compareLabels[kind]}`
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

  const activeMenu = menu ? comparisons[menu.index] : null
  const hoveredComparison = hoveredIndex === null ? null : comparisons[hoveredIndex]

  return (
    <div className="trend-analysis" onClick={() => setMenu(null)}>

      <section className="trend-graph" onContextMenu={(e) => e.preventDefault()}>
        <div className="trend-graph__toolbar">
          <button className="trend-icon-button" title="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}>
            -
          </button>
          <button className="trend-icon-button" title="Auto fit" onClick={() => setZoom(1)}>
            Fit
          </button>
          <button className="trend-icon-button" title="Zoom in" onClick={() => setZoom((v) => Math.min(2, v + 0.2))}>
            +
          </button>
        </div>
        <div className="trend-graph__viewport">
          <svg
            className="trend-graph__svg"
            width={graph.width * zoom}
            height={graph.height}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
          >
            <line className="trend-graph__axis" x1={graph.padX} y1={graph.height - graph.padBottom} x2={graph.width - graph.padX} y2={graph.height - graph.padBottom} />
            <line className="trend-graph__axis" x1={graph.padX} y1={graph.padTop} x2={graph.padX} y2={graph.height - graph.padBottom} />
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const y = graph.padTop + (1 - tick) * (graph.height - graph.padTop - graph.padBottom)
              return (
                <g key={tick}>
                  <line className="trend-graph__grid" x1={graph.padX} y1={y} x2={graph.width - graph.padX} y2={y} />
                  <text className="trend-graph__tick" x={graph.padX - 10} y={y + 4} textAnchor="end">
                    {Math.round(maxCount * tick)}
                  </text>
                </g>
              )
            })}
            {graph.points.length > 1 && (
              <polyline
                className="trend-graph__line"
                points={graph.points.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
            {graph.points.map((point, index) => (
              <g key={columns[index].id}>
                <line className="trend-graph__column-line" x1={point.x} y1={graph.padTop} x2={point.x} y2={graph.height - graph.padBottom} />
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
                {axisLabel(columns[hoveredIndex], selectedCourses[hoveredIndex])}
              </div>
              <div>Retained: {hoveredComparison.retained.length}</div>
              <div>Lost: {hoveredComparison.lost.length}</div>
              <div>New: {hoveredComparison.added.length}</div>
            </div>
          )}
        </div>
      </section>

      <section className="trend-courses">
        <div className="trend-courses__strip">
          {columns.map((column, index) => {
            const course = selectedCourses[index]
            return (
              <article
                className={`trend-column${column.mode === 'collection' ? ' trend-column--collection' : ''}`}
                key={column.id}
                style={{ width: column.width, minWidth: column.width }}
                onDoubleClick={() => setActiveStudentList(column.students)}
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
                    <strong>{column.loading ? '...' : column.students.length}</strong>
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
                  {column.students.map((student) => (
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
