import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { NodeExpandPanel, useNodeExpand, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

const MIN_SUBTRACT = 1
const FIRST_HANDLE_TOP = 56
const ROW_HEIGHT = 28

export function SubtractNode({ id, data }: NodeProps) {
  const [subtractCount, setSubtractCount] = useState(Number(data.subtractCount ?? MIN_SUBTRACT))
  const { setEdges, setNodes } = useReactFlow()
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)
  const studentCount = useNodeStudentCount(id)

  const setPersistedSubtractCount = (nextCount: number) => {
    setSubtractCount(nextCount)
    setNodes((nodes) => nodes.map((node) => (
      node.id === id ? { ...node, data: { ...node.data, subtractCount: nextCount } } : node
    )))
  }

  const addSubtract = () => setPersistedSubtractCount(subtractCount + 1)

  const removeSubtract = (index: number, e: React.MouseEvent) => {
    if (!e.altKey || subtractCount <= MIN_SUBTRACT) return
    const handleId = `subtract-${index}`
    setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.targetHandle === handleId)))
    setPersistedSubtractCount(subtractCount - 1)
  }

  return (
    <div className="node node--aggregation">
      <div className="node__header">
        <span>Subtract</span>
        {studentCount !== null && <span className={`node__count${studentCount < 10 ? ' node__count--low' : ''}`}>{studentCount}</span>}
        <button className="node__expand-btn nodrag" onClick={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      <div className="node__body">
        {/* "from" is row 0 */}
        <div className="node__pin-row">
          <Handle
            type="target"
            position={Position.Left}
            id="from"
            style={{ top: FIRST_HANDLE_TOP }}
          />
          <span className="node__pin-label">from</span>
        </div>
        {/* subtract inputs start at row 1 */}
        {Array.from({ length: subtractCount }, (_, i) => (
          <div key={i} className="node__pin-row">
            <Handle
              type="target"
              position={Position.Left}
              id={`subtract-${i}`}
              style={{ top: FIRST_HANDLE_TOP + (i + 1) * ROW_HEIGHT }}
              onClick={(e) => removeSubtract(i, e as unknown as React.MouseEvent)}
            />
            <span className="node__pin-label">subtract {i + 1}</span>
          </div>
        ))}
        <button className="node__add-pin" onClick={addSubtract}>+ subtract</button>
      </div>
      {expanded && <NodeExpandPanel students={expandedStudents} />}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
