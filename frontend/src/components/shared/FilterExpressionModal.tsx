import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compileFilterExpression } from '../../lib/filterExpression'
import { useAppStore } from '../../store/appStore'
import { FilterExpressionEditor, HighlightedExpression } from './FilterExpressionEditor'
import '../CourseSearch/PresetEditorModal.css'
import './CollectionFilter.css'

interface FilterExpressionModalProps {
  title: string
  initialName?: string
  initialExpression?: string
  onSave: (name: string, expression: string) => void
  onCancel: () => void
  /** Shown for saved expressions: removes it from the library. */
  onDelete?: () => void
  /** Uses the expression as a temporary filter without adding it to the library. */
  onApply?: (name: string, expression: string) => void
  /** Makes Apply the primary action (and Ctrl+Enter); the name becomes optional. */
  preferApply?: boolean
}

/** Name given to a temporary filter left unnamed. */
export const TEMPORARY_FILTER_NAME = 'Temporary filter'

const SNIPPETS: { label: string; text: string; hint: string }[] = [
  { label: '$', text: '$', hint: 'Course code pattern: $2*3* (each * is one digit)' },
  { label: '@', text: '@', hint: 'Faculty name contains: @Jing' },
  { label: '#', text: '#', hint: 'Semester: #2025, #FA2025, #SP2025, #SU2025' },
  { label: 'and', text: ' and ', hint: 'Both must match' },
  { label: 'or', text: ' or ', hint: 'Either matches' },
  { label: 'not', text: 'not ', hint: 'Must not match' },
  { label: '( )', text: '()', hint: 'Group' },
]

const EXAMPLES = ['$2*3* or $2*6*', '($**7* or $**8*) and $3*** and @Jing and #2025']

/** Stops events reaching React ancestors (the node graph's Tab/Escape handling, card clicks). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** Pop-up for naming and writing a course collection filter expression. */
export function FilterExpressionModal({
  title,
  initialName = '',
  initialExpression = '',
  onSave,
  onCancel,
  onDelete,
  onApply,
  preferApply = false,
}: FilterExpressionModalProps) {
  const courses = useAppStore((s) => s.courses)
  const [name, setName] = useState(initialName)
  const [expression, setExpression] = useState(initialExpression)
  const nameRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const compiled = useMemo(() => compileFilterExpression(expression), [expression])
  const matched = useMemo(
    () => (compiled.error ? [] : courses.filter((c) => compiled.matches(c))),
    [courses, compiled],
  )
  const canApply = expression.trim().length > 0 && !compiled.error
  const canSave = canApply && name.trim().length > 0

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const save = () => {
    if (canSave) onSave(name.trim(), expression.trim())
  }

  const apply = () => {
    if (canApply && onApply) onApply(name.trim() || TEMPORARY_FILTER_NAME, expression.trim())
  }

  const primary = preferApply && onApply ? apply : save

  const insert = (text: string) => {
    const area = textareaRef.current
    const start = area?.selectionStart ?? expression.length
    const end = area?.selectionEnd ?? expression.length
    const next = expression.slice(0, start) + text + expression.slice(end)
    setExpression(next)
    // Place the caret after the inserted text (inside the parentheses for "()").
    const caret = start + (text === '()' ? 1 : text.length)
    requestAnimationFrame(() => {
      area?.focus()
      area?.setSelectionRange(caret, caret)
    })
  }

  return createPortal(
    <div
      className="preset-modal__backdrop"
      onMouseDown={(e) => {
        stop(e)
        if (e.target === e.currentTarget) onCancel()
      }}
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onWheel={stop}
      onKeyDown={(e) => {
        stop(e)
        if (e.key === 'Escape') onCancel()
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) primary()
      }}
    >
      <div className="preset-modal fx-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="preset-modal__title">{title}</h2>

        <label className="preset-modal__field">
          <span className="preset-modal__label">Name</span>
          <input
            ref={nameRef}
            className="preset-modal__name"
            value={name}
            placeholder={preferApply && onApply ? 'Optional unless you save it' : 'e.g. Upper-level game art, 2025'}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') primary() }}
          />
        </label>

        <div className="preset-modal__field">
          <span className="preset-modal__label">Expression</span>
          <FilterExpressionEditor
            value={expression}
            onChange={setExpression}
            error={compiled.error}
            textareaRef={textareaRef}
            placeholder="e.g. ($**7* or $**8*) and $3*** and @Jing and #2025"
          />
          <div className="fx-snippets">
            {SNIPPETS.map((s) => (
              <button key={s.label} type="button" className="fx-snippet" title={s.hint} onClick={() => insert(s.text)}>
                {s.label}
              </button>
            ))}
          </div>
          {compiled.error ? (
            <div className="fx-status fx-status--error" role="alert">{compiled.error.message}</div>
          ) : (
            <div className="fx-status">
              {expression.trim()
                ? `${matched.length} of ${courses.length} searched course${courses.length === 1 ? '' : 's'} match`
                : 'Type an expression.'}
            </div>
          )}
          {!compiled.error && expression.trim() && matched.length > 0 && (
            <ul className="fx-preview">
              {matched.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <span className="fx-preview__code">{c.course_code}</span>
                  <span className="fx-preview__name">{c.name}</span>
                  <span className="fx-preview__meta">{c.instructor} · {c.term_name}</span>
                </li>
              ))}
              {matched.length > 6 && <li className="fx-preview__more">and {matched.length - 6} more</li>}
            </ul>
          )}
        </div>

        <details className="fx-help">
          <summary>Syntax</summary>
          <ul>
            <li><span className="fx-tok fx-tok--code">$2*3*</span> course number pattern; each <code>*</code> is one character. With letters it also matches the department: <span className="fx-tok fx-tok--code">$GAMD3***</span></li>
            <li><span className="fx-tok fx-tok--faculty">@Jing</span> instructor name contains the text (quote spaces: <span className="fx-tok fx-tok--faculty">@"Jingtian Li"</span>)</li>
            <li><span className="fx-tok fx-tok--term">#2025</span> any term in 2025; <span className="fx-tok fx-tok--term">#FA2025</span> <span className="fx-tok fx-tok--term">#SP2025</span> <span className="fx-tok fx-tok--term">#SU2025</span> fall / spring / summer 2025</li>
            <li><span className="fx-tok fx-tok--operator">and</span> <span className="fx-tok fx-tok--operator">or</span> <span className="fx-tok fx-tok--operator">not</span> combine (not binds tightest, then and, then or); <span className="fx-tok fx-tok--paren">( )</span> group</li>
            {EXAMPLES.map((example) => (
              <li key={example} className="fx-help__example">
                <button type="button" className="fx-snippet" title="Use this example" onClick={() => setExpression(example)}>Use</button>
                <code><HighlightedExpression source={example} /></code>
              </li>
            ))}
          </ul>
        </details>

        <div className="preset-modal__actions">
          {onDelete && (
            <button className="btn btn--secondary fx-modal__delete" onClick={onDelete}>Delete</button>
          )}
          <button className="btn btn--secondary" onClick={onCancel}>Cancel</button>
          {onApply && (
            <button
              className={`btn ${preferApply ? 'btn--primary' : 'btn--secondary'}`}
              onClick={apply}
              disabled={!canApply}
              title={`Use this filter now without adding it to your saved expressions${preferApply ? ' (Ctrl+Enter)' : ''}`}
            >
              Apply without saving
            </button>
          )}
          <button
            className={`btn ${preferApply && onApply ? 'btn--secondary' : 'btn--primary'}`}
            onClick={save}
            disabled={!canSave}
            title={preferApply && onApply ? 'Save to your expressions and apply' : 'Save (Ctrl+Enter)'}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
