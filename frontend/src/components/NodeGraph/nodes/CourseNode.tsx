import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../api/client'
import type { Course, Student } from '../../../api/types'
import { useAppStore } from '../../../store/appStore'
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
  const filtered = courses.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  )

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
      className="course-select"
      ref={containerRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        className="course-select__trigger"
        onClick={() => { setOpen((o) => !o); setQuery('') }}
      >
        <span className="course-select__label">
          {selected ? selected.name : 'Select course…'}
        </span>
        <span className="course-select__arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="course-select__dropdown">
          <input
            ref={inputRef}
            className="course-select__search"
            placeholder="Search…"
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
                    onMouseDown={(e) => { e.preventDefault(); onChange(c.id); setOpen(false) }}
                  >
                    {c.name}
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

export function CourseNode({ data }: NodeProps) {
  const courses = useAppStore((s) => s.courses)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    (data as CourseNodeData).selectedCourseId ?? null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCourseId) return
    setLoading(true)
    api.getStudents(selectedCourseId)
      .then((students) => {
        ;(data as CourseNodeData).students = students
        ;(data as CourseNodeData).selectedCourseId = selectedCourseId
      })
      .finally(() => setLoading(false))
  }, [selectedCourseId])

  return (
    <div className="node node--course">
      <div className="node__header">Course</div>
      <div className="node__body">
        <SearchableSelect
          courses={courses}
          value={selectedCourseId}
          onChange={setSelectedCourseId}
        />
        {loading && <span className="node__loading">Loading students…</span>}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
