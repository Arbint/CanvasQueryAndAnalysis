import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import '../NodeGraph.css'

const COLORS = [
  { id: 'amber', label: 'Amber', fill: 'rgba(230, 167, 61, 0.18)', border: 'rgba(230, 167, 61, 0.9)' },
  { id: 'blue', label: 'Blue', fill: 'rgba(83, 166, 255, 0.16)', border: 'rgba(83, 166, 255, 0.9)' },
  { id: 'green', label: 'Green', fill: 'rgba(92, 201, 133, 0.16)', border: 'rgba(92, 201, 133, 0.9)' },
  { id: 'rose', label: 'Rose', fill: 'rgba(236, 109, 133, 0.16)', border: 'rgba(236, 109, 133, 0.9)' },
]

type CommentBoxData = Record<string, unknown> & {
  label?: string
  color?: string
  childIds?: string[]
}

export function CommentBoxNode({ id, data, selected }: NodeProps) {
  const { setNodes } = useReactFlow()
  const nodeData = data as CommentBoxData
  const color = COLORS.find((candidate) => candidate.id === nodeData.color) ?? COLORS[0]
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(nodeData.label ?? 'Comment')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const updateData = (nextData: Partial<CommentBoxData>) => {
    setNodes((nodes) => nodes.map((node) => (
      node.id === id
        ? { ...node, data: { ...node.data, ...nextData } }
        : node
    )))
  }

  const commitLabel = () => {
    const label = draftLabel.trim() || 'Comment'
    setDraftLabel(label)
    updateData({ label })
    setEditing(false)
  }

  return (
    <div
      className="comment-box"
      style={{
        '--comment-box-fill': color.fill,
        '--comment-box-border': color.border,
      } as React.CSSProperties}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={120}
        color={color.border}
      />
      <div className="comment-box__title">
        {editing ? (
          <input
            ref={inputRef}
            className="comment-box__title-input nodrag"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onBlur={commitLabel}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitLabel()
              if (event.key === 'Escape') {
                setDraftLabel(nodeData.label ?? 'Comment')
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            className="comment-box__title-button"
            onDoubleClick={(event) => {
              event.stopPropagation()
              setEditing(true)
            }}
          >
            {nodeData.label ?? 'Comment'}
          </button>
        )}
        <div className="comment-box__colors nodrag">
          {COLORS.map((candidate) => (
            <button
              key={candidate.id}
              className={`comment-box__swatch${candidate.id === color.id ? ' comment-box__swatch--active' : ''}`}
              title={candidate.label}
              style={{ backgroundColor: candidate.border }}
              onClick={() => updateData({ color: candidate.id })}
            />
          ))}
        </div>
      </div>
      <div className="comment-box__body" />
    </div>
  )
}
