import React, { useEffect, useRef, useState } from 'react'
import './NodeGraph.css'

interface NodePaletteProps {
  position: { x: number; y: number }
  onSelect: (type: string) => void
  onClose: () => void
}

const NODE_TYPES = [
  { type: 'courseNode', label: 'Course' },
  { type: 'courseCollectionNode', label: 'Course Collection' },
  { type: 'unionNode', label: 'Union' },
  { type: 'intersectNode', label: 'Intersect' },
  { type: 'subtractNode', label: 'Subtract' },
]

export function NodePalette({ position, onSelect, onClose }: NodePaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = NODE_TYPES.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase())
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter' && filtered.length > 0) {
      onSelect(filtered[0].type)
    }
  }

  return (
    <div
      className="node-palette"
      style={{ left: position.x, top: position.y }}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        className="node-palette__search"
        placeholder="Search node…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="node-palette__list">
        {filtered.map((n) => (
          <li key={n.type}>
            <button
              className="node-palette__item"
              onClick={() => onSelect(n.type)}
            >
              {n.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
