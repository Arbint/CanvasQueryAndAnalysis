import { useMemo } from 'react'
import type { Course } from '../../api/types'
import { courseMatchesFilters, type CourseCollectionFilters } from '../../lib/courseCollectionFilter'
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

  const availableTerms = useMemo(
    () => [...new Set(courses.map((c) => c.term_name))].sort(),
    [courses],
  )

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, filters)),
    [courses, filters],
  )

  const toggleTerm = (term: string) => {
    onChange({
      ...filters,
      selectedTerms: filters.selectedTerms.includes(term)
        ? filters.selectedTerms.filter((t) => t !== term)
        : [...filters.selectedTerms, term],
    })
  }

  const addIncludeFilter = () => onChange({ ...filters, includeFilters: [...filters.includeFilters, ''] })
  const updateIncludeFilter = (index: number, value: string) =>
    onChange({ ...filters, includeFilters: filters.includeFilters.map((f, i) => (i === index ? value : f)) })
  const removeIncludeFilter = (index: number) =>
    onChange({ ...filters, includeFilters: filters.includeFilters.filter((_, i) => i !== index) })

  const addExcludeFilter = () => onChange({ ...filters, excludeFilters: [...filters.excludeFilters, ''] })
  const updateExcludeFilter = (index: number, value: string) =>
    onChange({ ...filters, excludeFilters: filters.excludeFilters.map((f, i) => (i === index ? value : f)) })
  const removeExcludeFilter = (index: number) =>
    onChange({ ...filters, excludeFilters: filters.excludeFilters.filter((_, i) => i !== index) })

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
        <div className="collection-filter__label">Include Filters</div>
        <div className={`collection-filter-list${dragCls}`}>
          {filters.includeFilters.map((f, i) => (
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
        <button className={`collection-filter-add-btn${dragCls}`} onClick={addIncludeFilter}>
          + Add Include Filter
        </button>
      </div>

      <div className="collection-filter">
        <div className="collection-filter__label">Exclude Filters</div>
        <div className={`collection-filter-list${dragCls}`}>
          {filters.excludeFilters.map((f, i) => (
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
        <button className={`collection-filter-add-btn${dragCls}`} onClick={addExcludeFilter}>
          + Add Exclude Filter
        </button>
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
                <span className="collection-course-term">{c.term_name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
