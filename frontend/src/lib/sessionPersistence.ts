import type { Edge, Node } from '@xyflow/react'
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
    collection: {
      selectedTerms: [...column.collection.selectedTerms],
      department: column.collection.department,
      numberPattern: column.collection.numberPattern,
    },
    matchedCourseCount: column.matchedCourseCount,
    width: column.width,
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

/** Reads trend analyses from a session, accepting the legacy single-analysis format. */
export function sessionTrendAnalyses(session: SavedSession): TrendAnalysisSnapshot[] {
  if (session.trend.analyses) return session.trend.analyses
  if (session.trend.columns) return [{ id: 'trend-analysis-1', name: 'Analysis 1', columns: session.trend.columns }]
  return []
}

export function downloadSession(session: SavedSession) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `canvas-query-session-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function readSessionFile(file: File): Promise<SavedSession> {
  const text = await file.text()
  const parsed = JSON.parse(text) as SavedSession
  if (parsed.version !== 1 || !parsed.courseSearch || !parsed.graph || !parsed.trend) {
    throw new Error('Unsupported session file')
  }
  return parsed
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
    session.graph.nodes.length === 0 &&
    analyses.every((a) => a.columns.every((c) => !c.courseId && c.mode === 'course'))
  )
}
