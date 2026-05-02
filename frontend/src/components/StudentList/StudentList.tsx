import { useMemo, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { downloadCSV, emailsString } from './exportUtils'
import './StudentList.css'

type Filter = 'all' | 'active' | 'inactive'
type SortKey = 'first_name' | 'last_name' | 'ssid'

export function StudentList() {
  const students = useAppStore((s) => s.activeStudentList)
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('last_name')
  const [copied, setCopied] = useState(false)

  const displayed = useMemo(() => {
    const filtered = filter === 'all'
      ? students
      : students.filter((s) => s.enrollment_state === filter)
    return [...filtered].sort((a, b) => {
      const av = a[sortKey].toLowerCase()
      const bv = b[sortKey].toLowerCase()
      return av < bv ? -1 : av > bv ? 1 : 0
    })
  }, [students, filter, sortKey])

  const handleCopyEmails = async () => {
    await navigator.clipboard.writeText(emailsString(displayed))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="student-list">
      <div className="student-list__toolbar">
        <select
          className="student-list__filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter enrollment state"
        >
          <option value="all">All students</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="student-list__sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="first_name">Sort: First Name</option>
          <option value="last_name">Sort: Last Name</option>
          <option value="ssid">Sort: SSID</option>
        </select>
        <button
          className="btn btn--secondary student-list__action"
          onClick={() => downloadCSV(displayed)}
          disabled={displayed.length === 0}
        >
          ↓ CSV
        </button>
        <button
          className="btn btn--secondary student-list__action"
          onClick={handleCopyEmails}
          disabled={displayed.length === 0}
        >
          {copied ? 'Copied!' : 'Copy Emails'}
        </button>
      </div>

      <div className="student-list__count">
        {displayed.length} student{displayed.length !== 1 ? 's' : ''}
      </div>

      <div className="student-list__scroll">
        {displayed.length === 0 ? (
          <div className="student-list__empty">
            Double-click a node to view students.
          </div>
        ) : (
          <table className="student-list__table">
            <thead>
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>SSID</th>
                <th>Login ID</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((s) => (
                <tr key={s.id}>
                  <td>{s.first_name}</td>
                  <td>{s.last_name}</td>
                  <td>{s.ssid}</td>
                  <td>{s.login_id}</td>
                  <td>{s.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
