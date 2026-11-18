import { useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ResizableColumns } from './components/layout/ResizableColumns'
import { CourseSearch } from './components/CourseSearch/CourseSearch'
import { WorkingArea } from './components/WorkingArea/WorkingArea'
import { StudentList } from './components/StudentList/StudentList'
import { LoadProgressModal } from './components/shared/LoadProgressModal'
import {
  cleanGraphSnapshot,
  cleanTrendAnalyses,
  isEmptySession,
  readAutosave,
  writeAutosave,
} from './lib/sessionPersistence'
import type { SavedSession } from './store/appStore'
import { useAppStore } from './store/appStore'
import './App.css'

export function App() {
  const {
    selectedAccountId,
    courseSearchSettings,
    graphSnapshot,
    trendAnalyses,
    pendingSessionLoad,
    setPendingSessionLoad,
    pendingGraphSnapshot,
    pendingTrendAnalyses,
    loadStatus,
    setLoadStatus,
  } = useAppStore()

  const buildSession = (): SavedSession => ({
    version: 1,
    savedAt: new Date().toISOString(),
    courseSearch: {
      selectedAccountId,
      selectedTermIds: courseSearchSettings.selectedTermIds,
      keywords: courseSearchSettings.keywords,
    },
    graph: cleanGraphSnapshot(graphSnapshot),
    trend: {
      analyses: cleanTrendAnalyses(trendAnalyses),
    },
  })

  // On page load, restore the auto-saved session (if any). Auto-saving stays
  // off until that restore has finished, so the empty startup state can't
  // overwrite the saved one.
  const [autosaveReady, setAutosaveReady] = useState(false)
  const restoreRequestedRef = useRef(false)
  useEffect(() => {
    if (restoreRequestedRef.current) return
    restoreRequestedRef.current = true
    const saved = readAutosave()
    if (saved && !isEmptySession(saved)) {
      setLoadStatus('Restoring previous work...')
      // Restore the previous work and search settings, but don't run the course
      // search on launch: the user presses Search when ready.
      setPendingSessionLoad(saved, { search: false })
    } else {
      setAutosaveReady(true)
    }
  }, [setLoadStatus, setPendingSessionLoad])

  const restoring = Boolean(pendingSessionLoad || pendingGraphSnapshot || pendingTrendAnalyses || loadStatus)
  useEffect(() => {
    if (!autosaveReady && restoreRequestedRef.current && !restoring) setAutosaveReady(true)
  }, [autosaveReady, restoring])

  useEffect(() => {
    if (!autosaveReady || restoring) return
    const timer = window.setTimeout(() => writeAutosave(buildSession()), 800)
    return () => window.clearTimeout(timer)
    // buildSession reads exactly these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveReady, restoring, selectedAccountId, courseSearchSettings, graphSnapshot, trendAnalyses])

  return (
    <div className="app">
      <header className="app__header">
        <img
          src="/assets/uiw3d_Logo_PNG_White.png"
          alt="UIW"
          className="app__logo"
        />
        <span className="app__title">Canvas Query &amp; Analysis</span>
        {/* Save / Load live in the Aggregation Graph and Trend Analysis. */}
        <div className="app__session-actions">
          {loadStatus && <span className="app__session-status">{loadStatus}</span>}
        </div>
      </header>
      <main className="app__main">
        <ReactFlowProvider>
          <ResizableColumns
            left={<CourseSearch />}
            center={<WorkingArea />}
            right={<StudentList />}
          />
        </ReactFlowProvider>
      </main>
      <LoadProgressModal />
    </div>
  )
}
