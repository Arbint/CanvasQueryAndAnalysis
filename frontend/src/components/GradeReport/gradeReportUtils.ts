import type { Workbook } from 'exceljs'
import type { Course, Instructor, Student } from '../../api/types'

export interface GradeReportRow {
  student: Student
  cells: (string | null)[]
}

export interface GradeReportData {
  courses: Course[]
  rows: GradeReportRow[]
}

export function buildGradeReport(
  matchedCourses: Course[],
  studentsByCourse: { course: Course; students: Student[] }[],
): GradeReportData {
  const byStudent = new Map<number, { student: Student; grades: Map<number, string | null> }>()
  for (const { course, students } of studentsByCourse) {
    for (const student of students) {
      if (!byStudent.has(student.id)) byStudent.set(student.id, { student, grades: new Map() })
      byStudent.get(student.id)!.grades.set(course.id, student.grade ?? null)
    }
  }

  const rows: GradeReportRow[] = [...byStudent.values()]
    .map(({ student, grades }) => ({
      student,
      cells: matchedCourses.map((c) => grades.get(c.id) ?? null),
    }))
    .sort((a, b) => {
      const cmp = a.student.last_name.localeCompare(b.student.last_name)
      return cmp !== 0 ? cmp : a.student.first_name.localeCompare(b.student.first_name)
    })

  return { courses: matchedCourses, rows }
}

export function parseGradePercent(grade: string | null): number | null {
  if (!grade) return null
  const match = grade.trim().match(/^(-?\d+(?:\.\d+)?)%$/)
  return match ? Number(match[1]) : null
}

export function isGradeInRange(cell: string | null, min: number, max: number): boolean {
  const pct = parseGradePercent(cell)
  return pct !== null && pct >= min && pct <= max
}

export function rowInRange(row: GradeReportRow, min: number, max: number): boolean {
  return row.cells.some((cell) => isGradeInRange(cell, min, max))
}

export const FIXED_SORT_KEYS = ['name', 'ssid', 'email'] as const
export type FixedSortKey = (typeof FIXED_SORT_KEYS)[number]
export type SortKey = FixedSortKey | `course:${number}`
export type SortDir = 'asc' | 'desc'

export function courseSortKey(courseId: number): SortKey {
  return `course:${courseId}`
}

export function sortGradeReportRows(
  rows: GradeReportRow[],
  courses: Course[],
  sortKey: SortKey,
  dir: SortDir,
): GradeReportRow[] {
  const courseIndex = courses.findIndex((c) => courseSortKey(c.id) === sortKey)

  const sorted = [...rows].sort((a, b) => {
    let cmp: number
    if (sortKey === 'name') {
      cmp = a.student.last_name.localeCompare(b.student.last_name)
        || a.student.first_name.localeCompare(b.student.first_name)
    } else if (sortKey === 'ssid') {
      cmp = a.student.ssid.localeCompare(b.student.ssid)
    } else if (sortKey === 'email') {
      cmp = a.student.email.localeCompare(b.student.email)
    } else if (courseIndex >= 0) {
      // A missing grade sorts as below 0%, always ranking first ascending / last descending.
      const av = parseGradePercent(a.cells[courseIndex]) ?? -1
      const bv = parseGradePercent(b.cells[courseIndex]) ?? -1
      cmp = av - bv
    } else {
      cmp = 0
    }
    return dir === 'asc' ? cmp : -cmp
  })

  return sorted
}

// The green accent used to highlight in-range grades, matching --color-accent-green in theme.css.
export const IN_RANGE_ARGB = 'FF98C379'

export function courseHeaderLabel(course: Course, instructor?: Instructor): string {
  if (!instructor || (!instructor.name && !instructor.email)) return course.name
  const contact = [instructor.name, instructor.email].filter(Boolean).join(' — ')
  return `${course.name}\n${contact}`
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function gradeReportToCSV(
  courses: Course[],
  rows: GradeReportRow[],
  instructors: Record<number, Instructor>,
): string {
  const header = ['Name', 'SSID', 'Email', ...courses.map((c) => courseHeaderLabel(c, instructors[c.id]))]
    .map(csvCell).join(',')
  const lines = rows.map((row) =>
    [
      `${row.student.last_name}, ${row.student.first_name}`,
      row.student.ssid,
      row.student.email,
      ...row.cells.map((cell) => cell ?? '-'),
    ].map(csvCell).join(','),
  )
  return [header, ...lines].join('\n')
}

export function downloadGradeReportCSV(
  courses: Course[],
  rows: GradeReportRow[],
  instructors: Record<number, Instructor>,
  filename = 'grade-report.csv',
): void {
  const blob = new Blob([gradeReportToCSV(courses, rows, instructors)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function buildGradeReportWorkbook(
  courses: Course[],
  rows: GradeReportRow[],
  instructors: Record<number, Instructor>,
  min: number,
  max: number,
): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Grade Report')

  const headerRow = sheet.addRow(['Name', 'SSID', 'Email', ...courses.map((c) => courseHeaderLabel(c, instructors[c.id]))])
  headerRow.font = { bold: true }
  headerRow.alignment = { wrapText: true, vertical: 'top' }

  for (const row of rows) {
    const values = [
      `${row.student.last_name}, ${row.student.first_name}`,
      row.student.ssid,
      row.student.email,
      ...row.cells.map((cell) => cell ?? '-'),
    ]
    const sheetRow = sheet.addRow(values)
    row.cells.forEach((cell, i) => {
      if (isGradeInRange(cell, min, max)) {
        sheetRow.getCell(4 + i).font = { color: { argb: IN_RANGE_ARGB }, bold: true }
      }
    })
  }

  sheet.columns.forEach((col, i) => {
    col.width = i < 3 ? 22 : 20
  })

  return workbook
}

export async function downloadGradeReportXLSX(
  courses: Course[],
  rows: GradeReportRow[],
  instructors: Record<number, Instructor>,
  min: number,
  max: number,
  filename = 'grade-report.xlsx',
): Promise<void> {
  const workbook = await buildGradeReportWorkbook(courses, rows, instructors, min, max)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
