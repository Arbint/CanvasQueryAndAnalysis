import React, { useRef, useState } from 'react'
import './ChipInput.css'

interface ChipInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function ChipInput({ values, onChange, placeholder = 'Add...' }: ChipInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const openInput = () => {
    setEditing(true)
    setDraft('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
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
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') cancel()
  }

  return (
    <div className="chip-input">
      {values.map((v) => (
        <span key={v} className="chip">
          {v}
          <button
            className="chip__remove"
            onClick={() => remove(v)}
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      {editing ? (
        <input
          ref={inputRef}
          className="chip-input__field"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
        />
      ) : (
        <button className="chip-input__add" onClick={openInput} aria-label="Add item">
          +
        </button>
      )}
    </div>
  )
}
