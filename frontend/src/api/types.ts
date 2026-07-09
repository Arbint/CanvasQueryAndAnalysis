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

export interface CourseQuery {
  account_id: number
  term_ids?: number[]
  keywords?: string[]
}
