import type { Gradebook, GradebookAssignment, GradebookCell, GradebookStudent } from '../../api/types'

export type SortKey = 'name' | 'ssid' | 'total' | `a:${number}`
export type SortDir = 'asc' | 'desc'

export function assignmentSortKey(assignmentId: number): SortKey {
  return `a:${assignmentId}`
}

export function cellText(cell: GradebookCell | undefined): string {
  if (!cell) return ''
  if (cell.excused) return 'EX'
  if (cell.grade !== null && cell.grade !== '') return cell.grade
  if (cell.score !== null) return `${cell.score}`
  if (cell.missing) return 'Missing'
  return ''
}

export function pointsLabel(assignment: GradebookAssignment): string {
  return assignment.points_possible === null ? '' : `/ ${assignment.points_possible}`
}

function totalPercent(student: GradebookStudent): number | null {
  if (!student.grade) return null
  const n = parseFloat(student.grade)
  return Number.isNaN(n) ? null : n
}

function sortValue(student: GradebookStudent, key: SortKey): string | number | null {
  if (key === 'name') return `${student.last_name}, ${student.first_name}`.toLowerCase()
  if (key === 'ssid') return student.ssid.toLowerCase()
  if (key === 'total') return totalPercent(student)
  const cell = student.cells[key.slice(2)]
  return cell && !cell.excused ? cell.score : null
}

export function sortStudents(students: GradebookStudent[], key: SortKey, dir: SortDir): GradebookStudent[] {
  return [...students].sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    // Blank grades always sort to the bottom
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
    return dir === 'asc' ? cmp : -cmp
  })
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function gradebookToCSV(gradebook: Gradebook, students: GradebookStudent[]): string {
  const header = [
    'Last Name', 'First Name', 'SSID', 'Email', 'Total',
    ...gradebook.assignments.map((a) => `${a.name} ${pointsLabel(a)}`.trim()),
  ]
  const rows = students.map((s) => [
    s.last_name, s.first_name, s.ssid, s.email, s.grade ?? '',
    ...gradebook.assignments.map((a) => cellText(s.cells[String(a.id)])),
  ])
  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\n')
}

export function downloadGradebookCSV(gradebook: Gradebook, students: GradebookStudent[], filename: string): void {
  const blob = new Blob([gradebookToCSV(gradebook, students)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
