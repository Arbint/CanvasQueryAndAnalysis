import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from '../../src/components/StudentAudit/SearchableSelect'

const OPTIONS = [
  { value: 'Spring 2024', label: 'Spring 2024' },
  { value: 'Fall 2024', label: 'Fall 2024' },
  { value: 'Spring 2025', label: 'Spring 2025' },
]

describe('SearchableSelect', () => {
  it('shows the selected option label when closed', () => {
    render(<SearchableSelect value="Fall 2024" onChange={() => {}} options={OPTIONS} />)
    expect(screen.getByDisplayValue('Fall 2024')).toBeInTheDocument()
  })

  it('shows all options on focus', async () => {
    const user = userEvent.setup()
    render(<SearchableSelect value="" onChange={() => {}} options={OPTIONS} />)
    await user.click(screen.getByRole('textbox'))
    expect(screen.getByText('Spring 2024')).toBeInTheDocument()
    expect(screen.getByText('Fall 2024')).toBeInTheDocument()
    expect(screen.getByText('Spring 2025')).toBeInTheDocument()
  })

  it('filters options by typed text', async () => {
    const user = userEvent.setup()
    render(<SearchableSelect value="" onChange={() => {}} options={OPTIONS} />)
    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'spring')
    expect(screen.getByText('Spring 2024')).toBeInTheDocument()
    expect(screen.getByText('Spring 2025')).toBeInTheDocument()
    expect(screen.queryByText('Fall 2024')).not.toBeInTheDocument()
  })

  it('selects an option on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchableSelect value="" onChange={onChange} options={OPTIONS} />)
    await user.click(screen.getByRole('textbox'))
    await user.click(screen.getByText('Fall 2024'))
    expect(onChange).toHaveBeenCalledWith('Fall 2024')
  })

  it('selects the first match on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchableSelect value="" onChange={onChange} options={OPTIONS} />)
    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'fall{Enter}')
    expect(onChange).toHaveBeenCalledWith('Fall 2024')
  })

  it('shows no matches message when nothing filters', async () => {
    const user = userEvent.setup()
    render(<SearchableSelect value="" onChange={() => {}} options={OPTIONS} />)
    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'winter')
    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is set', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={OPTIONS} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
