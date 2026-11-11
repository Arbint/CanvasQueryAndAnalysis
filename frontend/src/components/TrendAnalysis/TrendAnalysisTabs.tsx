import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadTrendSnapshot } from '../../lib/trendExport'
import { useAppStore } from '../../store/appStore'
import type { TrendColumnSnapshot } from '../../store/appStore'
import { TrendAnalysis, type TrendExportData } from './TrendAnalysis'

interface AnalysisTab {
  id: string
  name: string
  /** Columns restored on mount; null starts fresh. */
  initialColumns: TrendColumnSnapshot[] | null
}

let analysisCounter = 0
const nextAnalysisId = () => `trend-analysis-${++analysisCounter}`

function nextAnalysisName(tabs: AnalysisTab[]) {
  const used = new Set(tabs.map((t) => t.name))
  let n = tabs.length + 1
  while (used.has(`Analysis ${n}`)) n++
  return `Analysis ${n}`
}

const makeTab = (name: string): AnalysisTab => ({ id: nextAnalysisId(), name, initialColumns: null })

/** Sub-tabs of the Trend Analysis panel; each tab is an independent analysis. */
export function TrendAnalysisTabs() {
  const setTrendAnalyses = useAppStore((s) => s.setTrendAnalyses)
  const pendingTrendAnalyses = useAppStore((s) => s.pendingTrendAnalyses)
  const setPendingTrendAnalyses = useAppStore((s) => s.setPendingTrendAnalyses)
  const setLoadStatus = useAppStore((s) => s.setLoadStatus)

  const [tabs, setTabs] = useState<AnalysisTab[]>(() => [makeTab('Analysis 1')])
  const [activeId, setActiveId] = useState(() => tabs[0].id)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Live column state reported by each analysis, and its snapshot exporter.
  const columnsRef = useRef<Record<string, TrendColumnSnapshot[]>>({})
  const exportersRef = useRef<Record<string, (() => TrendExportData) | null>>({})
  const pendingRestoresRef = useRef(0)

  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const syncStore = useCallback(() => {
    setTrendAnalyses(
      tabsRef.current.map((t) => ({ id: t.id, name: t.name, columns: columnsRef.current[t.id] ?? [] })),
    )
  }, [setTrendAnalyses])

  useEffect(() => {
    syncStore()
  }, [tabs, syncStore])

  // Session load: replace all analyses with the saved ones.
  useEffect(() => {
    if (!pendingTrendAnalyses) return
    const restored = pendingTrendAnalyses.length > 0
      ? pendingTrendAnalyses.map((a) => ({ id: nextAnalysisId(), name: a.name, initialColumns: a.columns }))
      : [makeTab('Analysis 1')]
    columnsRef.current = {}
    exportersRef.current = {}
    pendingRestoresRef.current = restored.filter((t) => t.initialColumns).length
    setTabs(restored)
    setActiveId(restored[0].id)
    setRenamingId(null)
    setPendingTrendAnalyses(null)
    if (pendingRestoresRef.current > 0) setLoadStatus('Populating trend analysis...')
    else setLoadStatus(null)
  }, [pendingTrendAnalyses, setLoadStatus, setPendingTrendAnalyses])

  const handleRestored = useCallback(() => {
    pendingRestoresRef.current = Math.max(0, pendingRestoresRef.current - 1)
    if (pendingRestoresRef.current === 0) setLoadStatus(null)
  }, [setLoadStatus])

  const handleColumnsChange = useCallback((id: string, columns: TrendColumnSnapshot[]) => {
    columnsRef.current[id] = columns
    syncStore()
  }, [syncStore])

  // Stable per-tab callbacks so child effects don't re-run every render.
  const exporterSetters = useRef<Record<string, (fn: (() => TrendExportData) | null) => void>>({})
  const registerExporterFor = (id: string) => {
    if (!exporterSetters.current[id]) {
      exporterSetters.current[id] = (fn) => {
        exportersRef.current[id] = fn
      }
    }
    return exporterSetters.current[id]
  }

  const addTab = () => {
    const tab = makeTab(nextAnalysisName(tabs))
    setTabs((curr) => [...curr, tab])
    setActiveId(tab.id)
  }

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return
    const index = tabs.findIndex((t) => t.id === id)
    const remaining = tabs.filter((t) => t.id !== id)
    delete columnsRef.current[id]
    delete exportersRef.current[id]
    delete exporterSetters.current[id]
    setTabs(remaining)
    if (activeId === id) setActiveId(remaining[Math.max(0, index - 1)].id)
  }

  const startRename = (tab: AnalysisTab) => {
    setRenamingId(tab.id)
    setRenameValue(tab.name)
  }

  const commitRename = () => {
    if (!renamingId) return
    const name = renameValue.trim()
    if (name) setTabs((curr) => curr.map((t) => (t.id === renamingId ? { ...t, name } : t)))
    setRenamingId(null)
  }

  const handleDownload = () => {
    downloadTrendSnapshot(
      tabs.map((tab) => ({
        name: tab.name,
        data: exportersRef.current[tab.id]?.() ?? { svgMarkup: '', columns: [] },
      })),
    )
  }

  return (
    <div className="trend-tabs">
      <div className="trend-tabs__bar" role="tablist" aria-label="Trend analyses">
        <div className="trend-tabs__list">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`trend-tabs__tab${tab.id === activeId ? ' trend-tabs__tab--active' : ''}`}
              role="tab"
              aria-selected={tab.id === activeId}
              title="Double-click to rename"
              onClick={() => setActiveId(tab.id)}
              onDoubleClick={() => startRename(tab)}
            >
              {renamingId === tab.id ? (
                <input
                  className="trend-tabs__rename"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="trend-tabs__name">{tab.name}</span>
              )}
              {tabs.length > 1 && (
                <button
                  className="trend-tabs__close"
                  title="Close analysis"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  x
                </button>
              )}
            </div>
          ))}
          <button className="trend-tabs__add" title="New analysis" onClick={addTab}>
            +
          </button>
        </div>
        <button className="trend-tabs__download" title="Download all analyses as an HTML snapshot" onClick={handleDownload}>
          Download Analysis
        </button>
      </div>
      <div className="trend-tabs__content">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`trend-tabs__panel${tab.id === activeId ? ' trend-tabs__panel--active' : ''}`}
          >
            <TrendAnalysis
              initialColumns={tab.initialColumns}
              onColumnsChange={(columns) => handleColumnsChange(tab.id, columns)}
              onRestored={tab.initialColumns ? handleRestored : undefined}
              registerExporter={registerExporterFor(tab.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
