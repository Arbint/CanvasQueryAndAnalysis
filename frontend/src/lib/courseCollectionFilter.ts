import type { Course } from '../api/types'

export interface CourseCollectionFilters {
  selectedTerms: string[]
  department: string
  includeFilters: string[]
  excludeFilters: string[]
}

export function emptyCourseCollectionFilters(): CourseCollectionFilters {
  return { selectedTerms: [], department: '', includeFilters: [], excludeFilters: [] }
}

export function parseDepartment(courseCode: string): string {
  return courseCode.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
}

export function parseCourseNumber(courseCode: string): string {
  return courseCode.match(/\d{4}/)?.[0] ?? courseCode.match(/\d+/)?.[0] ?? ''
}

export function matchesWildcard(pattern: string, value: string): boolean {
  const regexStr = [...pattern]
    .map((c) => (c === '*' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${regexStr}$`).test(value)
}

export function matchesAnyPattern(patterns: string[], value: string): boolean {
  return patterns.some((p) => !p.trim() || matchesWildcard(p.trim(), value))
}

export function courseMatchesFilters(course: Course, filters: CourseCollectionFilters): boolean {
  const { selectedTerms, department, includeFilters, excludeFilters } = filters
  if (selectedTerms.length > 0 && !selectedTerms.includes(course.term_name)) return false
  if (department) {
    if (parseDepartment(course.course_code) !== department.trim().toUpperCase()) return false
  }
  const courseNum = parseCourseNumber(course.course_code)
  if (includeFilters.length > 0 && !matchesAnyPattern(includeFilters, courseNum)) return false
  if (excludeFilters.length > 0 && matchesAnyPattern(excludeFilters, courseNum)) return false
  return true
}
