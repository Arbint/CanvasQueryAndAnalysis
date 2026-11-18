import { Handle, Position, useReactFlow, useStore, type NodeProps } from '@xyflow/react'
import type { Student } from '../../../api/types'
import { evaluateGraph, isSourceNodeType } from '../graphEngine'
import { NodeCountBadge, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

/** The students reaching this node, recomputed when the graph changes. */
function useOutputStudents(nodeId: string): Student[] | null {
  const { getNodes, getEdges } = useReactFlow()
  // Re-render on any node data or edge change so the list stays current.
  useStore((s) => s.nodes)
  useStore((s) => s.edges)
  const edges = getEdges()
  if (!edges.some((e) => e.target === nodeId)) return null
  const nodes = getNodes()
  const sourceStudents: Record<string, Student[]> = {}
  for (const n of nodes) {
    if (isSourceNodeType(n.type)) {
      sourceStudents[n.id] = ((n.data as Record<string, unknown>).students as Student[] | undefined) ?? []
    }
  }
  try {
    return evaluateGraph(nodes, edges, sourceStudents)[nodeId] ?? []
  } catch {
    return null
  }
}

/** The graph's single result: shows the student list of whatever connects to it. */
export function OutputNode({ id }: NodeProps) {
  const studentCount = useNodeStudentCount(id)
  const students = useOutputStudents(id)

  return (
    <div className="node node--output">
      <div className="node__header">
        <span>Output</span>
        <NodeCountBadge counts={studentCount} />
      </div>
      <div className="node__body">
        <div className="node__pin-row">
          <Handle type="target" position={Position.Left} id="input" style={{ top: 52 }} />
          <span className="node__pin-label">in</span>
        </div>
        {students === null ? (
          <p className="node__hint">Connect the graph's result here.</p>
        ) : (
          <div className="node__expand-panel node__output-panel">
            <div className="node__expand-count">{students.length} student{students.length !== 1 ? 's' : ''}</div>
            <ul className="node__expand-list nodrag nowheel">
              {students.map((s) => (
                <li key={s.id} className="node__expand-item">
                  {s.last_name}, {s.first_name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
