import { useMemo, useState } from 'react'
import type { Course } from '../../api/types'
import { containsWildcard } from '../../lib/courseCollectionFilter'
import './CourseList.css'

type SortKey = 'name' | 'course_code' | 'instructor' | 'term_name' | 'student_count'
type SortDir = 'asc' | 'desc'

interface CourseListProps {
  courses: Course[]
  loading: boolean
  error: string | null
  onCourseClick?: (course: Course) => void
  clickHint?: string
  selectedCourseId?: number | null
}

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Course', key: 'name' },
  { label: 'Code', key: 'course_code' },
  { label: 'Instructor', key: 'instructor' },
  { label: 'Term', key: 'term_name' },
  { label: 'Students', key: 'student_count' },
]

function sortCourses(courses: Course[], key: SortKey, dir: SortDir): Course[] {
  return [...courses].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    // Null student counts always sort to the bottom
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
    return dir === 'asc' ? cmp : -cmp
  })
}

export function CourseList({ courses, loading, error, onCourseClick, clickHint = 'Click to add as node', selectedCourseId = null }: CourseListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [columnFilters, setColumnFilters] = useState<Partial<Record<SortKey, string>>>({})

  // Display-only filter: hides rows without changing the searched course list
  const visible = useMemo(() => {
    const active = Object.entries(columnFilters)
      .map(([key, value]) => [key as SortKey, (value ?? '').trim()] as const)
      .filter(([, value]) => value !== '')
    if (active.length === 0) return courses
    return courses.filter((c) =>
      active.every(([key, value]) => containsWildcard(value, String(c[key] ?? ''))),
    )
  }, [courses, columnFilters])

  const sorted = useMemo(() => sortCourses(visible, sortKey, sortDir), [visible, sortKey, sortDir])

  const handleHeaderClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (loading) return <div className="course-list__state">Searching…</div>
  if (error) return <div className="course-list__state course-list__state--error">{error}</div>
  if (courses.length === 0) return <div className="course-list__state">No courses found.</div>

  return (
    <div className="course-list">
      <table className="course-list__table">
        <thead>
          <tr>
            {COLUMNS.map(({ label, key }) => (
              <th
                key={key}
                className={`course-list__th${key === 'student_count' ? ' course-list__th--right' : ''}`}
                onClick={() => handleHeaderClick(key)}
              >
                {label}
                <span className="course-list__sort-icon">
                  {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                </span>
              </th>
            ))}
          </tr>
          <tr className="course-list__filter-row">
            {COLUMNS.map(({ label, key }) => (
              <th key={key}>
                <input
                  className="course-list__filter-input"
                  type="search"
                  placeholder="Filter…"
                  title="Contains this text; * matches any single character (e.g. 3*7*)"
                  aria-label={`Filter by ${label}`}
                  value={columnFilters[key] ?? ''}
                  onChange={(e) => setColumnFilters((f) => ({ ...f, [key]: e.target.value }))}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td className="course-list__no-match" colSpan={COLUMNS.length}>
                No courses match the column filters.
              </td>
            </tr>
          )}
          {sorted.map((c) => (
            <tr
              key={c.id}
              className={`course-list__row${onCourseClick ? ' course-list__row--clickable' : ''}${c.id === selectedCourseId ? ' course-list__row--selected' : ''}`}
              onClick={() => onCourseClick?.(c)}
              title={onCourseClick ? clickHint : undefined}
            >
              <td>{c.name}</td>
              <td>{c.course_code}</td>
              <td>{c.instructor}</td>
              <td>{c.term_name}</td>
              <td className={`course-list__count${c.student_count !== null && c.student_count < 10 ? ' course-list__count--low' : ''}`}>
                {c.student_count ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
