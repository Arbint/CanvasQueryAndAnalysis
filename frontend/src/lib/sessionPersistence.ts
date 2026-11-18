import type { Edge, Node } from '@xyflow/react'
import { normalizeCollectionFilters } from './courseCollectionFilter'
import type { GraphSnapshot, SavedSession, TrendAnalysisSnapshot, TrendColumnSnapshot } from '../store/appStore'

function stripRuntimeNodeData(data: Record<string, unknown>) {
  const rest = { ...data }
  delete rest.students
  return rest
}

function cleanNode(node: Node): Node {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: stripRuntimeNodeData(node.data),
    style: node.style,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
  }
}

function cleanEdge(edge: Edge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    type: edge.type,
    data: edge.data,
  }
}

export function cleanGraphSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return {
    nodes: snapshot.nodes.map(cleanNode),
    edges: snapshot.edges.map(cleanEdge),
  }
}

export function cleanTrendColumns(columns: TrendColumnSnapshot[]): TrendColumnSnapshot[] {
  return columns.map((column) => ({
    id: column.id,
    mode: column.mode,
    label: column.label ?? '',
    courseId: column.courseId,
    // Saved in the current (expression) format, converting legacy number patterns.
    collection: normalizeCollectionFilters(column.collection),
    matchedCourseCount: column.matchedCourseCount,
    width: column.width,
    ...(column.mode === 'prediction' && column.prediction ? { prediction: { ...column.prediction } } : {}),
    ...(column.mode === 'graph' && column.graph
      ? { graph: { id: column.graph.id, name: column.graph.name, graph: cleanGraphSnapshot(column.graph.graph) } }
      : {}),
  }))
}

export function cleanTrendAnalyses(analyses: TrendAnalysisSnapshot[]): TrendAnalysisSnapshot[] {
  return analyses.map((analysis) => ({
    id: analysis.id,
    name: analysis.name,
    columns: cleanTrendColumns(analysis.columns),
    countFilter: analysis.countFilter ?? 'all',
    color: analysis.color,
    inCombined: analysis.inCombined ?? true,
  }))
}

/**
 * Reads trend analyses from a session, accepting the legacy single-analysis
 * format. Null when the session has no trend part (a graph configuration).
 */
export function sessionTrendAnalyses(session: SavedSession): TrendAnalysisSnapshot[] | null {
  if (!session.trend) return null
  if (session.trend.analyses) return session.trend.analyses
  if (session.trend.columns) return [{ id: 'trend-analysis-1', name: 'Analysis 1', columns: session.trend.columns }]
  return []
}

function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const today = () => new Date().toISOString().slice(0, 10)

// --- Trend Analysis configuration files ---
// Just the course search (so the courses can be found again) and the trend
// analyses; loading one leaves the aggregation graph alone.

export const TREND_CONFIG_KIND = 'canvas-query-trend-config'

export interface TrendConfigFile {
  kind: typeof TREND_CONFIG_KIND
  version: 1
  savedAt: string
  courseSearch: SavedSession['courseSearch']
  trend: { analyses: TrendAnalysisSnapshot[] }
}

export function buildTrendConfig(
  courseSearch: SavedSession['courseSearch'],
  analyses: TrendAnalysisSnapshot[],
  savedAt = new Date(),
): TrendConfigFile {
  return {
    kind: TREND_CONFIG_KIND,
    version: 1,
    savedAt: savedAt.toISOString(),
    courseSearch: {
      selectedAccountId: courseSearch.selectedAccountId,
      selectedTermIds: [...courseSearch.selectedTermIds],
      keywords: [...courseSearch.keywords],
    },
    trend: { analyses: cleanTrendAnalyses(analyses) },
  }
}

export function downloadTrendConfig(config: TrendConfigFile) {
  downloadJson(config, `trend-analysis-config-${today()}.json`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCourseSearch(value: unknown): value is SavedSession['courseSearch'] {
  return isRecord(value) && Array.isArray(value.selectedTermIds) && Array.isArray(value.keywords)
}

/**
 * Parses a Trend Analysis configuration file. A full session file is also
 * accepted; only its course search and trend analyses are used.
 * The result is a session without a graph, ready for the session loader.
 */
export function parseTrendConfig(text: string): SavedSession {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a JSON file')
  }
  if (isRecord(parsed) && parsed.kind === GRAPH_CONFIG_KIND) {
    throw new Error('This is an Aggregation Graph configuration: load it from the Aggregation Graph')
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isCourseSearch(parsed.courseSearch) || !isRecord(parsed.trend)) {
    throw new Error('Not a Trend Analysis configuration or session file')
  }
  const session = parsed as unknown as SavedSession
  const analyses = sessionTrendAnalyses(session)
  if (!Array.isArray(analyses)) throw new Error('The file has no trend analyses')
  return {
    version: 1,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    courseSearch: session.courseSearch,
    trend: { analyses },
  }
}

// --- Aggregation Graph configuration files ---
// The course search (so the courses can be found again) and the graph's nodes
// and connections; loading one leaves Trend Analysis alone.

export const GRAPH_CONFIG_KIND = 'canvas-query-graph-config'

export interface GraphConfigFile {
  kind: typeof GRAPH_CONFIG_KIND
  version: 1
  savedAt: string
  courseSearch: SavedSession['courseSearch']
  graph: GraphSnapshot
}

export function buildGraphConfig(
  courseSearch: SavedSession['courseSearch'],
  graph: GraphSnapshot,
  savedAt = new Date(),
): GraphConfigFile {
  return {
    kind: GRAPH_CONFIG_KIND,
    version: 1,
    savedAt: savedAt.toISOString(),
    courseSearch: {
      selectedAccountId: courseSearch.selectedAccountId,
      selectedTermIds: [...courseSearch.selectedTermIds],
      keywords: [...courseSearch.keywords],
    },
    graph: cleanGraphSnapshot(graph),
  }
}

export function downloadGraphConfig(config: GraphConfigFile) {
  downloadJson(config, `aggregation-graph-config-${today()}.json`)
}

/**
 * Parses an Aggregation Graph configuration file. A full session file (from
 * the old global Save) is also accepted; only its course search and graph
 * are used. The result is a session without a trend part.
 */
export function parseGraphConfig(text: string): SavedSession {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a JSON file')
  }
  if (isRecord(parsed) && parsed.kind === TREND_CONFIG_KIND) {
    throw new Error('This is a Trend Analysis configuration: load it from Trend Analysis')
  }
  const graph = isRecord(parsed) ? parsed.graph : undefined
  if (
    !isRecord(parsed) || parsed.version !== 1 || !isCourseSearch(parsed.courseSearch) ||
    !isRecord(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)
  ) {
    throw new Error('Not an Aggregation Graph configuration or session file')
  }
  return {
    version: 1,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    courseSearch: parsed.courseSearch,
    graph: cleanGraphSnapshot(graph as unknown as GraphSnapshot),
  }
}

// --- Auto-save ---
// The working session is mirrored to this browser's local storage so a page
// reload (e.g. the browser discarding an idle tab) restores it. Only the
// session description is stored; student data is re-fetched from Canvas.

const AUTOSAVE_KEY = 'canvas-query.autosave'

export function writeAutosave(session: SavedSession) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable or full: auto-save is best effort.
  }
}

export function readAutosave(): SavedSession | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedSession
    if (parsed.version !== 1 || !parsed.courseSearch || !parsed.graph || !parsed.trend) return null
    return parsed
  } catch {
    return null
  }
}

/** True when a session holds nothing worth restoring. */
export function isEmptySession(session: SavedSession): boolean {
  const analyses = sessionTrendAnalyses(session)
  return (
    !session.courseSearch.selectedAccountId &&
    // The Output node is always there, so it doesn't count as work.
    (session.graph?.nodes.filter((n) => n.type !== 'outputNode').length ?? 0) === 0 &&
    (analyses ?? []).every((a) => a.columns.every((c) => !c.courseId && c.mode === 'course'))
  )
}
