import type { Course } from '../../api/types'
import './CourseList.css'

interface CourseListProps {
  courses: Course[]
  loading: boolean
  error: string | null
  onCourseClick?: (course: Course) => void
}

export function CourseList({ courses, loading, error, onCourseClick }: CourseListProps) {
  if (loading) {
    return <div className="course-list__state">Searching…</div>
  }

  if (error) {
    return <div className="course-list__state course-list__state--error">{error}</div>
  }

  if (courses.length === 0) {
    return <div className="course-list__state">No courses found.</div>
  }

  return (
    <div className="course-list">
      <table className="course-list__table">
        <thead>
          <tr>
            <th>Course</th>
            <th>Code</th>
            <th>Instructor</th>
            <th>Term</th>
            <th>Students</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
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
              <td className="course-list__count">
                {c.student_count ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
