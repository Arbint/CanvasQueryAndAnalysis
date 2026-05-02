import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import '../NodeGraph.css'

const MIN_SUBTRACT_INPUTS = 1

export function SubtractNode({ id }: NodeProps) {
  const [subtractCount, setSubtractCount] = useState(MIN_SUBTRACT_INPUTS)
  const { setEdges } = useReactFlow()

  const addSubtract = () => setSubtractCount((n) => n + 1)

  const removeSubtract = (index: number, e: React.MouseEvent) => {
    if (!e.altKey || subtractCount <= MIN_SUBTRACT_INPUTS) return
    const handleId = `subtract-${index}`
    setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.targetHandle === handleId)))
    setSubtractCount((n) => n - 1)
  }

  return (
    <div className="node node--aggregation">
      <div className="node__header">Subtract</div>
      <div className="node__body">
        <div className="node__pin-row">
          <Handle type="target" position={Position.Left} id="from" style={{ top: '40px' }} />
          <span className="node__pin-label">from</span>
        </div>
        {Array.from({ length: subtractCount }, (_, i) => (
          <div key={i} className="node__pin-row">
            <Handle
              type="target"
              position={Position.Left}
              id={`subtract-${i}`}
              style={{ top: `${68 + i * 28}px` }}
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
