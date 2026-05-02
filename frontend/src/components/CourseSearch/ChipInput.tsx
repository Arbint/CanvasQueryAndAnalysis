import React, { useEffect, useRef, useState } from 'react'
import './ChipInput.css'

export interface Suggestion {
  label: string
  value: string
}

interface ChipInputProps {
  values: string[]
  onChange: (values: string[]) => void
  suggestions?: Suggestion[]
  placeholder?: string
}

export function ChipInput({ values, onChange, suggestions, placeholder = 'Add...' }: ChipInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = suggestions
    ? suggestions.filter(
        (s) => s.label.toLowerCase().includes(draft.toLowerCase()) && !values.includes(s.value)
      )
    : []

  const openInput = () => {
    setEditing(true)
    setDraft('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = (value?: string) => {
    const val = value ?? draft.trim()
    if (!val) { cancel(); return }
    if (!values.includes(val)) {
      onChange([...values, val])
    }
    setEditing(false)
    setDraft('')
  }

  const cancel = () => {
    setEditing(false)
    setDraft('')
  }

  const remove = (value: string) => {
    onChange(values.filter((v) => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { cancel(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions) {
        if (filtered.length > 0) commit(filtered[0].value)
      } else {
        commit()
      }
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!editing) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        cancel()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editing])

  const getLabel = (value: string) =>
    suggestions?.find((s) => s.value === value)?.label ?? value

  return (
    <div className="chip-input">
      {values.map((v) => (
        <span key={v} className="chip">
          {getLabel(v)}
          <button className="chip__remove" onClick={() => remove(v)} aria-label={`Remove ${getLabel(v)}`}>
            ×
          </button>
        </span>
      ))}

      {editing ? (
        <div className="chip-input__editor" ref={dropdownRef}>
          <input
            ref={inputRef}
            className="chip-input__field"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {suggestions && filtered.length > 0 && (
            <ul className="chip-input__suggestions">
              {filtered.map((s) => (
                <li key={s.value}>
                  <button
                    className="chip-input__suggestion-item"
                    onMouseDown={(e) => { e.preventDefault(); commit(s.value) }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button className="chip-input__add" onClick={openInput} aria-label="Add item">+</button>
      )}
    </div>
  )
}
