import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../../../api/client'
import type { Student } from '../../../api/types'
import { courseMatchesFilters, type CourseCollectionFilters } from '../../../lib/courseCollectionFilter'
import { union } from '../../../lib/setOperations'
import { useAppStore } from '../../../store/appStore'
import { CourseCollectionFilterPanel } from '../../shared/CourseCollectionFilterPanel'
import { NodeExpandPanel, useNodeExpand, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

export interface CourseCollectionNodeData extends Record<string, unknown> {
  students?: Student[]
  selectedTerms?: string[]
  department?: string
  includeFilters?: string[]
  excludeFilters?: string[]
}

export function CourseCollectionNode({ id, data }: NodeProps) {
  const courses = useAppStore((s) => s.courses)
  const { setNodes } = useReactFlow()
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)
  const studentCount = useNodeStudentCount(id)
  const nodeData = data as CourseCollectionNodeData

  const [filters, setFilters] = useState<CourseCollectionFilters>({
    selectedTerms: nodeData.selectedTerms ?? [],
    department: nodeData.department ?? '',
    includeFilters: nodeData.includeFilters ?? [],
    excludeFilters: nodeData.excludeFilters ?? [],
  })
  const [fetching, setFetching] = useState(false)
  const [, forceUpdate] = useState(0)
  const fetchCacheRef = useRef<Record<number, Student[]>>({})

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, filters)),
    [courses, filters],
  )

  const handleCollect = async () => {
    if (fetching || matchedCourses.length === 0) return
    const missing = matchedCourses.filter((c) => !(c.id in fetchCacheRef.current))
    setFetching(true)
    try {
      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map(async (c) => ({ id: c.id, students: await api.getStudents(c.id) })),
        )
        for (const r of results) fetchCacheRef.current[r.id] = r.students
      }
      const lists = matchedCourses.map((c) => fetchCacheRef.current[c.id] ?? [])
      const students = lists.length > 0 ? union(...lists) : []
      setNodes((nodes) => nodes.map((node) => (
        node.id === id ? { ...node, data: { ...node.data, students } } : node
      )))
      nodeData.students = students
      forceUpdate((n) => n + 1)
    } finally {
      setFetching(false)
    }
  }

  const updateFilters = (next: CourseCollectionFilters) => {
    setFilters(next)
    setNodes((nodes) => nodes.map((node) => (
      node.id === id ? { ...node, data: { ...node.data, ...next } } : node
    )))
  }

  return (
    <div className="node node--collection">
      <div className="node__header">
        <span>Course Collection</span>
        {studentCount !== null && <span className={`node__count${studentCount < 10 ? ' node__count--low' : ''}`}>{studentCount}</span>}
        <button className="node__expand-btn nodrag" onClick={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      <div className="node__body">
        <CourseCollectionFilterPanel
          courses={courses}
          filters={filters}
          onChange={updateFilters}
          actionLabel="Collect"
          onAction={handleCollect}
          actionDisabled={fetching}
          actionLoading={fetching}
          nodrag
        />
      </div>
      {expanded && <NodeExpandPanel students={expandedStudents} />}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
