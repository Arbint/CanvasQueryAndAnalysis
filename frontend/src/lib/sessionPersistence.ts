import type { Edge, Node } from '@xyflow/react'
import type { GraphSnapshot, SavedSession, TrendColumnSnapshot } from '../store/appStore'

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
