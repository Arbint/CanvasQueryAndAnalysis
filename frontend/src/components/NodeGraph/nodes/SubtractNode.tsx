import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import '../NodeGraph.css'

const MIN_SUBTRACT = 1
const FIRST_HANDLE_TOP = 56
const ROW_HEIGHT = 28

export function SubtractNode({ id }: NodeProps) {
  const [subtractCount, setSubtractCount] = useState(MIN_SUBTRACT)
  const { setEdges } = useReactFlow()

  const addSubtract = () => setSubtractCount((n) => n + 1)

  const removeSubtract = (index: number, e: React.MouseEvent) => {
    if (!e.altKey || subtractCount <= MIN_SUBTRACT) return
    const handleId = `subtract-${index}`
    setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.targetHandle === handleId)))
    setSubtractCount((n) => n - 1)
  }

  return (
    <div className="node node--aggregation">
      <div className="node__header">Subtract</div>
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
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
