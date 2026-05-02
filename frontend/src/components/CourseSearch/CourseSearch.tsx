import { useState } from 'react'
import { api } from '../../api/client'
import { useAppStore } from '../../store/appStore'
import { AccountDropdown } from './AccountDropdown'
import { ChipInput } from './ChipInput'
import { CourseList } from './CourseList'
import './CourseSearch.css'

export function CourseSearch() {
  const { selectedAccountId, courses, setCourses, updateCourseStudentCount } = useAppStore()
  const [semesters, setSemesters] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  const handleSearch = async () => {
    if (!selectedAccountId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getCourses({
        account_id: selectedAccountId,
        keywords,
      })
      setCourses(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleQueryCounts = async () => {
    if (courses.length === 0) return
    setCountLoading(true)
    try {
      await Promise.all(
        courses.map(async (course) => {
          const { count } = await api.getStudentCount(course.id)
          updateCourseStudentCount(course.id, count)
        })
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Count query failed')
    } finally {
      setCountLoading(false)
    }
  }

  return (
    <div className="course-search">
      <AccountDropdown />

      <div className="course-search__filters">
        <div className="course-search__filter-row">
          <span className="course-search__filter-label">Semester</span>
          <ChipInput values={semesters} onChange={setSemesters} placeholder="Search semester…" />
        </div>
        <div className="course-search__filter-row">
          <span className="course-search__filter-label">Keyword</span>
          <ChipInput values={keywords} onChange={setKeywords} placeholder="Search keyword…" />
        </div>
        <div className="course-search__actions">
          <button
            className="btn btn--primary"
            onClick={handleSearch}
            disabled={!selectedAccountId || loading}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button
            className="btn btn--secondary"
            onClick={handleQueryCounts}
            disabled={courses.length === 0 || countLoading}
          >
            {countLoading ? 'Counting…' : 'Query Student Count'}
          </button>
        </div>
      </div>

      <CourseList courses={courses} loading={loading} error={error} />
    </div>
  )
}
