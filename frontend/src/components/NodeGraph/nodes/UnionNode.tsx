import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { NodeExpandPanel, useNodeExpand } from '../nodeShared'
import '../NodeGraph.css'

const MIN_INPUTS = 2
const FIRST_HANDLE_TOP = 56
const ROW_HEIGHT = 28

export function UnionNode({ id }: NodeProps) {
  const [inputCount, setInputCount] = useState(MIN_INPUTS)
  const { setEdges } = useReactFlow()
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)

  const addInput = () => setInputCount((n) => n + 1)

  const removeInput = (index: number, e: React.MouseEvent) => {
    if (!e.altKey || inputCount <= MIN_INPUTS) return
    const handleId = `input-${index}`
    setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.targetHandle === handleId)))
    setInputCount((n) => n - 1)
  }

  return (
    <div className="node node--aggregation">
      <div className="node__header">
        <span>Union</span>
        <button className="node__expand-btn nodrag" onClick={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      <div className="node__body">
        {Array.from({ length: inputCount }, (_, i) => (
          <div key={i} className="node__pin-row">
            <Handle
              type="target"
              position={Position.Left}
              id={`input-${i}`}
              style={{ top: FIRST_HANDLE_TOP + i * ROW_HEIGHT }}
              onClick={(e) => removeInput(i, e as unknown as React.MouseEvent)}
            />
            <span className="node__pin-label">in {i + 1}</span>
          </div>
        ))}
        <button className="node__add-pin" onClick={addInput}>+ input</button>
      </div>
      {expanded && <NodeExpandPanel students={expandedStudents} />}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
