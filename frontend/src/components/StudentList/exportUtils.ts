import type { Student } from '../../api/types'

const CSV_HEADERS = ['First Name', 'Last Name', 'SSID', 'Login ID', 'Email']

export function toCSV(students: Student[]): string {
  const rows = students.map((s) =>
    [s.first_name, s.last_name, s.ssid, s.login_id, s.email]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(',')
  )
  return [CSV_HEADERS.join(','), ...rows].join('\n')
}

export function emailsString(students: Student[]): string {
  return students.map((s) => s.email).join(',')
}

export function downloadCSV(students: Student[], filename = 'students.csv'): void {
  const blob = new Blob([toCSV(students)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
