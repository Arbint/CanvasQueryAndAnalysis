import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadTrendSnapshot } from '../../lib/trendExport'
import { ANALYSIS_COLORS, defaultAnalysisColor, seriesColumns, type CombinedSeries } from '../../lib/trendData'
import { buildTrendConfig, downloadTrendConfig, parseTrendConfig } from '../../lib/sessionPersistence'
import { CombinedTrendView } from './CombinedTrendView'
import { LoadProgressModal } from './LoadProgressModal'
import { uniqueId } from '../../lib/ids'
import { useAppStore } from '../../store/appStore'
import type { TrendColumnSnapshot, TrendCountFilter } from '../../store/appStore'
import { TrendAnalysis, columnNeedsLoad, type TrendExportData } from './TrendAnalysis'

interface AnalysisTab {
  id: string
  name: string
  /** Columns restored on mount; null starts fresh. */
  initialColumns: TrendColumnSnapshot[] | null
  initialCountFilter: TrendCountFilter
  color: string
  /** Whether the Combined view draws this analysis. */
  inCombined: boolean
}

/** Id of the always-present Combined tab (never a real analysis). */
const COMBINED_ID = 'trend-combined'

const nextAnalysisId = () => uniqueId('trend-analysis')

function nextAnalysisName(tabs: AnalysisTab[]) {
  const used = new Set(tabs.map((t) => t.name))
  let n = tabs.length + 1
  while (used.has(`Analysis ${n}`)) n++
  return `Analysis ${n}`
}

const makeTab = (name: string, color: string): AnalysisTab => ({
  id: nextAnalysisId(),
  name,
  initialColumns: null,
  initialCountFilter: 'all',
  color,
  inCombined: true,
})

/** First palette color no other tab uses, falling back to cycling the palette. */
function nextAnalysisColor(tabs: AnalysisTab[]): string {
  const used = new Set(tabs.map((t) => t.color.toLowerCase()))
  return ANALYSIS_COLORS.find((c) => !used.has(c)) ?? defaultAnalysisColor(tabs.length)
}

/** Sub-tabs of the Trend Analysis panel; each tab is an independent analysis. */
export function TrendAnalysisTabs() {
  const setTrendAnalyses = useAppStore((s) => s.setTrendAnalyses)
  const pendingTrendAnalyses = useAppStore((s) => s.pendingTrendAnalyses)
  const setPendingTrendAnalyses = useAppStore((s) => s.setPendingTrendAnalyses)
  const setLoadStatus = useAppStore((s) => s.setLoadStatus)
  const setPendingSessionLoad = useAppStore((s) => s.setPendingSessionLoad)
  const startLoadProgress = useAppStore((s) => s.startLoadProgress)
  const updateLoadProgress = useAppStore((s) => s.updateLoadProgress)
  const configInputRef = useRef<HTMLInputElement>(null)

  const [tabs, setTabs] = useState<AnalysisTab[]>(() => [makeTab('Analysis 1', defaultAnalysisColor(0))])
  const [activeId, setActiveId] = useState(() => tabs[0].id)
  // Bumped when an analysis changes while the Combined view is showing, so it redraws.
  const [, setCombinedVersion] = useState(0)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Live column state reported by each analysis, and its snapshot exporter.
  const columnsRef = useRef<Record<string, TrendColumnSnapshot[]>>({})
  const countFiltersRef = useRef<Record<string, TrendCountFilter>>({})
  const exportersRef = useRef<Record<string, (() => TrendExportData) | null>>({})
  const pendingRestoresRef = useRef(0)

  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const syncStore = useCallback(() => {
    setTrendAnalyses(
      tabsRef.current.map((t) => ({
        id: t.id,
        name: t.name,
        columns: columnsRef.current[t.id] ?? [],
        countFilter: countFiltersRef.current[t.id] ?? t.initialCountFilter,
        color: t.color,
        inCombined: t.inCombined,
      })),
    )
  }, [setTrendAnalyses])

  useEffect(() => {
    syncStore()
  }, [tabs, syncStore])

  // Session load: replace all analyses with the saved ones.
  useEffect(() => {
    if (!pendingTrendAnalyses) return
    const restored = pendingTrendAnalyses.length > 0
      ? pendingTrendAnalyses.map((a, i) => ({
          id: nextAnalysisId(),
          name: a.name,
          initialColumns: a.columns,
          initialCountFilter: a.countFilter ?? 'all',
          color: a.color ?? defaultAnalysisColor(i),
          inCombined: a.inCombined ?? true,
        }))
      : [makeTab('Analysis 1', defaultAnalysisColor(0))]
    columnsRef.current = {}
    countFiltersRef.current = {}
    exportersRef.current = {}
    pendingRestoresRef.current = restored.filter((t) => t.initialColumns).length
    setTabs(restored)
    setActiveId((curr) => (curr === COMBINED_ID ? COMBINED_ID : restored[0].id))
    setRenamingId(null)
    setPendingTrendAnalyses(null)
    const columnsTotal = pendingTrendAnalyses.reduce((sum, a) => sum + a.columns.filter(columnNeedsLoad).length, 0)
    const columnCount = pendingTrendAnalyses.reduce((sum, a) => sum + a.columns.length, 0)
    updateLoadProgress({
      stage: columnsTotal > 0 ? 'columns' : 'done',
      message: columnsTotal > 0
        ? `Updating ${restored.length} tab${restored.length === 1 ? '' : 's'} (${restored.map((t) => t.name).join(', ')}): loading students...`
        : `Loaded ${restored.length} tab${restored.length === 1 ? '' : 's'}, ${columnCount} column${columnCount === 1 ? '' : 's'}`,
      columnsDone: 0,
      columnsTotal,
    })
    if (pendingRestoresRef.current > 0) setLoadStatus('Populating trend analysis...')
    else setLoadStatus(null)
  }, [pendingTrendAnalyses, setLoadStatus, setPendingTrendAnalyses, updateLoadProgress])

  const handleRestored = useCallback(() => {
    pendingRestoresRef.current = Math.max(0, pendingRestoresRef.current - 1)
    if (pendingRestoresRef.current === 0) {
      setLoadStatus(null)
      updateLoadProgress((p) => ({
        stage: 'done',
        message: `Loaded ${tabsRef.current.length} tab${tabsRef.current.length === 1 ? '' : 's'}, ${p.columnsTotal} column${p.columnsTotal === 1 ? '' : 's'} with students`,
      }))
    }
  }, [setLoadStatus, updateLoadProgress])

  // Each restored column reports in; shown in the loading pop-up.
  const columnReporters = useRef<Record<string, (column: { label: string; error: string | null }) => void>>({})
  const columnReporterFor = (tab: AnalysisTab) => {
    if (!columnReporters.current[tab.id]) {
      columnReporters.current[tab.id] = ({ label, error }) => {
        updateLoadProgress((p) => ({
          columnsDone: p.columnsDone + 1,
          message: `Loaded ${tab.name}: ${label} (${p.columnsDone + 1} of ${p.columnsTotal})`,
          warnings: error ? [...p.warnings, `${tab.name} / ${label}: ${error}`] : p.warnings,
        }))
      }
    }
    return columnReporters.current[tab.id]
  }

  // --- Save / load the Trend Analysis configuration ---

  const handleSaveConfig = () => {
    const { selectedAccountId, courseSearchSettings, trendAnalyses } = useAppStore.getState()
    downloadTrendConfig(buildTrendConfig(
      { selectedAccountId, selectedTermIds: courseSearchSettings.selectedTermIds, keywords: courseSearchSettings.keywords },
      trendAnalyses,
    ))
  }

  const handleLoadConfig = async (file: File | undefined) => {
    if (!file) return
    if (configInputRef.current) configInputRef.current.value = ''
    startLoadProgress(`Loading ${file.name}`)
    try {
      const session = parseTrendConfig(await file.text())
      const analyses = session.trend.analyses ?? []
      updateLoadProgress({
        message: `Read ${analyses.length} analys${analyses.length === 1 ? 'is' : 'es'}`,
      })
      setLoadStatus('Loading search...')
      setPendingSessionLoad(session)
    } catch (error) {
      updateLoadProgress({ error: error instanceof Error ? error.message : 'Unable to read the file' })
    }
  }

  const handleColumnsChange = useCallback((id: string, columns: TrendColumnSnapshot[]) => {
    columnsRef.current[id] = columns
    syncStore()
    if (activeIdRef.current === COMBINED_ID) setCombinedVersion((v) => v + 1)
  }, [syncStore])

  const handleCountFilterChange = useCallback((id: string, filter: TrendCountFilter) => {
    countFiltersRef.current[id] = filter
    syncStore()
    if (activeIdRef.current === COMBINED_ID) setCombinedVersion((v) => v + 1)
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
    const tab = makeTab(nextAnalysisName(tabs), nextAnalysisColor(tabs))
    setTabs((curr) => [...curr, tab])
    setActiveId(tab.id)
  }

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return
    const index = tabs.findIndex((t) => t.id === id)
    const remaining = tabs.filter((t) => t.id !== id)
    delete columnsRef.current[id]
    delete countFiltersRef.current[id]
    delete exportersRef.current[id]
    delete exporterSetters.current[id]
    setTabs(remaining)
    if (activeId === id) setActiveId(remaining[Math.max(0, index - 1)].id)
  }

  const setTabColor = (id: string, color: string) => {
    setTabs((curr) => curr.map((t) => (t.id === id ? { ...t, color } : t)))
  }

  const toggleInCombined = (id: string) => {
    setTabs((curr) => curr.map((t) => (t.id === id ? { ...t, inCombined: !t.inCombined } : t)))
  }

  const exportFor = (tab: AnalysisTab): TrendExportData =>
    exportersRef.current[tab.id]?.() ?? { countFilter: 'all', columns: [] }

  // Built only while the Combined tab shows; reads each analysis's latest data.
  const combinedSeries: (CombinedSeries & { included: boolean })[] = activeId === COMBINED_ID
    ? tabs.map((tab) => {
        const data = exportFor(tab)
        return {
          id: tab.id,
          name: tab.name,
          color: tab.color,
          included: tab.inCombined,
          columns: seriesColumns(data),
        }
      })
    : []

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
        color: tab.color,
        inCombined: tab.inCombined,
        data: exportFor(tab),
      })),
    )
  }

  return (
    <div className="trend-tabs">
      <div className="trend-tabs__bar" role="tablist" aria-label="Trend analyses">
        <div className="trend-tabs__list">
          <div
            className={`trend-tabs__tab trend-tabs__tab--combined${activeId === COMBINED_ID ? ' trend-tabs__tab--active' : ''}`}
            role="tab"
            aria-selected={activeId === COMBINED_ID}
            title="All analyses overlaid on one graph"
            onClick={() => setActiveId(COMBINED_ID)}
          >
            <span className="trend-tabs__name">Combined</span>
          </div>
          <span className="trend-tabs__divider" aria-hidden="true" />
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`trend-tabs__tab${tab.id === activeId ? ' trend-tabs__tab--active' : ''}`}
              style={{ ['--tab-color' as string]: tab.color }}
              role="tab"
              aria-selected={tab.id === activeId}
              title="Double-click to rename"
              onClick={() => setActiveId(tab.id)}
              onDoubleClick={() => startRename(tab)}
            >
              <input
                type="color"
                className="trend-tabs__color"
                title="Tab color"
                aria-label={`Color for ${tab.name}`}
                value={tab.color}
                onChange={(e) => setTabColor(tab.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              />
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
        <div className="trend-tabs__actions">
          <button
            className="trend-tabs__config"
            title="Save the course search and every analysis to a JSON file, to rebuild them later"
            onClick={handleSaveConfig}
          >
            Save
          </button>
          <button
            className="trend-tabs__config"
            title="Load a saved configuration: searches the courses, then rebuilds the analyses"
            onClick={() => configInputRef.current?.click()}
          >
            Load
          </button>
          <input
            ref={configInputRef}
            className="trend-tabs__config-input"
            type="file"
            accept="application/json,.json"
            aria-label="Trend Analysis configuration file"
            onChange={(e) => void handleLoadConfig(e.target.files?.[0])}
          />
          <button className="trend-tabs__download" title="Download all analyses as an HTML snapshot" onClick={handleDownload}>
            Download Analysis
          </button>
        </div>
        <LoadProgressModal />
      </div>
      <div className="trend-tabs__content">
        <div className={`trend-tabs__panel${activeId === COMBINED_ID ? ' trend-tabs__panel--active' : ''}`}>
          {activeId === COMBINED_ID && (
            <CombinedTrendView series={combinedSeries} onToggle={toggleInCombined} />
          )}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`trend-tabs__panel${tab.id === activeId ? ' trend-tabs__panel--active' : ''}`}
          >
            <TrendAnalysis
              initialColumns={tab.initialColumns}
              onColumnsChange={(columns) => handleColumnsChange(tab.id, columns)}
              initialCountFilter={tab.initialCountFilter}
              onCountFilterChange={(filter) => handleCountFilterChange(tab.id, filter)}
              onRestored={tab.initialColumns ? handleRestored : undefined}
              onColumnRestored={columnReporterFor(tab)}
              registerExporter={registerExporterFor(tab.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
