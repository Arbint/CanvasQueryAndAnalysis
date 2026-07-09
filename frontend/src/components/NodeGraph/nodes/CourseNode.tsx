import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../api/client'
import type { Course, Student } from '../../../api/types'
import { useAppStore } from '../../../store/appStore'
import { NodeExpandPanel, useNodeExpand, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

export interface CourseNodeData extends Record<string, unknown> {
  students?: Student[]
  selectedCourseId?: number
}

interface SearchableSelectProps {
  courses: Course[]
  value: number | null
  onChange: (id: number) => void
}

function SearchableSelect({ courses, value, onChange }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = courses.find((c) => c.id === value)
  const filtered = courses.filter((c) => {
    const q = query.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.term_name.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q)
  })

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 0)
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      className="course-select nodrag"
      ref={containerRef}
    >
      <button
        className="course-select__trigger"
        onClick={() => { setOpen((o) => !o); setQuery('') }}
      >
        <span className="course-select__label">
          {selected ? (
            <>
              <span className="course-select__label-name">{selected.name}</span>
              <span className="course-select__label-instructor">{selected.instructor}</span>
              <span className="course-select__label-term">{selected.term_name}</span>
            </>
          ) : 'Select course…'}
        </span>
        <span className="course-select__arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="course-select__dropdown">
          <input
            ref={inputRef}
            className="course-select__search"
            placeholder="Search by name or term…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter' && filtered.length > 0) {
                onChange(filtered[0].id)
                setOpen(false)
              }
            }}
          />
          <ul className="course-select__list">
            {filtered.length === 0 ? (
              <li className="course-select__empty">No courses found</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    className={`course-select__option${c.id === value ? ' course-select__option--selected' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onChange(c.id); setOpen(false) }}
                  >
                    <span className="course-select__option-name">{c.name}</span>
                    <span className="course-select__option-instructor">{c.instructor}</span>
                    <span className="course-select__option-term">{c.term_name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function CourseNode({ id, data }: NodeProps) {
  const courses = useAppStore((s) => s.courses)
  const { setNodes } = useReactFlow()
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)
  const studentCount = useNodeStudentCount(id)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    (data as CourseNodeData).selectedCourseId ?? null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCourseId) return
    setNodes((nodes) => nodes.map((node) => (
      node.id === id
        ? { ...node, data: { ...node.data, selectedCourseId } }
        : node
    )))
    ;(data as CourseNodeData).selectedCourseId = selectedCourseId
    setLoading(true)
    api.getStudents(selectedCourseId)
      .then((students) => {
        setNodes((nodes) => nodes.map((node) => (
          node.id === id
            ? { ...node, data: { ...node.data, students, selectedCourseId } }
            : node
        )))
        ;(data as CourseNodeData).students = students
        ;(data as CourseNodeData).selectedCourseId = selectedCourseId
      })
      .finally(() => setLoading(false))
  }, [selectedCourseId])

  return (
    <div className="node node--course">
      <div className="node__header">
        <span>Course</span>
        {studentCount !== null && <span className={`node__count${studentCount < 10 ? ' node__count--low' : ''}`}>{studentCount}</span>}
        <button className="node__expand-btn nodrag" onClick={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      <div className="node__body">
        <SearchableSelect
          courses={courses}
          value={selectedCourseId}
          onChange={setSelectedCourseId}
        />
        {loading && <span className="node__loading">Loading students…</span>}
      </div>
      {expanded && <NodeExpandPanel students={expandedStudents} />}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
