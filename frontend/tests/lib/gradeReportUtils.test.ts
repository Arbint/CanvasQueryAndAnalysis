import { describe, expect, it } from 'vitest'
import type { Course, Student } from '../../src/api/types'
import { buildGradeReport, parseGradePercent, rowInRange } from '../../src/components/GradeReport/gradeReportUtils'

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
