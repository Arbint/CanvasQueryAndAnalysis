export interface Account {
  id: number
  name: string
}

export interface Term {
  id: number
  name: string
}

export interface Course {
  id: number
  name: string
  course_code: string
  instructor: string
  term_name: string
  student_count: number | null
  meeting_time?: string
}

export interface Student {
  id: number
  first_name: string
  last_name: string
  ssid: string
  login_id: string
  enrollment_state: 'active' | 'inactive'
  email: string
  grade?: string | null
}

export interface GradebookAssignment {
  id: number
  name: string
  group_name: string
  points_possible: number | null
}

export interface GradebookCell {
  score: number | null
  grade: string | null
  excused: boolean
  missing: boolean
  late: boolean
}

export interface GradebookStudent extends Student {
  // Keyed by assignment id (JSON object keys arrive as strings)
  cells: Record<string, GradebookCell>
}

export interface Gradebook {
  assignments: GradebookAssignment[]
  students: GradebookStudent[]
}

export interface CourseQuery {
  account_id: number
  term_ids?: number[]
  keywords?: string[]
}

export interface AuditMatch {
  course_id: number
  first_name: string
  last_name: string
  grade: string | null
}

export interface Instructor {
  name: string | null
  email: string | null
}
