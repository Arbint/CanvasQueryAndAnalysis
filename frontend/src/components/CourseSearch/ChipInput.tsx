import React, { useEffect, useRef, useState } from 'react'
import './ChipInput.css'

export interface Suggestion {
  label: string
  value: string
}

export interface ChipPresetItem {
  id: string
  name: string
  /** Short summary shown under the name (e.g. the entries it applies). */
  detail?: string
}

export interface ChipPresets {
  items: ChipPresetItem[]
  onApply: (id: string) => void
  onAddNew: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

interface ChipInputProps {
  values: string[]
  onChange: (values: string[]) => void
  suggestions?: Suggestion[]
  placeholder?: string
  /** When given, the dropdown gets a "Presets" entry opening a preset sub menu. */
  presets?: ChipPresets
}

export function ChipInput({ values, onChange, suggestions, placeholder = 'Add...', presets }: ChipInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuView, setMenuView] = useState<'suggestions' | 'presets'>('suggestions')
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
    setMenuView('suggestions')
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
    setMenuView('suggestions')
  }

  const applyPreset = (id: string) => {
    presets?.onApply(id)
    cancel()
  }

  const addNewPreset = () => {
    cancel()
    presets?.onAddNew()
  }

  const editPreset = (id: string) => {
    cancel()
    presets?.onEdit(id)
  }

  const remove = (value: string) => {
    onChange(values.filter((v) => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (menuView === 'presets') setMenuView('suggestions')
      else cancel()
      return
    }
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
      // composedPath() is captured at dispatch time, so it still counts a click
      // as inside even when the clicked item was unmounted by its own handler
      // (e.g. switching between the suggestion list and the preset sub menu).
      if (dropdownRef.current && !e.composedPath().includes(dropdownRef.current)) {
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
          {presets && menuView === 'presets' && (
            <ul className="chip-input__suggestions">
              <li>
                <button
                  className="chip-input__suggestion-item chip-input__menu-nav"
                  onMouseDown={(e) => { e.preventDefault(); setMenuView('suggestions') }}
                >
                  ‹ Back
                </button>
              </li>
              <li>
                <button
                  className="chip-input__suggestion-item chip-input__preset-add"
                  onMouseDown={(e) => { e.preventDefault(); addNewPreset() }}
                >
                  + Add new preset…
                </button>
              </li>
              {presets.items.length === 0 ? (
                <li className="chip-input__menu-empty">No presets yet</li>
              ) : (
                presets.items.map((p) => (
                  <li key={p.id} className="chip-input__preset-row">
                    <button
                      className="chip-input__suggestion-item chip-input__preset-apply"
                      title="Apply this preset"
                      onMouseDown={(e) => { e.preventDefault(); applyPreset(p.id) }}
                    >
                      <span className="chip-input__preset-name">{p.name}</span>
                      {p.detail && <span className="chip-input__preset-detail">{p.detail}</span>}
                    </button>
                    <button
                      className="chip-input__preset-edit"
                      title="Edit preset"
                      aria-label={`Edit preset ${p.name}`}
                      onMouseDown={(e) => { e.preventDefault(); editPreset(p.id) }}
                    >
                      Edit
                    </button>
                    <button
                      className="chip-input__preset-delete"
                      title="Delete preset"
                      aria-label={`Delete preset ${p.name}`}
                      onMouseDown={(e) => { e.preventDefault(); presets.onDelete(p.id) }}
                    >
                      ×
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          {menuView === 'suggestions' && suggestions && (filtered.length > 0 || presets) && (
            <ul className="chip-input__suggestions">
              {presets && (
                <li>
                  <button
                    className="chip-input__suggestion-item chip-input__menu-nav"
                    onMouseDown={(e) => { e.preventDefault(); setMenuView('presets') }}
                  >
                    <span>Presets</span>
                    <span aria-hidden="true">›</span>
                  </button>
                </li>
              )}
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
