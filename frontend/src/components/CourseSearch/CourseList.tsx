import { useMemo, useState } from 'react'
import type { Course } from '../../api/types'
import './CourseList.css'

type SortKey = 'name' | 'course_code' | 'instructor' | 'term_name' | 'student_count'
type SortDir = 'asc' | 'desc'

interface CourseListProps {
  courses: Course[]
  loading: boolean
  error: string | null
  onCourseClick?: (course: Course) => void
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

export function CourseList({ courses, loading, error, onCourseClick }: CourseListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => sortCourses(courses, sortKey, sortDir), [courses, sortKey, sortDir])

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
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr
              key={c.id}
              className={`course-list__row${onCourseClick ? ' course-list__row--clickable' : ''}`}
              onClick={() => onCourseClick?.(c)}
              title={onCourseClick ? 'Click to add as node' : undefined}
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
