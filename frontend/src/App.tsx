import { useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ResizableColumns } from './components/layout/ResizableColumns'
import { CourseSearch } from './components/CourseSearch/CourseSearch'
import { WorkingArea } from './components/WorkingArea/WorkingArea'
import { StudentList } from './components/StudentList/StudentList'
import { cleanGraphSnapshot, cleanTrendColumns, downloadSession, readSessionFile } from './lib/sessionPersistence'
import { useAppStore } from './store/appStore'
import './App.css'

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const {
    selectedAccountId,
    courseSearchSettings,
    graphSnapshot,
    trendColumns,
    setPendingSessionLoad,
    loadStatus,
    setLoadStatus,
  } = useAppStore()

  const handleSave = () => {
    setSessionError(null)
    downloadSession({
      version: 1,
      savedAt: new Date().toISOString(),
      courseSearch: {
        selectedAccountId,
        selectedTermIds: courseSearchSettings.selectedTermIds,
        keywords: courseSearchSettings.keywords,
      },
      graph: cleanGraphSnapshot(graphSnapshot),
      trend: {
        columns: cleanTrendColumns(trendColumns),
      },
    })
  }

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
