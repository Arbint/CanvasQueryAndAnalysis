import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { api } from '../../../api/client'
import type { Student } from '../../../api/types'
import { useAppStore } from '../../../store/appStore'
import '../NodeGraph.css'

export interface CourseNodeData extends Record<string, unknown> {
  students?: Student[]
  selectedCourseId?: number
}

export function CourseNode({ data }: NodeProps) {
  const courses = useAppStore((s) => s.courses)
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>(
    (data as CourseNodeData).selectedCourseId ?? ''
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCourseId) return
    setLoading(true)
    api.getStudents(selectedCourseId as number)
      .then((students) => {
        ;(data as CourseNodeData).students = students
        ;(data as CourseNodeData).selectedCourseId = selectedCourseId as number
      })
      .finally(() => setLoading(false))
  }, [selectedCourseId])

  return (
    <div className="node node--course">
      <div className="node__header">Course</div>
      <div className="node__body">
        <select
          className="node__select"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <option value="" disabled>Select course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {loading && <span className="node__loading">Loading…</span>}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
