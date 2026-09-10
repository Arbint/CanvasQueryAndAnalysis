import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NodeCountBadge, NodeExpandPanel, useNodeExpand, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

const HANDLE_A_TOP = 68
const HANDLE_B_TOP = 96

export function DiffNode({ id }: NodeProps) {
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)
  const studentCount = useNodeStudentCount(id)

  return (
    <div className="node node--aggregation">
      <div className="node__header">
        <span>Diff</span>
        <NodeCountBadge counts={studentCount} />
        <button className="node__expand-btn nodrag" onClick={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      <div className="node__body">
        <div className="node__pin-row">
          <Handle type="target" position={Position.Left} id="a" style={{ top: HANDLE_A_TOP }} />
          <span className="node__pin-label">A</span>
        </div>
        <div className="node__pin-row">
          <Handle type="target" position={Position.Left} id="b" style={{ top: HANDLE_B_TOP }} />
          <span className="node__pin-label">B</span>
        </div>
        <p className="node__hint">A ∆ B — in one but not both</p>
      </div>
      {expanded && <NodeExpandPanel students={expandedStudents} />}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
