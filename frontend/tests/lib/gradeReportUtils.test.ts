import { describe, expect, it } from 'vitest'
import type { Course, Student } from '../../src/api/types'
import {
  buildGradeReport,
  courseSortKey,
  gradeReportToCSV,
  parseGradePercent,
  rowInRange,
  sortGradeReportRows,
} from '../../src/components/GradeReport/gradeReportUtils'

function course(id: number, name: string): Course {
  return { id, name, course_code: `CODE ${id}`, instructor: 'Prof', term_name: 'Fall 2026', student_count: null }
}

function student(id: number, grade: string | null): Student {
  return {
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    ssid: `SSID${id}`,
    login_id: `user${id}`,
    enrollment_state: 'active',
    email: `user${id}@student.uiwtx.edu`,
    grade,
  }
}

describe('parseGradePercent', () => {
  it('parses a percent string', () => {
    expect(parseGradePercent('71%')).toBe(71)
    expect(parseGradePercent('87.5%')).toBe(87.5)
  })

  it('returns null for non-percent or missing grades', () => {
    expect(parseGradePercent(null)).toBeNull()
    expect(parseGradePercent('B+')).toBeNull()
    expect(parseGradePercent('')).toBeNull()
  })
})

describe('buildGradeReport', () => {
  const c1 = course(1, 'Course One')
  const c2 = course(2, 'Course Two')

  it('builds one row per distinct student across courses, with a cell per course', () => {
    // The API returns a fresh Student object per course, so the same student can
    // carry a different grade in each course's roster response.
    const report = buildGradeReport([c1, c2], [
      { course: c1, students: [student(1, '90%'), student(2, '50%')] },
      { course: c2, students: [student(1, '85%')] },
    ])
    expect(report.courses).toEqual([c1, c2])
    expect(report.rows).toHaveLength(2)
    const row1 = report.rows.find((r) => r.student.id === 1)
    const row2 = report.rows.find((r) => r.student.id === 2)
    expect(row1?.cells).toEqual(['90%', '85%'])
    expect(row2?.cells).toEqual(['50%', null])
  })

  it('sorts rows by last name then first name', () => {
    const a = { ...student(1, '90%'), last_name: 'Zeta' }
    const b = { ...student(2, '80%'), last_name: 'Alpha' }
    const report = buildGradeReport([c1], [{ course: c1, students: [a, b] }])
    expect(report.rows.map((r) => r.student.last_name)).toEqual(['Alpha', 'Zeta'])
  })
})

describe('rowInRange', () => {
  it('matches when any cell falls within the range', () => {
    const row = { student: student(1, null), cells: ['90%', '40%', null] }
    expect(rowInRange(row, 0, 50)).toBe(true)
    expect(rowInRange(row, 60, 100)).toBe(true)
    expect(rowInRange(row, 41, 89)).toBe(false)
  })

  it('treats a missing grade (-) as always out of range', () => {
    const row = { student: student(1, null), cells: [null] }
    expect(rowInRange(row, 0, 100)).toBe(false)
  })
})

describe('sortGradeReportRows', () => {
  const c1 = course(1, 'Course One')
  const c2 = course(2, 'Course Two')
  const rows = [
    { student: { ...student(1, null), last_name: 'Zeta', ssid: 'B', email: 'zeta@x.com' }, cells: ['60%', '90%'] },
    { student: { ...student(2, null), last_name: 'Alpha', ssid: 'A', email: 'alpha@x.com' }, cells: ['80%', null] },
  ]

  it('sorts by name ascending and descending', () => {
    expect(sortGradeReportRows(rows, [c1, c2], 'name', 'asc').map((r) => r.student.last_name)).toEqual(['Alpha', 'Zeta'])
    expect(sortGradeReportRows(rows, [c1, c2], 'name', 'desc').map((r) => r.student.last_name)).toEqual(['Zeta', 'Alpha'])
  })

  it('sorts by ssid', () => {
    expect(sortGradeReportRows(rows, [c1, c2], 'ssid', 'asc').map((r) => r.student.ssid)).toEqual(['A', 'B'])
  })

  it('sorts by email', () => {
    expect(sortGradeReportRows(rows, [c1, c2], 'email', 'asc').map((r) => r.student.email)).toEqual(['alpha@x.com', 'zeta@x.com'])
  })

  it('sorts by a course column\'s grade, treating a missing grade as lowest', () => {
    const byC1 = sortGradeReportRows(rows, [c1, c2], courseSortKey(c1.id), 'asc')
    expect(byC1.map((r) => r.student.last_name)).toEqual(['Zeta', 'Alpha']) // 60% < 80%

    const byC2 = sortGradeReportRows(rows, [c1, c2], courseSortKey(c2.id), 'asc')
    expect(byC2.map((r) => r.student.last_name)).toEqual(['Alpha', 'Zeta']) // null < 90%
  })
})

describe('gradeReportToCSV', () => {
  it('builds a header row and one row per student with course grades', () => {
    const c1 = course(1, 'Course One')
    const rows = [{ student: student(1, '90%'), cells: ['90%'] }]
    const csv = gradeReportToCSV([c1], rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('"Name","SSID","Email","Course One"')
    expect(lines[1]).toBe('"Last1, First1","SSID1","user1@student.uiwtx.edu","90%"')
  })

  it('renders a missing grade as a dash', () => {
    const c1 = course(1, 'Course One')
    const rows = [{ student: student(1, null), cells: [null] }]
    const csv = gradeReportToCSV([c1], rows)
    expect(csv.split('\n')[1]).toContain('"-"')
  })
})
