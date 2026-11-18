import { useMemo, useRef, type Ref } from 'react'
import { tokenizeFilterExpression, type FilterExpressionError } from '../../lib/filterExpression'
import './CollectionFilter.css'

/** Expression tokens as highlighted spans; `error` marks the tokens in that range. */
export function HighlightedExpression({ source, error }: { source: string; error?: FilterExpressionError | null }) {
  const tokens = useMemo(() => tokenizeFilterExpression(source), [source])
  return (
    <>
      {tokens.map((t) => {
        const inError = error && error.end > error.start && t.start < error.end && t.end > error.start && t.type !== 'space'
        return (
          <span key={t.start} className={`fx-tok fx-tok--${t.type}${inError ? ' fx-tok--error-range' : ''}`}>
            {t.text}
          </span>
        )
      })}
    </>
  )
}

interface FilterExpressionEditorProps {
  value: string
  onChange: (value: string) => void
  error: FilterExpressionError | null
  textareaRef?: Ref<HTMLTextAreaElement>
  placeholder?: string
}

/**
 * Text area with syntax highlighting: a transparent textarea typed into,
 * over a highlighted copy of the same text in identical font and padding.
 */
export function FilterExpressionEditor({ value, onChange, error, textareaRef, placeholder }: FilterExpressionEditorProps) {
  const highlightRef = useRef<HTMLPreElement>(null)
  return (
    <div className="fx-editor">
      <pre className="fx-editor__highlight" ref={highlightRef} aria-hidden="true">
        <HighlightedExpression source={value} error={error} />
        {/* Keeps a trailing newline's height in sync with the textarea. */}
        {'\n'}
      </pre>
      <textarea
        ref={textareaRef}
        className="fx-editor__input"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        rows={4}
        aria-label="Filter expression"
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (highlightRef.current) {
            highlightRef.current.scrollTop = e.currentTarget.scrollTop
            highlightRef.current.scrollLeft = e.currentTarget.scrollLeft
          }
        }}
      />
    </div>
  )
}
