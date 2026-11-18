import type { Edge, Node } from '@xyflow/react'
import type { Student } from '../../api/types'
import { diff, intersect, subtract, union } from '../../lib/setOperations'

export class GraphCycleError extends Error {
  constructor() {
    super('Graph contains a cycle')
    this.name = 'GraphCycleError'
  }
}

export type NodeStudentData = Record<string, Student[]>

export const OUTPUT_NODE_TYPE = 'outputNode'

/** Node types whose students are fetched (not computed from inputs). */
export function isSourceNodeType(type: string | undefined): boolean {
  return type === 'courseNode' || type === 'courseCollectionNode'
}

function newOutputNode(nodes: Node[]): Node {
  // Right of the rightmost node, so it doesn't land on top of anything.
  const rightmost = nodes.reduce((max, n) => Math.max(max, n.position.x), -Infinity)
  const top = nodes.length ? Math.min(...nodes.map((n) => n.position.y)) : 0
  return {
    id: `output-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: OUTPUT_NODE_TYPE,
    position: { x: Number.isFinite(rightmost) ? rightmost + 320 : 400, y: Number.isFinite(top) ? top : 0 },
    data: {},
    zIndex: 1,
    deletable: false,
  }
}

/**
 * A graph has exactly one Output node: adds one when missing (graphs saved
 * before it existed) and drops extras together with their connections.
 */
export function ensureSingleOutputNode(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const outputs = nodes.filter((n) => n.type === OUTPUT_NODE_TYPE)
  if (outputs.length === 0) return { nodes: [...nodes, newOutputNode(nodes)], edges }
  const extra = new Set(outputs.slice(1).map((n) => n.id))
  return {
    nodes: nodes
      .filter((n) => !extra.has(n.id))
      .map((n) => (n.type === OUTPUT_NODE_TYPE ? { ...n, deletable: false } : n)),
    edges: extra.size ? edges.filter((e) => !extra.has(e.source) && !extra.has(e.target)) : edges,
  }
}

/** The students reaching the graph's Output node, from fetched source-node students. */
export function graphOutputStudents(nodes: Node[], edges: Edge[], sourceStudents: NodeStudentData): Student[] {
  const output = nodes.find((n) => n.type === OUTPUT_NODE_TYPE)
  if (!output) return []
  return evaluateGraph(nodes, edges, sourceStudents)[output.id] ?? []
}

function buildAdjacency(edges: Edge[]): {
  inDegree: Record<string, number>
  dependents: Record<string, string[]>
  inputsByNode: Record<string, { targetHandle: string; sourceNodeId: string }[]>
} {
  const inDegree: Record<string, number> = {}
  const dependents: Record<string, string[]> = {}
  const inputsByNode: Record<string, { targetHandle: string; sourceNodeId: string }[]> = {}

  for (const edge of edges) {
    inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1
    if (!dependents[edge.source]) dependents[edge.source] = []
    dependents[edge.source].push(edge.target)
    if (!inputsByNode[edge.target]) inputsByNode[edge.target] = []
    inputsByNode[edge.target].push({
      targetHandle: edge.targetHandle ?? '',
      sourceNodeId: edge.source,
    })
  }

  return { inDegree, dependents, inputsByNode }
}

export function evaluateGraph(
  nodes: Node[],
  edges: Edge[],
  courseStudents: NodeStudentData
): NodeStudentData {
  const { inDegree, dependents, inputsByNode } = buildAdjacency(edges)

  // Kahn's topological sort
  const queue: string[] = nodes
    .map((n) => n.id)
    .filter((id) => (inDegree[id] ?? 0) === 0)

  const order: string[] = []
  const remaining = { ...inDegree }

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    order.push(nodeId)
    for (const dep of dependents[nodeId] ?? []) {
      remaining[dep] = (remaining[dep] ?? 1) - 1
      if (remaining[dep] === 0) queue.push(dep)
    }
  }

  if (order.length !== nodes.length) throw new GraphCycleError()

  const results: NodeStudentData = {}

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId)!
    const type = node.type

    if (type === 'courseNode' || type === 'courseCollectionNode') {
      results[nodeId] = courseStudents[nodeId] ?? []
      continue
    }

    const inputs = inputsByNode[nodeId] ?? []
    const inputLists = inputs.map((inp) => results[inp.sourceNodeId] ?? [])

    if (type === 'unionNode') {
      results[nodeId] = union(...inputLists)
    } else if (type === 'intersectNode') {
      results[nodeId] = intersect(...inputLists)
    } else if (type === 'subtractNode') {
      const fromInput = inputs.find((i) => i.targetHandle === 'from')
      const subtractInputs = inputs.filter((i) => i.targetHandle !== 'from')
      const fromList = fromInput ? results[fromInput.sourceNodeId] ?? [] : []
      const subLists = subtractInputs.map((i) => results[i.sourceNodeId] ?? [])
      results[nodeId] = subtract(fromList, ...subLists)
    } else if (type === 'outputNode') {
      // One input: the graph's result is whatever is connected to it.
      results[nodeId] = inputLists[0] ?? []
    } else if (type === 'diffNode') {
      const aInput = inputs.find((i) => i.targetHandle === 'a')
      const bInput = inputs.find((i) => i.targetHandle === 'b')
      const aList = aInput ? results[aInput.sourceNodeId] ?? [] : []
      const bList = bInput ? results[bInput.sourceNodeId] ?? [] : []
      results[nodeId] = diff(aList, bList)
    } else {
      results[nodeId] = []
    }
  }

  return results
}
