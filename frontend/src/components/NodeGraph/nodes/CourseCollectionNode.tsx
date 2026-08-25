import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../../../api/client'
import type { Course, Student } from '../../../api/types'
import { union } from '../../../lib/setOperations'
import { useAppStore } from '../../../store/appStore'
import { NodeExpandPanel, useNodeExpand, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

export interface CourseCollectionNodeData extends Record<string, unknown> {
  students?: Student[]
  selectedTerms?: string[]
  department?: string
  includeFilters?: string[]
  excludeFilters?: string[]
}

function parseDepartment(courseCode: string): string {
  return courseCode.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
}

function parseCourseNumber(courseCode: string): string {
  return courseCode.match(/\d{4}/)?.[0] ?? courseCode.match(/\d+/)?.[0] ?? ''
}

function matchesWildcard(pattern: string, value: string): boolean {
  const regexStr = [...pattern]
    .map((c) => (c === '*' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${regexStr}$`).test(value)
}

function matchesAnyPattern(patterns: string[], value: string): boolean {
  return patterns.some((p) => !p.trim() || matchesWildcard(p.trim(), value))
}

function courseMatchesFilters(
  course: Course,
  selectedTerms: string[],
  department: string,
  includeFilters: string[],
  excludeFilters: string[],
): boolean {
  if (selectedTerms.length > 0 && !selectedTerms.includes(course.term_name)) return false
  if (department) {
    if (parseDepartment(course.course_code) !== department.trim().toUpperCase()) return false
  }
  const courseNum = parseCourseNumber(course.course_code)
  if (includeFilters.length > 0 && !matchesAnyPattern(includeFilters, courseNum)) return false
  if (excludeFilters.length > 0 && matchesAnyPattern(excludeFilters, courseNum)) return false
  return true
}

export function CourseCollectionNode({ id, data }: NodeProps) {
  const courses = useAppStore((s) => s.courses)
  const { setNodes } = useReactFlow()
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)
  const studentCount = useNodeStudentCount(id)
  const nodeData = data as CourseCollectionNodeData

  const [selectedTerms, setSelectedTerms] = useState<string[]>(nodeData.selectedTerms ?? [])
  const [department, setDepartment] = useState(nodeData.department ?? '')
  const [includeFilters, setIncludeFilters] = useState<string[]>(nodeData.includeFilters ?? [])
  const [excludeFilters, setExcludeFilters] = useState<string[]>(nodeData.excludeFilters ?? [])
  const [fetching, setFetching] = useState(false)
  const [, forceUpdate] = useState(0)
  const fetchCacheRef = useRef<Record<number, Student[]>>({})

  const availableTerms = useMemo(
    () => [...new Set(courses.map((c) => c.term_name))].sort(),
    [courses],
  )

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, selectedTerms, department, includeFilters, excludeFilters)),
    [courses, selectedTerms, department, includeFilters, excludeFilters],
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

  const updateFilters = (filters: Pick<CourseCollectionNodeData, 'selectedTerms' | 'department' | 'includeFilters' | 'excludeFilters'>) => {
    setSelectedTerms(filters.selectedTerms ?? [])
    setDepartment(filters.department ?? '')
    setIncludeFilters(filters.includeFilters ?? [])
    setExcludeFilters(filters.excludeFilters ?? [])
    setNodes((nodes) => nodes.map((node) => (
      node.id === id ? { ...node, data: { ...node.data, ...filters } } : node
    )))
  }

  const toggleTerm = (term: string) => {
    const nextTerms = selectedTerms.includes(term)
      ? selectedTerms.filter((t) => t !== term)
      : [...selectedTerms, term]
    updateFilters({ selectedTerms: nextTerms, department, includeFilters, excludeFilters })
  }

  const addIncludeFilter = () => {
    updateFilters({ selectedTerms, department, includeFilters: [...includeFilters, ''], excludeFilters })
  }

  const updateIncludeFilter = (index: number, value: string) => {
    const next = includeFilters.map((f, i) => (i === index ? value : f))
    updateFilters({ selectedTerms, department, includeFilters: next, excludeFilters })
  }

  const removeIncludeFilter = (index: number) => {
    updateFilters({ selectedTerms, department, includeFilters: includeFilters.filter((_, i) => i !== index), excludeFilters })
  }

  const addExcludeFilter = () => {
    updateFilters({ selectedTerms, department, includeFilters, excludeFilters: [...excludeFilters, ''] })
  }

  const updateExcludeFilter = (index: number, value: string) => {
    const next = excludeFilters.map((f, i) => (i === index ? value : f))
    updateFilters({ selectedTerms, department, includeFilters, excludeFilters: next })
  }

  const removeExcludeFilter = (index: number) => {
    updateFilters({ selectedTerms, department, includeFilters, excludeFilters: excludeFilters.filter((_, i) => i !== index) })
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
        <div className="collection-filter">
          <div className="collection-filter__label">Terms</div>
          <div className="collection-terms nodrag">
            {availableTerms.length === 0 ? (
              <span className="collection-empty">Search courses first</span>
            ) : (
              availableTerms.map((term) => (
                <button
                  key={term}
                  className={`collection-term-chip${selectedTerms.includes(term) ? ' collection-term-chip--active' : ''}`}
                  onClick={() => toggleTerm(term)}
                >
                  {term}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="collection-filter">
          <div className="collection-filter__label">Department</div>
          <input
            className="nodrag"
            placeholder="e.g. ANGD"
            value={department}
            onChange={(e) => updateFilters({ selectedTerms, department: e.target.value, includeFilters, excludeFilters })}
          />
        </div>

        <div className="collection-filter">
          <div className="collection-filter__label">Include Filters</div>
          <div className="collection-filter-list nodrag">
            {includeFilters.map((f, i) => (
              <div className="collection-filter-row" key={i}>
                <input
                  placeholder="e.g. 3*** or 3*7*"
                  value={f}
                  onChange={(e) => updateIncludeFilter(i, e.target.value)}
                />
                <button
                  className="collection-filter-remove"
                  onClick={() => removeIncludeFilter(i)}
                  aria-label="Remove include filter"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button className="collection-filter-add-btn nodrag" onClick={addIncludeFilter}>
            + Add Include Filter
          </button>
        </div>

        <div className="collection-filter">
          <div className="collection-filter__label">Exclude Filters</div>
          <div className="collection-filter-list nodrag">
            {excludeFilters.map((f, i) => (
              <div className="collection-filter-row" key={i}>
                <input
                  placeholder="e.g. 3*** or 3*7*"
                  value={f}
                  onChange={(e) => updateExcludeFilter(i, e.target.value)}
                />
                <button
                  className="collection-filter-remove"
                  onClick={() => removeExcludeFilter(i)}
                  aria-label="Remove exclude filter"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button className="collection-filter-add-btn nodrag" onClick={addExcludeFilter}>
            + Add Exclude Filter
          </button>
        </div>

        <div className="collection-collect-row nodrag">
          <span className="collection-section-label">
            {matchedCourses.length} course{matchedCourses.length !== 1 ? 's' : ''} matched
          </span>
          <button
            className="collection-collect-btn"
            onClick={handleCollect}
            disabled={fetching || matchedCourses.length === 0}
          >
            {fetching ? 'Loading…' : 'Collect'}
          </button>
        </div>

        <div className="collection-course-list nodrag">
          {matchedCourses.length === 0 ? (
            <span className="collection-empty">No courses match filters</span>
          ) : (
            matchedCourses.map((c) => (
              <div key={c.id} className="collection-course-item" title={`${c.course_code} — ${c.term_name}`}>
                <span className="collection-course-name">{c.name}</span>
                <span className="collection-course-term">{c.term_name}</span>
              </div>
            ))
          )}
        </div>
      </div>
      {expanded && <NodeExpandPanel students={expandedStudents} />}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}
