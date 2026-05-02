import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CourseList } from '../../src/components/CourseSearch/CourseList'
import type { Course } from '../../src/api/types'

const SAMPLE_COURSE: Course = {
  id: 1,
  name: 'Math 101',
  course_code: 'MATH-101',
  instructor: 'Dr. Smith',
  term_name: 'Fall 2024',
  student_count: null,
}

describe('CourseList', () => {
  it('renders course fields', () => {
    render(<CourseList courses={[SAMPLE_COURSE]} loading={false} error={null} />)
    expect(screen.getByText('Math 101')).toBeInTheDocument()
    expect(screen.getByText('MATH-101')).toBeInTheDocument()
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument()
    expect(screen.getByText('Fall 2024')).toBeInTheDocument()
  })

  it('shows em dash when student_count is null', () => {
    render(<CourseList courses={[SAMPLE_COURSE]} loading={false} error={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows count when available', () => {
    const course = { ...SAMPLE_COURSE, student_count: 42 }
    render(<CourseList courses={[course]} loading={false} error={null} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<CourseList courses={[]} loading={true} error={null} />)
    expect(screen.getByText(/Searching/)).toBeInTheDocument()
  })

  it('shows error', () => {
    render(<CourseList courses={[]} loading={false} error="Network error" />)
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('shows empty state when no courses', () => {
    render(<CourseList courses={[]} loading={false} error={null} />)
    expect(screen.getByText(/No courses found/)).toBeInTheDocument()
  })
})
