import { CourseGrades } from '../CourseGrades/CourseGrades'
import { GradeReport } from '../GradeReport/GradeReport'
import { NodeGraph } from '../NodeGraph/NodeGraph'
import { StudentAudit } from '../StudentAudit/StudentAudit'
import { TrendAnalysis } from '../TrendAnalysis/TrendAnalysis'
import { useAppStore, type WorkTab } from '../../store/appStore'
import './WorkingArea.css'

const TABS: { key: WorkTab; label: string }[] = [
  { key: 'aggregation', label: 'Aggregation Graph' },
  { key: 'trend', label: 'Trend Analysis' },
  { key: 'audit', label: 'Student Course Audit' },
  { key: 'gradeReport', label: 'Grade Reporter' },
  { key: 'courseGrades', label: 'Course Grade Display' },
]

export function WorkingArea() {
  const activeTab = useAppStore((s) => s.activeWorkTab)
  const setActiveTab = useAppStore((s) => s.setActiveWorkTab)

  const panelClass = (tab: WorkTab) =>
    activeTab === tab ? 'working-area__panel working-area__panel--active' : 'working-area__panel'

  return (
    <div className="working-area">
      <div className="working-area__tabs" role="tablist" aria-label="Working area">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`working-area__tab${activeTab === key ? ' working-area__tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="working-area__content">
        <div className={panelClass('aggregation')}>
          <NodeGraph />
        </div>
        <div className={panelClass('trend')}>
          <TrendAnalysis />
        </div>
        <div className={panelClass('audit')}>
          <StudentAudit />
        </div>
        <div className={panelClass('gradeReport')}>
          <GradeReport />
        </div>
        <div className={panelClass('courseGrades')}>
          <CourseGrades active={activeTab === 'courseGrades'} />
        </div>
      </div>
    </div>
  )
}
