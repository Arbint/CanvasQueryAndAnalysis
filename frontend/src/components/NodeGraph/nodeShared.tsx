import { useCallback, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Student } from '../../api/types'
import { evaluateGraph } from './graphEngine'

export function useNodeExpand(nodeId: string) {
  const [expanded, setExpanded] = useState(false)
  const [expandedStudents, setExpandedStudents] = useState<Student[]>([])
  const { getNodes, getEdges } = useReactFlow()

  const toggleExpand = useCallback(() => {
    if (expanded) {
      setExpanded(false)
      return
    }
    const nodes = getNodes()
    const edges = getEdges()
    const courseStudents: Record<string, Student[]> = {}
    for (const n of nodes) {
      if (n.type === 'courseNode' || n.type === 'courseCollectionNode') {
        courseStudents[n.id] = ((n.data as Record<string, unknown>).students as Student[] | undefined) ?? []
      }
    }
    try {
      const results = evaluateGraph(nodes, edges, courseStudents as never)
      setExpandedStudents(results[nodeId] ?? [])
    } catch {
      setExpandedStudents([])
    }
    setExpanded(true)
  }, [expanded, nodeId, getNodes, getEdges])

  return { expanded, toggleExpand, expandedStudents }
}

export function NodeExpandPanel({ students }: { students: Student[] }) {
  return (
    <div className="node__expand-panel">
      <div className="node__expand-count">{students.length} student{students.length !== 1 ? 's' : ''}</div>
      <ul className="node__expand-list nodrag">
        {students.map((s) => (
          <li key={s.id} className="node__expand-item">
            {s.last_name}, {s.first_name}
          </li>
        ))}
      </ul>
    </div>
  )
}
