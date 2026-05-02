import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../api/client'
import type { Course, Student } from '../../../api/types'
import { union } from '../../../lib/setOperations'
import { useAppStore } from '../../../store/appStore'
import { NodeExpandPanel, useNodeExpand, useNodeStudentCount } from '../nodeShared'
import '../NodeGraph.css'

export interface CourseCollectionNodeData extends Record<string, unknown> {
  students?: Student[]
}

function parseDepartment(courseCode: string): string {
  return courseCode.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
}

function parseCourseNumber(courseCode: string): string {
  return courseCode.match(/\d{4}/)?.[0] ?? courseCode.match(/\d+/)?.[0] ?? ''
}

function matchesWildcard(pattern: string, value: string): boolean {
  // Each * matches exactly one character
  const regexStr = [...pattern]
    .map((c) => (c === '*' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${regexStr}$`).test(value)
}

function courseMatchesFilters(
  course: Course,
  selectedTerms: string[],
  department: string,
  numberPattern: string,
): boolean {
  if (selectedTerms.length > 0 && !selectedTerms.includes(course.term_name)) return false
  if (department) {
    if (parseDepartment(course.course_code) !== department.trim().toUpperCase()) return false
  }
  if (numberPattern.trim()) {
    const courseNum = parseCourseNumber(course.course_code)
    if (!matchesWildcard(numberPattern.trim(), courseNum)) return false
  }
  return true
}

export function CourseCollectionNode({ id, data }: NodeProps) {
  const courses = useAppStore((s) => s.courses)
  const { expanded, toggleExpand, expandedStudents } = useNodeExpand(id)
  const studentCount = useNodeStudentCount(id)

  const [selectedTerms, setSelectedTerms] = useState<string[]>([])
  const [department, setDepartment] = useState('')
  const [numberPattern, setNumberPattern] = useState('')
  const [fetchedStudents, setFetchedStudents] = useState<Record<number, Student[]>>({})
  const [fetching, setFetching] = useState(false)

  const availableTerms = useMemo(
    () => [...new Set(courses.map((c) => c.term_name))].sort(),
    [courses],
  )

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, selectedTerms, department, numberPattern)),
    [courses, selectedTerms, department, numberPattern],
  )

  useEffect(() => {
    const missing = matchedCourses.filter((c) => !(c.id in fetchedStudents))
    if (missing.length === 0) return
    setFetching(true)
    Promise.all(missing.map(async (c) => ({ id: c.id, students: await api.getStudents(c.id) })))
      .then((results) => {
        setFetchedStudents((prev) => {
          const next = { ...prev }
          for (const r of results) next[r.id] = r.students
          return next
        })
      })
      .finally(() => setFetching(false))
  }, [matchedCourses])

  useEffect(() => {
    const lists = matchedCourses.map((c) => fetchedStudents[c.id] ?? [])
    ;(data as CourseCollectionNodeData).students = lists.length > 0 ? union(...lists) : []
  }, [matchedCourses, fetchedStudents])

  const toggleTerm = (term: string) =>
    setSelectedTerms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term],
    )

  const pendingCount = matchedCourses.filter((c) => !(c.id in fetchedStudents)).length

  return (
    <div className="node node--collection">
      <div className="node__header">
        <span>Course Collection</span>
        {studentCount !== null && <span className="node__count">{studentCount}</span>}
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
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>

        <div className="collection-filter">
          <div className="collection-filter__label">Course Number</div>
          <input
            className="nodrag"
            placeholder="e.g. 3*** or 3*7*"
            value={numberPattern}
            onChange={(e) => setNumberPattern(e.target.value)}
          />
        </div>

        <div className="collection-section-label">
          {matchedCourses.length} course{matchedCourses.length !== 1 ? 's' : ''} matched
          {fetching && pendingCount > 0 && ` · loading ${pendingCount}…`}
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
