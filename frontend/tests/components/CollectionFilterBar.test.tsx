import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CollectionFilterBar } from '../../src/components/shared/CollectionFilterBar'
import type { CollectionFilterRef } from '../../src/lib/courseCollectionFilter'
import { useAppStore } from '../../src/store/appStore'
import { useFilterLibrary } from '../../src/store/filterLibraryStore'
import { resolveCollectionFilters } from '../../src/lib/courseCollectionFilter'

/** Bar wired the way the panels use it: state + resolution against the library. */
function Harness({ initial = null }: { initial?: CollectionFilterRef | null }) {
  const [filter, setFilter] = useState<CollectionFilterRef | null>(initial)
  const library = useFilterLibrary((s) => s.filters)
  const resolved = resolveCollectionFilters({ selectedTerms: [], department: '', filter }, library).filter
  return <CollectionFilterBar filter={resolved} onChange={setFilter} />
}

describe('CollectionFilterBar', () => {
  beforeEach(() => {
    localStorage.clear()
    useFilterLibrary.setState({ filters: [] })
    useAppStore.setState({
      courses: [
        { id: 1, name: 'Animation III', course_code: 'ANGD 3170 01', instructor: 'Jingtian Li', term_name: 'Fall 2025', student_count: null },
        { id: 2, name: 'Intro', course_code: 'ANGD 1100 01', instructor: 'Robert Kim', term_name: 'Fall 2025', student_count: null },
      ],
    })
  })

  it('creates a new expression from Set Filter, saves it, and applies it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Set Filter/ }))
    await user.click(screen.getByRole('menuitem', { name: /New expression/ }))

    await user.type(screen.getByLabelText('Name'), 'Upper level')
    fireEvent.change(screen.getByLabelText('Filter expression'), { target: { value: '$3*** and @Jing' } })
    expect(screen.getByText('1 of 2 searched courses match')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(useFilterLibrary.getState().filters).toMatchObject([{ name: 'Upper level', expression: '$3*** and @Jing' }])
    expect(screen.getByText('Upper level')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Change Filter/ })).toBeInTheDocument()
  })

  it('blocks saving an invalid expression and shows the error', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Set Filter/ }))
    await user.click(screen.getByRole('menuitem', { name: /New expression/ }))
    await user.type(screen.getByLabelText('Name'), 'Broken')
    fireEvent.change(screen.getByLabelText('Filter expression'), { target: { value: '$3*** $2***' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Expected "and" or "or"')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('selects a saved expression and edits it from the filter bar', async () => {
    useFilterLibrary.setState({ filters: [{ id: 'f1', name: 'Game art', expression: '$2*3*' }] })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Set Filter/ }))
    await user.click(screen.getByRole('menuitem', { name: /Game art/ }))
    expect(screen.getByText('Game art')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit filter expression' }))
    fireEvent.change(screen.getByLabelText('Filter expression'), { target: { value: '$2*3* or $2*6*' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(useFilterLibrary.getState().filters).toEqual([{ id: 'f1', name: 'Game art', expression: '$2*3* or $2*6*' }])
    expect(screen.getByTitle('$2*3* or $2*6*')).toBeInTheDocument()
  })

  it('edits a saved expression from the menu', async () => {
    useFilterLibrary.setState({ filters: [{ id: 'f1', name: 'Game art', expression: '$2*3*' }] })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Set Filter/ }))
    await user.click(screen.getByRole('button', { name: 'Edit Game art' }))
    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(useFilterLibrary.getState().filters[0].name).toBe('Renamed')
  })

  it('saves a converted (unsaved) filter into the library when edited', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ id: null, name: 'Converted filter', expression: '$3***' }} />)
    expect(screen.getByText('(temporary)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit filter expression' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(useFilterLibrary.getState().filters).toMatchObject([{ name: 'Converted filter', expression: '$3***' }])
    expect(screen.queryByText('(temporary)')).not.toBeInTheDocument()
  })

  it('applies a temporary filter without saving it to the library', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Set Filter/ }))
    await user.click(screen.getByRole('menuitem', { name: /Temporary filter/ }))
    fireEvent.change(screen.getByLabelText('Filter expression'), { target: { value: '$3***' } })
    // No name needed to apply.
    await user.click(screen.getByRole('button', { name: 'Apply without saving' }))

    expect(useFilterLibrary.getState().filters).toEqual([])
    expect(screen.getByText('Temporary filter')).toBeInTheDocument()
    expect(screen.getByText('(temporary)')).toBeInTheDocument()
    expect(screen.getByTitle('$3***')).toBeInTheDocument()
  })

  it('applies an edited saved expression to this collection only', async () => {
    useFilterLibrary.setState({ filters: [{ id: 'f1', name: 'Game art', expression: '$2*3*' }] })
    const user = userEvent.setup()
    render(<Harness initial={{ id: 'f1', name: 'Game art', expression: '$2*3*' }} />)
    await user.click(screen.getByRole('button', { name: 'Edit filter expression' }))
    fireEvent.change(screen.getByLabelText('Filter expression'), { target: { value: '$2*3* and @Jing' } })
    await user.click(screen.getByRole('button', { name: 'Apply without saving' }))

    expect(useFilterLibrary.getState().filters).toEqual([{ id: 'f1', name: 'Game art', expression: '$2*3*' }])
    expect(screen.getByText('(temporary)')).toBeInTheDocument()
    expect(screen.getByTitle('$2*3* and @Jing')).toBeInTheDocument()
  })

  it('searches saved expressions by keywords in the name or expression', async () => {
    useFilterLibrary.setState({ filters: [
      { id: 'f1', name: 'Game art', expression: '$2*3*' },
      { id: 'f2', name: 'Upper level', expression: '$3*** and #2025' },
      { id: 'f3', name: 'Jing courses', expression: '@Jing' },
    ] })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Set Filter/ }))
    const search = screen.getByLabelText('Search saved expressions')
    expect(search).toHaveFocus()
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toHaveLength(5) // 3 + "New expression" + "Temporary filter"

    await user.type(search, '2025 upper')
    expect(screen.getByRole('menuitem', { name: /Upper level/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Game art/ })).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'nothing-like-this')
    expect(screen.getByText(/No saved expressions match/)).toBeInTheDocument()

    // Enter picks the first match.
    await user.clear(search)
    await user.type(search, '@jing{Enter}')
    expect(screen.getByText('Jing courses')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search saved expressions')).not.toBeInTheDocument()
  })
})
