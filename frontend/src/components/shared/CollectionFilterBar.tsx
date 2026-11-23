import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CollectionFilterRef } from '../../lib/courseCollectionFilter'
import { compileFilterExpression } from '../../lib/filterExpression'
import { matchesKeywords } from '../../lib/keywordSearch'
import { useFilterLibrary } from '../../store/filterLibraryStore'
import { HighlightedExpression } from './FilterExpressionEditor'
import { FilterExpressionModal } from './FilterExpressionModal'
import './CollectionFilter.css'

interface CollectionFilterBarProps {
  /** The collection's filter, already resolved against the library. */
  filter: CollectionFilterRef | null
  onChange: (filter: CollectionFilterRef | null) => void
  /** Set inside a React Flow node so drag handlers don't hijack pointer events. */
  nodrag?: boolean
}

type Editing =
  | { kind: 'new' }
  /** A new expression meant to be applied without saving (Save still adds it to the library). */
  | { kind: 'temporary' }
  /** Edit a saved expression (from the menu or the bar). */
  | { kind: 'saved'; id: string; name: string; expression: string }
  /** Edit the collection's unsaved expression; saving adds it to the library. */
  | { kind: 'inline'; name: string; expression: string }

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/**
 * The collection's filter bar: the active expression (with edit / remove) and a
 * Set Filter button whose menu picks a saved expression, edits one, or creates one.
 */
export function CollectionFilterBar({ filter, onChange, nodrag = false }: CollectionFilterBarProps) {
  const library = useFilterLibrary((s) => s.filters)
  const saveFilter = useFilterLibrary((s) => s.saveFilter)
  const deleteFilter = useFilterLibrary((s) => s.deleteFilter)
  const [menu, setMenu] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)
  const [query, setQuery] = useState('')
  const matches = library.filter((f) => matchesKeywords(query, f.name, f.expression))
  const [editing, setEditing] = useState<Editing | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dragCls = nodrag ? ' nodrag nowheel' : ''
  const filterError = filter ? compileFilterExpression(filter.expression).error : null

  useEffect(() => {
    if (!menu) return
    const close = (e: Event) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setMenu(null)
    }
    const closeOnResize = () => setMenu(null)
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('wheel', close, true)
    window.addEventListener('resize', closeOnResize)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      document.removeEventListener('wheel', close, true)
      window.removeEventListener('resize', closeOnResize)
    }
  }, [menu])

  const toggleMenu = () => {
    if (menu) {
      setMenu(null)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.max(260, rect.width)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    setQuery('')
    // Cap the height to the room below the button so the menu never runs off-screen.
    const top = rect.bottom + 4
    setMenu({ left: Math.max(8, left), top, width, maxHeight: Math.max(120, Math.min(320, window.innerHeight - top - 8)) })
  }

  const pick = (f: { id: string; name: string; expression: string }) => {
    onChange({ id: f.id, name: f.name, expression: f.expression })
    setMenu(null)
  }

  const editCurrent = () => {
    if (!filter) return
    const saved = filter.id ? library.find((f) => f.id === filter.id) : undefined
    setEditing(saved
      ? { kind: 'saved', ...saved }
      : { kind: 'inline', name: filter.name, expression: filter.expression })
  }

  const handleSave = (name: string, expression: string) => {
    if (!editing) return
    if (editing.kind === 'saved') {
      // Collections linked to it pick the change up from the library.
      saveFilter({ id: editing.id, name, expression })
    } else {
      const saved = saveFilter({ name, expression })
      onChange({ id: saved.id, name: saved.name, expression: saved.expression })
    }
    setEditing(null)
  }

  /** Applies the expression to this collection only; the library is untouched. */
  const handleApply = (name: string, expression: string) => {
    onChange({ id: null, name, expression })
    setEditing(null)
  }

  const handleDelete = () => {
    if (editing?.kind !== 'saved') return
    if (!window.confirm(`Delete the saved expression "${editing.name}"? Collections using it keep a copy.`)) return
    deleteFilter(editing.id)
    // Collections using it keep their copy of the expression, now unsaved.
    if (filter?.id === editing.id) onChange({ ...filter, id: null })
    setEditing(null)
  }

  return (
    <div className={`fx-bar${dragCls}`}>
      {filter && (
        <div className={`fx-chip${filterError ? ' fx-chip--error' : ''}`} title={filterError ? filterError.message : filter.expression}>
          <div className="fx-chip__text">
            <span className="fx-chip__name">
              {filter.name}
              {!filter.id && <span className="fx-chip__unsaved" title="Temporary: edit and Save to keep it"> (temporary)</span>}
            </span>
            <code className="fx-chip__expr"><HighlightedExpression source={filter.expression} /></code>
          </div>
          <button className="fx-icon-btn" onClick={editCurrent} title="Edit filter expression" aria-label="Edit filter expression">✎</button>
          <button className="fx-icon-btn" onClick={() => onChange(null)} title="Remove filter" aria-label="Remove filter">×</button>
        </div>
      )}
      <button ref={buttonRef} className="fx-set-btn" onClick={toggleMenu} aria-haspopup="menu" aria-expanded={Boolean(menu)}>
        {filter ? 'Change Filter ▾' : 'Set Filter ▾'}
      </button>

      {menu && createPortal(
        <div
          ref={menuRef}
          className="fx-menu"
          role="menu"
          style={{ left: menu.left, top: menu.top, width: menu.width, maxHeight: menu.maxHeight }}
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
          onDoubleClick={stop}
          onKeyDown={(e) => {
            stop(e)
            if (e.key === 'Escape') setMenu(null)
          }}
        >
          <button
            className="fx-menu__new"
            role="menuitem"
            onClick={() => {
              setEditing({ kind: 'new' })
              setMenu(null)
            }}
          >
            + New expression…
          </button>
          <button
            className="fx-menu__new"
            role="menuitem"
            onClick={() => {
              setEditing({ kind: 'temporary' })
              setMenu(null)
            }}
          >
            + Temporary filter…
          </button>
          {library.length > 0 && (
            <input
              className="fx-menu__search"
              type="search"
              autoFocus
              placeholder="Search by name or expression…"
              aria-label="Search saved expressions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches.length > 0) pick(matches[0])
              }}
            />
          )}
          {library.length === 0 ? (
            <div className="fx-menu__empty">No saved expressions yet.</div>
          ) : matches.length === 0 ? (
            <div className="fx-menu__empty">No saved expressions match “{query.trim()}”.</div>
          ) : (
            matches.map((f) => (
              <div key={f.id} className={`fx-menu__item${filter?.id === f.id ? ' fx-menu__item--active' : ''}`}>
                <button
                  className="fx-menu__select"
                  role="menuitem"
                  title={f.expression}
                  onClick={() => pick(f)}
                >
                  <span className="fx-menu__name">{f.name}</span>
                  <code className="fx-menu__expr"><HighlightedExpression source={f.expression} /></code>
                </button>
                <button
                  className="fx-icon-btn"
                  title="Edit expression"
                  aria-label={`Edit ${f.name}`}
                  onClick={() => {
                    setEditing({ kind: 'saved', ...f })
                    setMenu(null)
                  }}
                >
                  ✎
                </button>
              </div>
            ))
          )}
        </div>,
        document.body,
      )}

      {editing && (
        <FilterExpressionModal
          title={editing.kind === 'new' ? 'New filter expression'
            : editing.kind === 'temporary' ? 'Temporary filter'
            : 'Edit filter expression'}
          initialName={editing.kind === 'new' || editing.kind === 'temporary' ? '' : editing.name}
          initialExpression={editing.kind === 'new' || editing.kind === 'temporary' ? '' : editing.expression}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          onDelete={editing.kind === 'saved' ? handleDelete : undefined}
          onApply={handleApply}
          preferApply={editing.kind === 'temporary' || editing.kind === 'inline'}
        />
      )}
    </div>
  )
}
