import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { parseCreditHours, StudentAudit } from '../../src/components/StudentAudit/StudentAudit'

describe('parseCreditHours', () => {
  it('reads the second digit of the course number after the first dash', () => {
    expect(parseCreditHours('ANGD-2330 Section 01 FA26')).toBe(3)
    expect(parseCreditHours('ANGD-4100 Section 01 FA26')).toBe(1)
  })

  it('returns 0 when there is no dash', () => {
    expect(parseCreditHours('GAMD 2320 01')).toBe(0)
  })

  it('returns 0 when the number after the dash is too short', () => {
    expect(parseCreditHours('ANGD-5')).toBe(0)
  })

  it('returns 0 when nothing follows the dash', () => {
    expect(parseCreditHours('ANGD-')).toBe(0)
  })
})

describe('StudentAudit', () => {
  it('renders base info with no Audit button, and one empty semester card', () => {
    render(<StudentAudit />)
    expect(screen.getByPlaceholderText('e.g. DEMO00001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Audit$/ })).toBeInTheDocument() // per-card Audit button
    expect(screen.getByRole('button', { name: 'Audit All' })).toBeInTheDocument()
    expect(screen.getByText('Press Audit to check this semester.')).toBeInTheDocument()
    expect(screen.getByText('No audited courses yet.')).toBeInTheDocument()
    expect(screen.getByText('Total Hours')).toBeInTheDocument()
  })

  it('does not show a remove button when only one semester exists', () => {
    render(<StudentAudit />)
    expect(screen.queryByRole('button', { name: 'Remove semester' })).not.toBeInTheDocument()
  })

  it('adds another semester card on +, and shows remove buttons once there are two', async () => {
    const user = userEvent.setup()
    render(<StudentAudit />)
    await user.click(screen.getByTitle('Add semester'))
    expect(screen.getAllByRole('button', { name: /^Audit$/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Remove semester' })).toHaveLength(2)
  })

  it('removes a semester card and falls back to no remove button with one left', async () => {
    const user = userEvent.setup()
    render(<StudentAudit />)
    await user.click(screen.getByTitle('Add semester'))
    const removeButtons = screen.getAllByRole('button', { name: 'Remove semester' })
    await user.click(removeButtons[0])
    expect(screen.getAllByRole('button', { name: /^Audit$/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Remove semester' })).not.toBeInTheDocument()
  })
})
