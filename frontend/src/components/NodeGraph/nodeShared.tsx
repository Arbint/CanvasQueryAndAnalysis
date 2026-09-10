import { useCallback, useState } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import type { Student } from '../../api/types'
import { evaluateGraph } from './graphEngine'

export interface NodeStudentCounts {
  active: number
  inactive: number
  total: number
}

function countStudents(students: Student[]): NodeStudentCounts {
  const active = students.filter((s) => s.enrollment_state === 'active').length
  return { active, inactive: students.length - active, total: students.length }
}

export function useNodeStudentCount(nodeId: string): NodeStudentCounts | null {
  const { getNodes, getEdges } = useReactFlow()
  // Re-run whenever edges are added/removed so operation nodes stay current
  useStore((s) => s.edges.length)

  const nodes = getNodes()
  const edges = getEdges()
  const thisNode = nodes.find((n) => n.id === nodeId)
  if (!thisNode) return null

  if (thisNode.type === 'courseNode' || thisNode.type === 'courseCollectionNode') {
    const students = (thisNode.data as Record<string, unknown>).students as Student[] | undefined
    return students ? countStudents(students) : null
  }

  // Operation nodes: only show count when at least one input is connected
  if (!edges.some((e) => e.target === nodeId)) return null

  const courseStudents: Record<string, Student[]> = {}
  for (const n of nodes) {
    if (n.type === 'courseNode' || n.type === 'courseCollectionNode') {
      courseStudents[n.id] = ((n.data as Record<string, unknown>).students as Student[] | undefined) ?? []
    }
  }
  try {
    const results = evaluateGraph(nodes, edges, courseStudents as never)
    const students = results[nodeId]
    return students ? countStudents(students) : null
  } catch {
    return null
  }
}

export function NodeCountBadge({ counts }: { counts: NodeStudentCounts | null }) {
  if (!counts) return null
  return (
    <span className="node__count-stack" title={`${counts.active} active / ${counts.inactive} inactive`}>
      <span className="node__count-row node__count-row--active">A {counts.active}</span>
      <span className="node__count-row node__count-row--inactive">I {counts.inactive}</span>
      <span className={`node__count-row node__count-row--total${counts.total < 10 ? ' node__count--low' : ''}`}>T {counts.total}</span>
    </span>
  )
}

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
