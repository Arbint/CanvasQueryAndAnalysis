import type { Course, Student } from '../../api/types'

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

export function rowInRange(row: GradeReportRow, min: number, max: number): boolean {
  return row.cells.some((cell) => {
    const pct = parseGradePercent(cell)
    return pct !== null && pct >= min && pct <= max
  })
}
