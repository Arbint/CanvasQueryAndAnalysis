import type { Course, Student } from '../api/types'
import { graphOutputStudents, isSourceNodeType } from '../components/NodeGraph/graphEngine'
import type { GraphSnapshot } from '../store/appStore'
import { union } from './setOperations'
import {
  courseMatchesFilters,
  normalizeCollectionFilters,
  resolveCollectionFilters,
  type StoredCollectionFilters,
} from './courseCollectionFilter'
import type { SavedFilterExpression } from '../store/filterLibraryStore'

/** Narrows every Course Collection node of a graph (from a Trend Analysis card). */
export interface GraphScope {
  selectedTerms: string[]
  department: string
}

export interface GraphEvaluation {
  students: Student[]
  /** Distinct courses whose students were used. */
  courseCount: number
}

/** The courses each source node of a graph takes its students from. */
export function graphSourceCourses(
  graph: GraphSnapshot,
  courses: Course[],
  scope: GraphScope,
  filterLibrary: SavedFilterExpression[],
): Record<string, number[]> {
  const scopeFilters = { selectedTerms: scope.selectedTerms, department: scope.department, filter: null }
  const sources: Record<string, number[]> = {}
  for (const node of graph.nodes) {
    if (!isSourceNodeType(node.type)) continue
    const data = node.data as Record<string, unknown>
    if (node.type === 'courseNode') {
      // A specific course: the card's scope does not apply.
      const id = Number(data.selectedCourseId)
      sources[node.id] = id ? [id] : []
    } else {
      const filters = resolveCollectionFilters(normalizeCollectionFilters(data as StoredCollectionFilters), filterLibrary)
      sources[node.id] = courses
        .filter((c) => courseMatchesFilters(c, filters) && courseMatchesFilters(c, scopeFilters))
        .map((c) => c.id)
    }
  }
  return sources
}

/**
 * Runs a saved graph without showing it: fetches the students of every
 * Course and Course Collection node (collections narrowed by the scope) and
 * returns what reaches the Output node.
 */
export async function evaluateGraphStudents(
  graph: GraphSnapshot,
  courses: Course[],
  scope: GraphScope,
  filterLibrary: SavedFilterExpression[],
  getStudents: (courseId: number) => Promise<Student[]>,
): Promise<GraphEvaluation> {
  const sources = graphSourceCourses(graph, courses, scope, filterLibrary)
  const courseIds = [...new Set(Object.values(sources).flat())]
  const fetched = new Map<number, Student[]>()
  await Promise.all(courseIds.map(async (id) => fetched.set(id, await getStudents(id))))
  const sourceStudents: Record<string, Student[]> = {}
  for (const [nodeId, ids] of Object.entries(sources)) {
    const lists = ids.map((id) => fetched.get(id) ?? [])
    sourceStudents[nodeId] = lists.length ? union(...lists) : []
  }
  return { students: graphOutputStudents(graph.nodes, graph.edges, sourceStudents), courseCount: courseIds.length }
}
