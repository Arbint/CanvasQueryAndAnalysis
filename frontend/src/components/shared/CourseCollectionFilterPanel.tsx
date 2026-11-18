import { useMemo } from 'react'
import type { Course } from '../../api/types'
import { courseMatchesFilters, type CourseCollectionFilters } from '../../lib/courseCollectionFilter'
import { useResolvedCollectionFilters } from '../../store/filterLibraryStore'
import { CollectionFilterBar } from './CollectionFilterBar'
import './CourseCollectionFilterPanel.css'

interface CourseCollectionFilterPanelProps {
  courses: Course[]
  filters: CourseCollectionFilters
  onChange: (filters: CourseCollectionFilters) => void
  actionLabel: string
  onAction: () => void
  actionDisabled?: boolean
  actionLoading?: boolean
  /** Set inside a React Flow node so drag handlers don't hijack pointer events. */
  nodrag?: boolean
  showCourseList?: boolean
}

export function CourseCollectionFilterPanel({
  courses,
  filters,
  onChange,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  nodrag = false,
  showCourseList = true,
}: CourseCollectionFilterPanelProps) {
  const dragCls = nodrag ? ' nodrag' : ''
  const resolved = useResolvedCollectionFilters(filters)

  const availableTerms = useMemo(
    () => [...new Set(courses.map((c) => c.term_name))].sort(),
    [courses],
  )

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, resolved)),
    [courses, resolved],
  )

  const toggleTerm = (term: string) => {
    onChange({
      ...filters,
      selectedTerms: filters.selectedTerms.includes(term)
        ? filters.selectedTerms.filter((t) => t !== term)
        : [...filters.selectedTerms, term],
    })
  }

  return (
    <div className="ccf-panel">
      <div className="collection-filter">
        <div className="collection-filter__label">Terms</div>
        <div className={`collection-terms${dragCls}`}>
          {availableTerms.length === 0 ? (
            <span className="collection-empty">Search courses first</span>
          ) : (
            availableTerms.map((term) => (
              <button
                key={term}
                className={`collection-term-chip${filters.selectedTerms.includes(term) ? ' collection-term-chip--active' : ''}`}
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
          className={dragCls.trim()}
          placeholder="e.g. ANGD"
          value={filters.department}
          onChange={(e) => onChange({ ...filters, department: e.target.value })}
        />
      </div>

      <div className="collection-filter">
        <div className="collection-filter__label">Filter</div>
        <CollectionFilterBar
          filter={resolved.filter}
          onChange={(filter) => onChange({ ...filters, filter })}
          nodrag={nodrag}
        />
      </div>

      <div className={`collection-collect-row${dragCls}`}>
        <span className="collection-section-label">
          {matchedCourses.length} course{matchedCourses.length !== 1 ? 's' : ''} matched
        </span>
        <button
          className="collection-collect-btn"
          onClick={onAction}
          disabled={actionDisabled || matchedCourses.length === 0}
        >
          {actionLoading ? 'Loading…' : actionLabel}
        </button>
      </div>

      {showCourseList && (
        <div className={`collection-course-list${dragCls}`}>
          {matchedCourses.length === 0 ? (
            <span className="collection-empty">No courses match filters</span>
          ) : (
            matchedCourses.map((c) => (
              <div key={c.id} className="collection-course-item" title={`${c.course_code} — ${c.term_name}`}>
                <span className="collection-course-name">{c.name}</span>
                <span className="collection-course-meta">
                  <span className="collection-course-code">{c.course_code}</span>
                  <span className="collection-course-term">{c.term_name}</span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
