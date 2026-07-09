import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StudentList } from '../../src/components/StudentList/StudentList'
import { toCSV, emailsString } from '../../src/components/StudentList/exportUtils'
import type { Student } from '../../src/api/types'
import { useAppStore } from '../../src/store/appStore'

function s(overrides: Partial<Student> & { id: number }): Student {
  return {
    first_name: 'First',
    last_name: 'Last',
    ssid: 'SSID',
    login_id: `user${overrides.id}`,
    enrollment_state: 'active',
    email: `user${overrides.id}@student.uiwtx.edu`,
    ...overrides,
  }
}

const ALICE = s({ id: 1, first_name: 'Alice', last_name: 'Adams', enrollment_state: 'active', login_id: 'aadams', email: 'aadams@student.uiwtx.edu' })
const BOB = s({ id: 2, first_name: 'Bob', last_name: 'Brown', enrollment_state: 'inactive', login_id: 'bbrown', email: 'bbrown@student.uiwtx.edu' })

function renderWithStudents(students: Student[]) {
  useAppStore.setState({ activeStudentList: students })
  return render(<StudentList />)
}

describe('StudentList', () => {
  it('shows empty state when no students', () => {
    renderWithStudents([])
    expect(screen.getByText(/Double-click a node/)).toBeInTheDocument()
  })

  it('renders student rows', () => {
    renderWithStudents([ALICE])
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Adams')).toBeInTheDocument()
    expect(screen.getByText('aadams@student.uiwtx.edu')).toBeInTheDocument()
  })

  it('shows the grade when present', () => {
    renderWithStudents([s({ id: 1, grade: '87.5%' })])
    expect(screen.getByText('87.5%')).toBeInTheDocument()
  })

  it('shows an em dash when grade is unavailable', () => {
    renderWithStudents([s({ id: 1, grade: null })])
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('filters to active students', async () => {
    const user = userEvent.setup()
    renderWithStudents([ALICE, BOB])
    await user.selectOptions(screen.getByRole('combobox', { name: /Filter/i }), 'active')
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('sorts by last name', async () => {
    const user = userEvent.setup()
    const CHARLIE = s({ id: 3, first_name: 'Charlie', last_name: 'Avery', enrollment_state: 'active', login_id: 'cavery', email: 'cavery@student.uiwtx.edu' })
    renderWithStudents([ALICE, CHARLIE])
    await user.selectOptions(screen.getByRole('combobox', { name: /Sort/i }), 'last_name')
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows[0]).toHaveTextContent('Adams')
    expect(rows[1]).toHaveTextContent('Avery')
  })
})

describe('exportUtils', () => {
  it('toCSV includes header and data rows', () => {
    const csv = toCSV([ALICE])
    const lines = csv.split('\n')
    expect(lines[0]).toBe('First Name,Last Name,SSID,Login ID,Email')
    expect(lines[1]).toContain('Alice')
    expect(lines[1]).toContain('aadams@student.uiwtx.edu')
  })

  it('emailsString returns comma-separated emails', () => {
    expect(emailsString([ALICE, BOB])).toBe(
      'aadams@student.uiwtx.edu,bbrown@student.uiwtx.edu'
    )
  })
})
