import { create } from 'zustand'
import type { GraphSnapshot } from './appStore'

// Saved aggregation graphs, picked by Trend Analysis "Aggregation Graph" cards.
// Kept in this browser's local storage (the app stores nothing on a server)
// so they survive reloads. Nothing is written to Canvas.

export interface SavedAggregationGraph {
  id: string
  name: string
  /** Nodes and connections, without fetched student data. */
  graph: GraphSnapshot
}

/**
 * The graph a trend card uses. `id` links it to the library (editing that
 * entry updates every card using it); name and graph are kept as a copy so
 * configuration files still work in a browser whose library does not have it.
 */
export interface AggregationGraphRef {
  id: string | null
  name: string
  graph: GraphSnapshot
}

const STORAGE_KEY = 'canvas-query.aggregation-graphs'

function load(): SavedAggregationGraph[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? (parsed as SavedAggregationGraph[]).filter(
          (g) => g && typeof g.id === 'string' && Array.isArray(g.graph?.nodes) && Array.isArray(g.graph?.edges),
        )
      : []
  } catch {
    return []
  }
}

function persist(graphs: SavedAggregationGraph[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs))
  } catch {
    // Storage unavailable (private window, quota): graphs last for this page only.
  }
}

function newGraphId(): string {
  return `graph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface GraphLibraryState {
  graphs: SavedAggregationGraph[]
  /** Adds a new graph, or replaces the one with the same id. Returns the saved entry. */
  saveGraph: (graph: { id?: string | null; name: string; graph: GraphSnapshot }) => SavedAggregationGraph
}

export const useGraphLibrary = create<GraphLibraryState>((set, get) => ({
  graphs: load(),
  saveGraph: ({ id, name, graph }) => {
    const existing = id ? get().graphs.find((g) => g.id === id) : undefined
    const saved = { id: existing?.id ?? newGraphId(), name, graph }
    const graphs = existing
      ? get().graphs.map((g) => (g.id === saved.id ? saved : g))
      : [...get().graphs, saved]
    persist(graphs)
    set({ graphs })
    return saved
  },
}))

/** The library's current version of a card's graph, or the card's own copy. */
export function resolveGraphRef(
  ref: AggregationGraphRef | null | undefined,
  library: SavedAggregationGraph[],
): AggregationGraphRef | null {
  if (!ref) return null
  const saved = ref.id ? library.find((g) => g.id === ref.id) : undefined
  return saved ? { id: saved.id, name: saved.name, graph: saved.graph } : ref
}
