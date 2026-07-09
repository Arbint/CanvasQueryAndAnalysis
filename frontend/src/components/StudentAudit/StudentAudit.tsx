import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import { useAppStore } from '../../store/appStore'
import './StudentAudit.css'

interface AuditRow {
  course_id: number
  name: string
  course_code: string
  instructor: string
  term_name: string
  grade: string | null
}

type SortKey = 'name' | 'course_code' | 'instructor' | 'term_name' | 'grade'
type SortDir = 'asc' | 'desc'

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Name', key: 'name' },
  { label: 'Code', key: 'course_code' },
  { label: 'Instructor', key: 'instructor' },
  { label: 'Term', key: 'term_name' },
  { label: 'Grade', key: 'grade' },
]

function sortRows(rows: AuditRow[], key: SortKey, dir: SortDir): AuditRow[] {
  return [...rows].sort((a, b) => {
    const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
    return dir === 'asc' ? cmp : -cmp
  })
}

export function StudentAudit() {
  const courses = useAppStore((s) => s.courses)

  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AuditRow[]>([])
  const [studentName, setStudentName] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('term_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])

  const handleHeaderClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleAudit = async () => {
    const id = studentId.trim()
    if (!id) { setError('Enter a Student ID'); return }
    if (courses.length === 0) { setError('The course list is empty — search for courses first.'); return }

    setError(null)
    setHasSearched(true)
    setStudentName(null)
    setLoading(true)
    try {
      // A single request — the backend fans out one roster check per course
      // concurrently, so this never runs into the browser's per-origin
      // connection cap the way N separate requests would.
      const matches = await api.getStudentAudit(id, courses.map((c) => c.id))
      const courseById = new Map(courses.map((c) => [c.id, c]))
      const newRows: AuditRow[] = matches.flatMap((m) => {
        const course = courseById.get(m.course_id)
        if (!course) return []
        return [{
          course_id: course.id,
          name: course.name,
          course_code: course.course_code,
          instructor: course.instructor,
          term_name: course.term_name,
          grade: m.grade,
        }]
      })
      setRows(newRows)
      setStudentName(matches.length > 0 ? `${matches[0].first_name} ${matches[0].last_name}`.trim() : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed')
      setRows([])
      setStudentName(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="student-audit">
      <div className="student-audit__controls">
        <div className="student-audit__field">
          <span className="student-audit__label">Student ID</span>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. DEMO00001"
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAudit() }}
          />
        </div>
        <button className="btn btn--primary" onClick={() => void handleAudit()} disabled={loading}>
          {loading ? 'Auditing…' : 'Audit'}
        </button>
      </div>

      {error && <div className="student-audit__error">{error}</div>}
      {studentName && <div className="student-audit__student-name">{studentName}</div>}

      <div className="student-audit__results">
        {loading ? (
          <div className="student-audit__state">Auditing…</div>
        ) : !hasSearched ? (
          <div className="student-audit__state">
            Enter a Student ID and press Audit. Searches the courses currently in the course list.
          </div>
        ) : rows.length === 0 ? (
          <div className="student-audit__state">No courses found for this student in the course list.</div>
        ) : (
          <table className="student-audit__table">
            <thead>
              <tr>
                {COLUMNS.map(({ label, key }) => (
                  <th key={key} onClick={() => handleHeaderClick(key)}>
                    {label}
                    <span className="student-audit__sort-icon">
                      {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.course_id}>
                  <td>{row.name}</td>
                  <td>{row.course_code}</td>
                  <td>{row.instructor}</td>
                  <td>{row.term_name}</td>
                  <td>{row.grade ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
