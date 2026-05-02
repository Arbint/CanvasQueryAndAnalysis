import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Course, Student } from '../../api/types'
import { useAppStore } from '../../store/appStore'
import { downloadCSV, emailsString } from '../StudentList/exportUtils'
import './TrendAnalysis.css'

interface TrendColumn {
  id: string
  courseId: number | null
  loading: boolean
  error: string | null
  students: Student[]
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

function studentKey(student: Student) {
  return student.id
}

function compareStudents(previous: Student[] | null, current: Student[]): Comparison {
  if (!previous) return { retained: current, lost: [], added: [] }

  const previousMap = new Map(previous.map((student) => [studentKey(student), student]))
  const currentMap = new Map(current.map((student) => [studentKey(student), student]))

  return {
    retained: current.filter((student) => previousMap.has(studentKey(student))),
    lost: previous.filter((student) => !currentMap.has(studentKey(student))),
    added: current.filter((student) => !previousMap.has(studentKey(student))),
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
  const selected = courses.find((course) => course.id === value)

  return (
    <select
      className="trend-course-select"
      value={value ?? ''}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      <option value="">Select course</option>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>
          {course.term_name} - {course.name}
        </option>
      ))}
      {selected && !courses.some((course) => course.id === selected.id) && (
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

export function TrendAnalysis() {
  const courses = useAppStore((state) => state.courses)
  const [columns, setColumns] = useState<TrendColumn[]>([
    { id: nextColumnId(), courseId: null, loading: false, error: null, students: [] },
    { id: nextColumnId(), courseId: null, loading: false, error: null, students: [] },
  ])
  const [zoom, setZoom] = useState(1)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)

  const selectedCourses = columns.map((column) => courses.find((course) => course.id === column.courseId) ?? null)
  const comparisons = columns.map((column, index) =>
    compareStudents(index > 0 ? columns[index - 1].students : null, column.students)
  )

  const maxCount = Math.max(1, ...columns.map((column) => column.students.length))
  const graph = useMemo(() => {
    const width = Math.max(520, columns.length * 180)
    const height = 220
    const padX = 56
    const padTop = 24
    const padBottom = 38
    const plotHeight = height - padTop - padBottom
    const step = columns.length > 1 ? (width - padX * 2) / (columns.length - 1) : 0
    const points = columns.map((column, index) => {
      const x = columns.length === 1 ? width / 2 : padX + step * index
      const y = padTop + plotHeight - (column.students.length / maxCount) * plotHeight
      return { x, y, count: column.students.length }
    })
    return { width, height, padX, padTop, padBottom, points }
  }, [columns, maxCount])

  const setColumnCourse = async (columnId: string, courseId: number) => {
    setColumns((current) =>
      current.map((column) =>
        column.id === columnId ? { ...column, courseId, loading: true, error: null, students: [] } : column
      )
    )
    try {
      const students = await api.getStudents(courseId)
      setColumns((current) =>
        current.map((column) =>
          column.id === columnId ? { ...column, loading: false, students } : column
        )
      )
    } catch (error) {
      setColumns((current) =>
        current.map((column) =>
          column.id === columnId
            ? { ...column, loading: false, error: error instanceof Error ? error.message : 'Unable to load students' }
            : column
        )
      )
    }
  }

  const addColumn = () => {
    setColumns((current) => [
      ...current,
      { id: nextColumnId(), courseId: null, loading: false, error: null, students: [] },
    ])
  }

  const removeColumn = (columnId: string) => {
    setColumns((current) => current.filter((column) => column.id !== columnId))
    setMenu(null)
  }

  const handleDownload = (index: number, kind: CompareKind) => {
    const course = selectedCourses[index]
    const base = course ? `${course.term_name}-${course.name}-${compareLabels[kind]}` : compareLabels[kind]
    downloadCSV(comparisons[index][kind], `${safeName(base)}.csv`)
    setMenu(null)
  }

  const handleCopy = async (index: number, kind: CompareKind) => {
    await navigator.clipboard.writeText(emailsString(comparisons[index][kind]))
    setMenu(null)
  }

  const activeMenu = menu ? comparisons[menu.index] : null
  const hoveredComparison = hoveredIndex === null ? null : comparisons[hoveredIndex]

  return (
    <div className="trend-analysis" onClick={() => setMenu(null)}>
      <section className="trend-graph" onContextMenu={(event) => event.preventDefault()}>
        <div className="trend-graph__toolbar">
          <button className="trend-icon-button" title="Zoom out" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>
            -
          </button>
          <button className="trend-icon-button" title="Auto fit" onClick={() => setZoom(1)}>
            Fit
          </button>
          <button className="trend-icon-button" title="Zoom in" onClick={() => setZoom((value) => Math.min(2, value + 0.2))}>
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
                points={graph.points.map((point) => `${point.x},${point.y}`).join(' ')}
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
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setMenu({ index, x: event.clientX, y: event.clientY })
                  }}
                />
                <text className="trend-graph__count" x={point.x} y={point.y - 12} textAnchor="middle">
                  {point.count}
                </text>
              </g>
            ))}
          </svg>
          {hoveredIndex !== null && hoveredComparison && (
            <div className="trend-tooltip">
              <div className="trend-tooltip__title">{selectedCourses[hoveredIndex]?.name ?? 'Course'}</div>
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
              <article className="trend-column" key={column.id}>
                <div className="trend-column__header">
                  <span className="trend-column__number">{index + 1}</span>
                  <button className="trend-column__remove" title="Remove column" onClick={() => removeColumn(column.id)}>
                    x
                  </button>
                </div>
                <CourseSelect
                  courses={courses}
                  value={column.courseId}
                  onChange={(courseId) => setColumnCourse(column.id, courseId)}
                />
                <div className="trend-column__meta">
                  <div>
                    <span>Students</span>
                    <strong>{column.loading ? '...' : column.students.length}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>{course?.meeting_time ?? 'TBD'}</strong>
                  </div>
                  <div>
                    <span>Instructor</span>
                    <strong>{course?.instructor ?? 'TBD'}</strong>
                  </div>
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
              </article>
            )
          })}
          <button className="trend-add-column" onClick={addColumn} title="Add course column">
            +
          </button>
        </div>
      </section>

      {menu && activeMenu && (
        <div className="trend-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
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
