import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GraphSnapshot } from '../../store/appStore'
import { useGraphLibrary, type AggregationGraphRef } from '../../store/graphLibraryStore'
import { GraphEditorModal } from '../NodeGraph/GraphEditorModal'
import type { GraphScope } from '../../lib/graphEvaluation'
import '../shared/CollectionFilter.css'

interface GraphPickerProps {
  /** The card's graph, already resolved against the library. */
  graph: AggregationGraphRef | null
  /** Called with the graph to use; also after the card's graph is edited, so it re-collects. */
  onChange: (graph: AggregationGraphRef) => void
  /** The card's Terms / Department, applied while editing the graph. */
  scope: GraphScope
}

type Editing =
  | { kind: 'new' }
  /** Edit a saved graph in place. */
  | { kind: 'edit'; id: string; name: string; graph: GraphSnapshot }
  /** Save as a new graph: a duplicate, or the card's unsaved copy. */
  | { kind: 'copy'; name: string; graph: GraphSnapshot }

const EMPTY_GRAPH: GraphSnapshot = { nodes: [], edges: [] }

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** Picks, creates, edits or duplicates the aggregation graph a trend card uses. */
export function GraphPicker({ graph, onChange, scope }: GraphPickerProps) {
  const library = useGraphLibrary((s) => s.graphs)
  const saveGraph = useGraphLibrary((s) => s.saveGraph)
  const [menu, setMenu] = useState<{ left: number; top: number; width: number } | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const linked = graph?.id ? library.find((g) => g.id === graph.id) : undefined

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
    const width = Math.max(280, rect.width)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    setMenu({ left: Math.max(8, left), top: rect.bottom + 4, width })
  }

  const open = (next: Editing) => {
    setEditing(next)
    setMenu(null)
  }

  const editCurrent = () => {
    if (!graph) return
    open(linked
      ? { kind: 'edit', id: linked.id, name: linked.name, graph: linked.graph }
      : { kind: 'copy', name: graph.name, graph: graph.graph })
  }

  const handleSave = (name: string, saved: GraphSnapshot) => {
    if (!editing) return
    const entry = saveGraph({ id: editing.kind === 'edit' ? editing.id : null, name, graph: saved })
    const ref = { id: entry.id, name: entry.name, graph: entry.graph }
    // Editing another card's graph from the menu doesn't switch this card to it.
    if (editing.kind !== 'edit' || graph?.id === entry.id) onChange(ref)
    setEditing(null)
  }

  return (
    <div className="fx-bar">
      {graph && (
        <div className="fx-chip graph-chip" title={`${graph.graph.nodes.length} nodes, ${graph.graph.edges.length} connections`}>
          <div className="fx-chip__text">
            <span className="fx-chip__name">
              {graph.name}
              {!linked && <span className="fx-chip__unsaved"> (not in your saved graphs)</span>}
            </span>
            <span className="graph-chip__meta">
              {graph.graph.nodes.filter((n) => n.type !== 'commentBoxNode').length} nodes · {graph.graph.edges.length} connections
            </span>
          </div>
          <button className="fx-icon-btn" onClick={editCurrent} title="Edit this graph" aria-label="Edit this graph">✎</button>
        </div>
      )}
      <button ref={buttonRef} className="fx-set-btn" onClick={toggleMenu} aria-haspopup="menu" aria-expanded={Boolean(menu)}>
        {graph ? 'Change Graph ▾' : 'Set Graph ▾'}
      </button>

      {menu && createPortal(
        <div
          ref={menuRef}
          className="fx-menu"
          role="menu"
          style={{ left: menu.left, top: menu.top, width: menu.width }}
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
          onDoubleClick={stop}
          onKeyDown={(e) => {
            stop(e)
            if (e.key === 'Escape') setMenu(null)
          }}
        >
          {library.length === 0 ? (
            <div className="fx-menu__empty">No saved graphs yet.</div>
          ) : (
            library.map((g) => (
              <div key={g.id} className={`fx-menu__item${graph?.id === g.id ? ' fx-menu__item--active' : ''}`}>
                <button
                  className="fx-menu__select"
                  role="menuitem"
                  onClick={() => {
                    onChange({ id: g.id, name: g.name, graph: g.graph })
                    setMenu(null)
                  }}
                >
                  <span className="fx-menu__name">{g.name}</span>
                  <span className="graph-chip__meta">
                    {g.graph.nodes.filter((n) => n.type !== 'commentBoxNode').length} nodes · {g.graph.edges.length} connections
                  </span>
                </button>
                <button
                  className="fx-icon-btn"
                  title="Edit this graph"
                  aria-label={`Edit ${g.name}`}
                  onClick={() => open({ kind: 'edit', id: g.id, name: g.name, graph: g.graph })}
                >
                  ✎
                </button>
                <button
                  className="fx-icon-btn"
                  title="Duplicate: edit a copy and save it as a new graph"
                  aria-label={`Duplicate ${g.name}`}
                  onClick={() => open({ kind: 'copy', name: `${g.name} (copy)`, graph: g.graph })}
                >
                  ⧉
                </button>
              </div>
            ))
          )}
          <button className="fx-menu__new" role="menuitem" onClick={() => open({ kind: 'new' })}>
            + New graph…
          </button>
        </div>,
        document.body,
      )}

      {editing && (
        <GraphEditorModal
          title={editing.kind === 'new' ? 'New aggregation graph' : editing.kind === 'edit' ? 'Edit aggregation graph' : 'Save a copy of the graph'}
          scope={scope}
          initialName={editing.kind === 'new' ? '' : editing.name}
          initialGraph={editing.kind === 'new' ? EMPTY_GRAPH : editing.graph}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
