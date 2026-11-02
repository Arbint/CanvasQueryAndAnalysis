import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Gradebook, GradebookCell } from '../../api/types'
import { useAppStore } from '../../store/appStore'
import {
  assignmentSortKey,
  cellText,
  downloadGradebookCSV,
  pointsLabel,
  sortStudents,
  type SortDir,
  type SortKey,
} from './courseGradesUtils'
import './CourseGrades.css'

type Filter = 'all' | 'active' | 'inactive'

interface CourseGradesProps {
  /** Only fetch while the tab is visible, so clicking courses elsewhere doesn't hit Canvas. */
  active: boolean
}

function cellClass(cell: GradebookCell | undefined): string | undefined {
  if (!cell) return undefined
  if (cell.excused) return 'course-grades__cell--excused'
  if (cell.missing && cell.score === null) return 'course-grades__cell--missing'
  if (cell.late) return 'course-grades__cell--late'
  return undefined
}

function cellTitle(cell: GradebookCell | undefined): string | undefined {
  if (!cell) return undefined
  const flags = [cell.excused && 'Excused', cell.missing && 'Missing', cell.late && 'Late'].filter(Boolean)
  return flags.length > 0 ? flags.join(', ') : undefined
}

export function CourseGrades({ active }: CourseGradesProps) {
  const courseId = useAppStore((s) => s.gradeDisplayCourseId)
  const courses = useAppStore((s) => s.courses)
  const course = courses.find((c) => c.id === courseId) ?? null

  const cacheRef = useRef<Record<number, Gradebook>>({})
  const [gradebook, setGradebook] = useState<Gradebook | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (!active || courseId === null) return
    const cached = cacheRef.current[courseId]
    if (cached) {
      setGradebook(cached)
      setError(null)
      return
    }
    let cancelled = false
    setGradebook(null)
    setError(null)
    setLoading(true)
    api.getGradebook(courseId)
      .then((data) => {
        cacheRef.current[courseId] = data
        if (!cancelled) setGradebook(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load grades')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [active, courseId, reloadToken])

  const rows = useMemo(() => {
    if (!gradebook) return []
    const filtered = filter === 'all'
      ? gradebook.students
      : gradebook.students.filter((s) => s.enrollment_state === filter)
    return sortStudents(filtered, sortKey, sortDir)
  }, [gradebook, filter, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIcon = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅')

  const handleRefresh = () => {
    if (courseId === null) return
    delete cacheRef.current[courseId]
    setReloadToken((n) => n + 1)
  }

  const handleDownload = () => {
    if (!gradebook) return
    const name = (course?.course_code || course?.name || `course-${courseId}`).replace(/[^\w.-]+/g, '_')
    downloadGradebookCSV(gradebook, rows, `${name}-grades.csv`)
  }

  if (courseId === null) {
    return (
      <div className="course-grades">
        <div className="course-grades__state">Click a course in the course list to display its grades.</div>
      </div>
    )
  }

  return (
    <div className="course-grades">
      <div className="course-grades__toolbar">
        <div className="course-grades__course">
          <span className="course-grades__course-name">{course?.name ?? `Course ${courseId}`}</span>
          {course && (
            <span className="course-grades__course-meta">
              {course.course_code} · {course.term_name}{course.instructor ? ` · ${course.instructor}` : ''}
            </span>
          )}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter enrollment state"
        >
          <option value="all">All students</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn btn--secondary" onClick={handleRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button className="btn btn--secondary" onClick={handleDownload} disabled={!gradebook || rows.length === 0}>
          Download CSV
        </button>
        {gradebook && (
          <span className="course-grades__count">
            {rows.length} student{rows.length !== 1 ? 's' : ''} · {gradebook.assignments.length} assignment
            {gradebook.assignments.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="course-grades__table-wrap">
        {loading ? (
          <div className="course-grades__state">Loading grades…</div>
        ) : error ? (
          <div className="course-grades__state course-grades__state--error">{error}</div>
        ) : !gradebook ? null : rows.length === 0 ? (
          <div className="course-grades__state">No students to show.</div>
        ) : (
          <table className="course-grades__table">
            <thead>
              <tr>
                <th className="course-grades__sticky-col" onClick={() => handleSort('name')}>
                  Name<span className="course-grades__sort-icon">{sortIcon('name')}</span>
                </th>
                <th className="course-grades__sticky-col course-grades__sticky-col--ssid" onClick={() => handleSort('ssid')}>
                  SSID<span className="course-grades__sort-icon">{sortIcon('ssid')}</span>
                </th>
                <th className="course-grades__total" onClick={() => handleSort('total')}>
                  Total<span className="course-grades__sort-icon">{sortIcon('total')}</span>
                </th>
                {gradebook.assignments.map((a) => {
                  const key = assignmentSortKey(a.id)
                  return (
                    <th key={a.id} title={`${a.name} (${a.group_name})`} onClick={() => handleSort(key)}>
                      <div className="course-grades__assignment-header">
                        <span className="course-grades__assignment-name">
                          {a.name}
                          <span className="course-grades__sort-icon">{sortIcon(key)}</span>
                        </span>
                        <span className="course-grades__assignment-meta">
                          {a.group_name} {pointsLabel(a)}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={s.enrollment_state === 'inactive' ? 'course-grades__row--inactive' : undefined}>
                  <td className="course-grades__sticky-col">{s.last_name}, {s.first_name}</td>
                  <td className="course-grades__sticky-col course-grades__sticky-col--ssid">{s.ssid}</td>
                  <td className="course-grades__total">{s.grade ?? '—'}</td>
                  {gradebook.assignments.map((a) => {
                    const cell = s.cells[String(a.id)]
                    return (
                      <td key={a.id} className={cellClass(cell)} title={cellTitle(cell)}>
                        {cellText(cell) || '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
