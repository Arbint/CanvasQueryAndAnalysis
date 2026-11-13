import { useEffect, useRef, useState } from 'react'
import { ChipInput, type Suggestion } from './ChipInput'
import './PresetEditorModal.css'

interface PresetEditorModalProps {
  title: string
  initialName?: string
  /** Entries pre-filled into the filter (e.g. the current selection). */
  initialValues: string[]
  suggestions: Suggestion[]
  placeholder: string
  onSave: (name: string, values: string[]) => void
  onCancel: () => void
}

/** Pop-up for naming a preset and choosing its filter entries. */
export function PresetEditorModal({
  title,
  initialName = '',
  initialValues,
  suggestions,
  placeholder,
  onSave,
  onCancel,
}: PresetEditorModalProps) {
  const [name, setName] = useState(initialName)
  const [values, setValues] = useState<string[]>(initialValues)
  const nameRef = useRef<HTMLInputElement>(null)
  const canSave = name.trim().length > 0 && values.length > 0

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const save = () => {
    if (canSave) onSave(name.trim(), values)
  }

  return (
    <div
      className="preset-modal__backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
      onKeyDown={(e) => { if (e.key === 'Escape' && e.target === nameRef.current) onCancel() }}
    >
      <div className="preset-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="preset-modal__title">{title}</h2>

        <label className="preset-modal__field">
          <span className="preset-modal__label">Name</span>
          <input
            ref={nameRef}
            className="preset-modal__name"
            value={name}
            placeholder="e.g. Fall terms"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
        </label>

        <div className="preset-modal__field">
          <span className="preset-modal__label">Filters</span>
          <ChipInput
            values={values}
            onChange={setValues}
            suggestions={suggestions}
            placeholder={placeholder}
          />
        </div>

        <div className="preset-modal__actions">
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={save} disabled={!canSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
