import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { Course, Instructor } from '../../api/types'
import { courseMatchesFilters, emptyCourseCollectionFilters, type CourseCollectionFilters } from '../../lib/courseCollectionFilter'
import { useAppStore } from '../../store/appStore'
import { CourseCollectionFilterPanel } from '../shared/CourseCollectionFilterPanel'
import {
  buildGradeReport,
  courseSortKey,
  downloadGradeReportCSV,
  downloadGradeReportXLSX,
  isGradeInRange,
  rowInRange,
  sortGradeReportRows,
  type GradeReportData,
  type SortDir,
  type SortKey,
} from './gradeReportUtils'
import './GradeReport.css'

export function GradeReport() {
  const courses = useAppStore((s) => s.courses)
  const [filters, setFilters] = useState<CourseCollectionFilters>(emptyCourseCollectionFilters())
  const [report, setReport] = useState<GradeReportData | null>(null)
  const [instructors, setInstructors] = useState<Record<number, Instructor>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rangeMin, setRangeMin] = useState(0)
  const [rangeMax, setRangeMax] = useState(100)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [xlsxDownloading, setXlsxDownloading] = useState(false)

  const matchedCourses = useMemo(
    () => courses.filter((c) => courseMatchesFilters(c, filters)),
    [courses, filters],
  )

  const handleGenerateReport = async () => {
    if (loading || matchedCourses.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const [studentsByCourse, instructorEntries] = await Promise.all([
        Promise.all(matchedCourses.map(async (course: Course) => ({ course, students: await api.getStudents(course.id) }))),
        Promise.all(matchedCourses.map(async (course: Course) => {
          try {
            return [course.id, await api.getCourseInstructor(course.id)] as const
          } catch {
            // Instructor email can be permission-gated on the Canvas side (same
            // class of issue as feedback16's grade workaround) — fall back to
            // the name already on hand rather than failing the whole report.
            return [course.id, { name: course.instructor, email: null }] as const
          }
        })),
      ])
      setReport(buildGradeReport(matchedCourses, studentsByCourse))
      setInstructors(Object.fromEntries(instructorEntries))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const range = useMemo(
    () => ({ min: Math.min(rangeMin, rangeMax), max: Math.max(rangeMin, rangeMax) }),
    [rangeMin, rangeMax],
  )

  const visibleRows = useMemo(() => {
    if (!report) return []
    const inRange = report.rows.filter((row) => rowInRange(row, range.min, range.max))
    return sortGradeReportRows(inRange, report.courses, sortKey, sortDir)
  }, [report, range, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIcon = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅')

  const handleDownloadCSV = () => {
    if (!report) return
    downloadGradeReportCSV(report.courses, visibleRows, instructors)
  }

  const handleDownloadXLSX = async () => {
    if (!report || xlsxDownloading) return
    setXlsxDownloading(true)
    try {
      await downloadGradeReportXLSX(report.courses, visibleRows, instructors, range.min, range.max)
    } finally {
      setXlsxDownloading(false)
    }
  }

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
          <button
            className="btn btn--secondary"
            onClick={handleDownloadCSV}
            disabled={!report || visibleRows.length === 0}
          >
            Download CSV
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => void handleDownloadXLSX()}
            disabled={!report || visibleRows.length === 0 || xlsxDownloading}
          >
            {xlsxDownloading ? 'Downloading…' : 'Download XLSX'}
          </button>
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
                  <th className="grade-report__sticky-col" onClick={() => handleSort('name')}>
                    Name
                    <span className="grade-report__sort-icon">{sortIcon('name')}</span>
                  </th>
                  <th
                    className="grade-report__sticky-col grade-report__sticky-col--ssid"
                    onClick={() => handleSort('ssid')}
                  >
                    SSID
                    <span className="grade-report__sort-icon">{sortIcon('ssid')}</span>
                  </th>
                  <th onClick={() => handleSort('email')}>
                    Email
                    <span className="grade-report__sort-icon">{sortIcon('email')}</span>
                  </th>
                  {report.courses.map((c) => {
                    const instructor = instructors[c.id]
                    const key = courseSortKey(c.id)
                    return (
                      <th key={c.id} title={`${c.course_code} — ${c.term_name}`} onClick={() => handleSort(key)}>
                        <div className="grade-report__course-header">
                          <span className="grade-report__course-name">
                            {c.name}
                            <span className="grade-report__sort-icon">{sortIcon(key)}</span>
                          </span>
                          {instructor && (instructor.name || instructor.email) && (
                            <span className="grade-report__course-instructor">
                              {instructor.name ?? ''}
                              {instructor.name && instructor.email ? ' — ' : ''}
                              {instructor.email ?? ''}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.student.id}>
                    <td className="grade-report__sticky-col">{row.student.last_name}, {row.student.first_name}</td>
                    <td className="grade-report__sticky-col grade-report__sticky-col--ssid">{row.student.ssid}</td>
                    <td>{row.student.email}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={isGradeInRange(cell, range.min, range.max) ? 'grade-report__cell--in-range' : undefined}>
                        {cell ?? '—'}
                      </td>
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
