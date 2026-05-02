import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChipInput } from '../../src/components/CourseSearch/ChipInput'

describe('ChipInput', () => {
  it('renders existing values as chips', () => {
    render(<ChipInput values={['Spring 2024', 'Fall 2024']} onChange={() => {}} />)
    expect(screen.getByText('Spring 2024')).toBeInTheDocument()
    expect(screen.getByText('Fall 2024')).toBeInTheDocument()
  })

  it('opens input on + click', async () => {
    const user = userEvent.setup()
    render(<ChipInput values={[]} onChange={() => {}} placeholder="Add semester…" />)
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByPlaceholderText('Add semester…')).toBeInTheDocument()
  })

  it('adds chip on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipInput values={[]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await user.type(screen.getByRole('textbox'), 'Spring 2025{Enter}')
    expect(onChange).toHaveBeenCalledWith(['Spring 2025'])
  })

  it('closes input on Escape without adding', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipInput values={[]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await user.type(screen.getByRole('textbox'), 'partial{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('removes chip on × click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipInput values={['Math']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Remove Math' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('ignores duplicate values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ChipInput values={['Math']} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await user.type(screen.getByRole('textbox'), 'Math{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })
})
