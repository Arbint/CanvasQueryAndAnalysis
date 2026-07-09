import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import './SearchableSelect.css'

export interface SearchableOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  disabled?: boolean
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Search…', disabled }: SearchableSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? ''
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const commit = (option: SearchableOption) => {
    onChange(option.value)
    close()
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { close(); e.currentTarget.blur(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) commit(filtered[0])
    }
  }

  return (
    <div className={`searchable-select${disabled ? ' searchable-select--disabled' : ''}`} ref={rootRef}>
      <input
        className="searchable-select__input"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul className="searchable-select__suggestions">
          {filtered.length === 0 ? (
            <li className="searchable-select__empty">No matches</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`searchable-select__item${o.value === value ? ' searchable-select__item--selected' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); commit(o) }}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
