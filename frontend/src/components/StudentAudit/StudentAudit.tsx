import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Course } from '../../api/types'
import { useAppStore } from '../../store/appStore'
import { SearchableSelect } from './SearchableSelect'
import './StudentAudit.css'

interface AuditRow {
  course_id: number
  name: string
  course_code: string
  instructor: string
  term_name: string
  grade: string | null
}

interface SemesterAudit {
  id: string
  termName: string
  rows: AuditRow[]
  hasAudited: boolean
  loading: boolean
  error: string | null
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

let semesterCounter = 0
const nextSemesterId = () => `semester-${++semesterCounter}`

function makeSemesterAudit(): SemesterAudit {
  return {
    id: nextSemesterId(),
    termName: '',
    rows: [],
    hasAudited: false,
    loading: false,
    error: null,
  }
}

function sortRows(rows: AuditRow[], key: SortKey, dir: SortDir): AuditRow[] {
  return [...rows].sort((a, b) => {
    const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
    return dir === 'asc' ? cmp : -cmp
  })
}

// Credit hours are embedded in the course code, e.g. "ANGD-2330 Section 01 FA26"
// is 3 hours, "ANGD-4100 Section 01 FA26" is 1 hour — the second digit of the
// course number right after the first "-" is the credit hour count.
export function parseCreditHours(courseCode: string): number {
  const dashIndex = courseCode.indexOf('-')
  if (dashIndex === -1) return 0
  const digits = courseCode.slice(dashIndex + 1).match(/^\d+/)?.[0] ?? ''
  if (digits.length < 2) return 0
  return Number(digits[1])
}

async function auditSemester(studentId: string, semesterCourses: Course[]): Promise<{
  rows: AuditRow[]
  studentName: string | null
}> {
  const matches = await api.getStudentAudit(studentId, semesterCourses.map((c) => c.id))
  const courseById = new Map(semesterCourses.map((c) => [c.id, c]))
  const rows: AuditRow[] = matches.flatMap((m) => {
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
  const studentName = matches.length > 0 ? `${matches[0].first_name} ${matches[0].last_name}`.trim() : null
  return { rows, studentName }
}

function SemesterCard({
  semester,
  availableTerms,
  onTermChange,
  onAudit,
  onRemove,
  removable,
}: {
  semester: SemesterAudit
  availableTerms: string[]
  onTermChange: (termName: string) => void
  onAudit: () => void
  onRemove: () => void
  removable: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('term_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => sortRows(semester.rows, sortKey, sortDir), [semester.rows, sortKey, sortDir])

  const handleHeaderClick = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const termOptions = useMemo(() => availableTerms.map((t) => ({ value: t, label: t })), [availableTerms])

  return (
    <div className="student-audit__semester-card">
      <div className="student-audit__semester-header">
        <SearchableSelect
          value={semester.termName}
          onChange={onTermChange}
          options={termOptions}
          placeholder="Search semester…"
        />
        <button className="btn btn--primary" onClick={onAudit} disabled={semester.loading}>
          {semester.loading ? 'Auditing…' : 'Audit'}
        </button>
        {removable && (
          <button
            className="student-audit__semester-remove"
            onClick={onRemove}
            title="Remove semester"
            aria-label="Remove semester"
          >
            ×
          </button>
        )}
      </div>

      {semester.error && <div className="student-audit__error">{semester.error}</div>}

      <div className="student-audit__semester-results">
        {semester.loading ? (
          <div className="student-audit__state">Auditing…</div>
        ) : !semester.hasAudited ? (
          <div className="student-audit__state">Press Audit to check this semester.</div>
        ) : sorted.length === 0 ? (
          <div className="student-audit__state">No courses found for this semester.</div>
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

export function StudentAudit() {
  const courses = useAppStore((s) => s.courses)

  const [studentId, setStudentId] = useState('')
  const [studentName, setStudentName] = useState<string | null>(null)
  const [baseError, setBaseError] = useState<string | null>(null)
  const [semesters, setSemesters] = useState<SemesterAudit[]>([makeSemesterAudit()])

  const availableTerms = useMemo(() => [...new Set(courses.map((c) => c.term_name))].sort(), [courses])

  const allRows = useMemo(() => semesters.flatMap((s) => s.rows), [semesters])

  const totalHours = useMemo(
    () => allRows.reduce((sum, row) => sum + parseCreditHours(row.course_code), 0),
    [allRows],
  )

  const hoursPerSemester = useMemo(() => {
    const byTerm = new Map<string, number>()
    for (const row of allRows) {
      byTerm.set(row.term_name, (byTerm.get(row.term_name) ?? 0) + parseCreditHours(row.course_code))
    }
    return [...byTerm.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [allRows])

  const anyLoading = semesters.some((s) => s.loading)

  const runAudit = async (semesterId: string) => {
    const id = studentId.trim()
    if (!id) { setBaseError('Enter a Student ID'); return }

    const semester = semesters.find((s) => s.id === semesterId)
    if (!semester) return

    if (!semester.termName) {
      setSemesters((curr) => curr.map((s) => (s.id === semesterId ? { ...s, error: 'Select a semester' } : s)))
      return
    }

    const semesterCourses = courses.filter((c) => c.term_name === semester.termName)
    if (semesterCourses.length === 0) {
      setSemesters((curr) =>
        curr.map((s) =>
          s.id === semesterId
            ? { ...s, rows: [], hasAudited: true, error: 'No courses for this semester in the course list' }
            : s,
        ),
      )
      return
    }

    setBaseError(null)
    setSemesters((curr) => curr.map((s) => (s.id === semesterId ? { ...s, loading: true, error: null } : s)))

    try {
      const { rows, studentName: matchedName } = await auditSemester(id, semesterCourses)
      setSemesters((curr) =>
        curr.map((s) => (s.id === semesterId ? { ...s, rows, hasAudited: true, loading: false } : s)),
      )
      if (matchedName) setStudentName(matchedName)
    } catch (e) {
      setSemesters((curr) =>
        curr.map((s) =>
          s.id === semesterId
            ? { ...s, loading: false, error: e instanceof Error ? e.message : 'Audit failed' }
            : s,
        ),
      )
    }
  }

  const runAuditAll = async () => {
    const id = studentId.trim()
    if (!id) { setBaseError('Enter a Student ID'); return }
    const configured = semesters.filter((s) => s.termName)
    if (configured.length === 0) { setBaseError('Configure at least one semester first'); return }
    await Promise.all(configured.map((s) => runAudit(s.id)))
  }

  const addSemester = () => setSemesters((curr) => [...curr, makeSemesterAudit()])

  const removeSemester = (semesterId: string) =>
    setSemesters((curr) => curr.filter((s) => s.id !== semesterId))

  const setSemesterTerm = (semesterId: string, termName: string) =>
    setSemesters((curr) =>
      curr.map((s) => (s.id === semesterId ? { ...s, termName, rows: [], hasAudited: false, error: null } : s)),
    )

  return (
    <div className="student-audit">
      <div className="student-audit__base">
        <div className="student-audit__field">
          <span className="student-audit__label">Student ID</span>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. DEMO00001"
          />
        </div>
        {studentName && <div className="student-audit__student-name">{studentName}</div>}
      </div>
      {baseError && <div className="student-audit__error">{baseError}</div>}

      <div className="student-audit__summary">
        <div className="student-audit__summary-total">
          <span className="student-audit__label">Total Hours</span>
          <strong>{totalHours}</strong>
        </div>
        <table className="student-audit__hours-table">
          <thead>
            <tr>
              <th>Semester</th>
              <th>Credit Hours</th>
            </tr>
          </thead>
          <tbody>
            {hoursPerSemester.length === 0 ? (
              <tr>
                <td colSpan={2} className="student-audit__state">No audited courses yet.</td>
              </tr>
            ) : (
              hoursPerSemester.map(([term, hours]) => (
                <tr key={term}>
                  <td>{term}</td>
                  <td>{hours}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="student-audit__semesters">
        <div className="student-audit__semesters-header">
          <span className="student-audit__section-title">Semesters</span>
          <button className="btn btn--secondary" onClick={() => void runAuditAll()} disabled={anyLoading}>
            Audit All
          </button>
        </div>
        <div className="student-audit__semester-list">
          {semesters.map((semester) => (
            <SemesterCard
              key={semester.id}
              semester={semester}
              availableTerms={availableTerms}
              onTermChange={(termName) => setSemesterTerm(semester.id, termName)}
              onAudit={() => void runAudit(semester.id)}
              onRemove={() => removeSemester(semester.id)}
              removable={semesters.length > 1}
            />
          ))}
          <button className="student-audit__add-semester" onClick={addSemester} title="Add semester">
            +
          </button>
        </div>
      </div>
    </div>
  )
}
