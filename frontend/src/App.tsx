import { useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ResizableColumns } from './components/layout/ResizableColumns'
import { CourseSearch } from './components/CourseSearch/CourseSearch'
import { WorkingArea } from './components/WorkingArea/WorkingArea'
import { StudentList } from './components/StudentList/StudentList'
import {
  cleanGraphSnapshot,
  cleanTrendAnalyses,
  downloadSession,
  isEmptySession,
  readAutosave,
  readSessionFile,
  writeAutosave,
} from './lib/sessionPersistence'
import type { SavedSession } from './store/appStore'
import { useAppStore } from './store/appStore'
import './App.css'

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
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

  const handleSave = () => {
    setSessionError(null)
    downloadSession(buildSession())
  }

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
      setPendingSessionLoad(saved)
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

  const handleLoadFile = async (file: File | undefined) => {
    if (!file) return
    setSessionError(null)
    setLoadStatus('Reading session...')
    try {
      setPendingSessionLoad(await readSessionFile(file))
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to load session')
      setLoadStatus(null)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <img
          src="/assets/uiw3d_Logo_PNG_White.png"
          alt="UIW"
          className="app__logo"
        />
        <span className="app__title">Canvas Query &amp; Analysis</span>
        <div className="app__session-actions">
          {loadStatus && <span className="app__session-status">{loadStatus}</span>}
          {sessionError && <span className="app__session-error">{sessionError}</span>}
          <button className="app__session-button" onClick={handleSave}>Save</button>
          <button className="app__session-button" onClick={() => fileInputRef.current?.click()}>Load</button>
          <input
            ref={fileInputRef}
            className="app__session-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleLoadFile(event.target.files?.[0])}
          />
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
    </div>
  )
}
