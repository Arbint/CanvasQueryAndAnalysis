import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Course } from '../../api/types'
import { courseMatchesFilters, emptyCourseCollectionFilters, type CourseCollectionFilters } from '../../lib/courseCollectionFilter'
import { useAppStore } from '../../store/appStore'
import { CourseCollectionFilterPanel } from '../shared/CourseCollectionFilterPanel'
import { buildGradeReport, rowInRange, type GradeReportData } from './gradeReportUtils'
import './GradeReport.css'

export function GradeReport() {
  const courses = useAppStore((s) => s.courses)
  const [filters, setFilters] = useState<CourseCollectionFilters>(emptyCourseCollectionFilters())
  const [report, setReport] = useState<GradeReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rangeMin, setRangeMin] = useState(0)
  const [rangeMax, setRangeMax] = useState(100)

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, filters)),
    [courses, filters],
  )

  const handleGenerateReport = async () => {
    if (loading || matchedCourses.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const studentsByCourse = await Promise.all(
        matchedCourses.map(async (course: Course) => ({ course, students: await api.getStudents(course.id) })),
      )
      setReport(buildGradeReport(matchedCourses, studentsByCourse))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const visibleRows = useMemo(() => {
    if (!report) return []
    const min = Math.min(rangeMin, rangeMax)
    const max = Math.max(rangeMin, rangeMax)
    return report.rows.filter((row) => rowInRange(row, min, max))
  }, [report, rangeMin, rangeMax])

  return (
    <div className="grade-report">
      <div className="grade-report__filter-column">
        <div className="grade-report__section-title">Filter Column</div>
        <CourseCollectionFilterPanel
          courses={courses}
          filters={filters}
          onChange={setFilters}
          actionLabel="Generate Report"
          onAction={() => void handleGenerateReport()}
          actionDisabled={loading}
          actionLoading={loading}
        />
        {error && <div className="grade-report__error">{error}</div>}
      </div>

      <div className="grade-report__grade-column">
        <div className="grade-report__toolbar">
          <span className="grade-report__section-title">Grade Column</span>
          <div className="grade-report__range">
            <span>Grade range</span>
            <input
              type="number"
              min={0}
              max={100}
              value={rangeMin}
              onChange={(e) => setRangeMin(Number(e.target.value))}
            />
            <span>% to</span>
            <input
              type="number"
              min={0}
              max={100}
              value={rangeMax}
              onChange={(e) => setRangeMax(Number(e.target.value))}
            />
            <span>%</span>
          </div>
          {report && (
            <span className="grade-report__count">
              {visibleRows.length} of {report.rows.length} student{report.rows.length !== 1 ? 's' : ''} shown
            </span>
          )}
        </div>

        <div className="grade-report__table-wrap">
          {!report ? (
            <div className="grade-report__state">
              Configure filters and click Generate Report.
            </div>
          ) : report.courses.length === 0 ? (
            <div className="grade-report__state">No courses matched the filters.</div>
          ) : visibleRows.length === 0 ? (
            <div className="grade-report__state">No students in this grade range.</div>
          ) : (
            <table className="grade-report__table">
              <thead>
                <tr>
                  <th className="grade-report__sticky-col">Name</th>
                  <th className="grade-report__sticky-col grade-report__sticky-col--ssid">SSID</th>
                  {report.courses.map((c) => (
                    <th key={c.id} title={`${c.course_code} — ${c.term_name}`}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.student.id}>
                    <td className="grade-report__sticky-col">{row.student.last_name}, {row.student.first_name}</td>
                    <td className="grade-report__sticky-col grade-report__sticky-col--ssid">{row.student.ssid}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i}>{cell ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
