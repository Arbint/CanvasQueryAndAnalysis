import type { Account, AuditMatch, Course, CourseQuery, Instructor, Student, Term } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`)
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new ApiError(response.status, text)
  }
  return response.json() as Promise<T>
}

export const api = {
  getAccounts(): Promise<Account[]> {
    return get('/api/accounts')
  },

  getTerms(accountId: number): Promise<Term[]> {
    return get(`/api/accounts/${accountId}/terms`)
  },

  getCourses({ account_id, term_ids = [], keywords = [] }: CourseQuery): Promise<Course[]> {
    const params = new URLSearchParams({ account_id: String(account_id) })
    if (term_ids.length > 0) params.set('term_ids', term_ids.join(','))
    if (keywords.length > 0) params.set('keywords', keywords.join(','))
    return get(`/api/courses?${params}`)
  },

  getStudentCount(courseId: number): Promise<{ count: number }> {
    return get(`/api/courses/${courseId}/student-count`)
  },

  getStudents(courseId: number): Promise<Student[]> {
    return get(`/api/courses/${courseId}/students`)
  },

  getCourseInstructor(courseId: number): Promise<Instructor> {
    return get(`/api/courses/${courseId}/instructor`)
  },

  // One request from the browser — the fan-out across courses happens server-side,
  // so this never runs into the browser's per-origin connection cap.
  getStudentAudit(studentId: string, courseIds: number[]): Promise<AuditMatch[]> {
    const query = new URLSearchParams({ course_ids: courseIds.join(',') })
    return get(`/api/students/${encodeURIComponent(studentId)}/audit?${query}`)
  },
}
