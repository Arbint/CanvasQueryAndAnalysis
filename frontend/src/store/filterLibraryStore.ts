import { useMemo } from 'react'
import { create } from 'zustand'
import { resolveCollectionFilters, type CourseCollectionFilters } from '../lib/courseCollectionFilter'

// Saved course collection filter expressions, shared by every Course Collection
// (aggregation graph, trend analysis, grade report). Kept in this browser's
// local storage so they survive reloads. Nothing is written to Canvas.

export interface SavedFilterExpression {
  id: string
  name: string
  expression: string
}

const STORAGE_KEY = 'canvas-query.collection-filter-expressions'

function load(): SavedFilterExpression[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? (parsed as SavedFilterExpression[]).filter((f) => f && typeof f.id === 'string' && typeof f.expression === 'string')
      : []
  } catch {
    return []
  }
}

function persist(filters: SavedFilterExpression[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // Storage unavailable (private window, quota): expressions last for this page only.
  }
}

function newFilterId(): string {
  return `filter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface FilterLibraryState {
  filters: SavedFilterExpression[]
  /** Adds a new expression, or replaces the one with the same id. Returns the saved entry. */
  saveFilter: (filter: { id?: string | null; name: string; expression: string }) => SavedFilterExpression
  deleteFilter: (id: string) => void
}

export const useFilterLibrary = create<FilterLibraryState>((set, get) => ({
  filters: load(),
  saveFilter: ({ id, name, expression }) => {
    const existing = id ? get().filters.find((f) => f.id === id) : undefined
    const saved = { id: existing?.id ?? newFilterId(), name, expression }
    const filters = existing
      ? get().filters.map((f) => (f.id === saved.id ? saved : f))
      : [...get().filters, saved]
    persist(filters)
    set({ filters })
    return saved
  },
  deleteFilter: (id) => {
    const filters = get().filters.filter((f) => f.id !== id)
    persist(filters)
    set({ filters })
  },
}))

/** A collection's filters with its linked expression read from the library. */
export function useResolvedCollectionFilters(filters: CourseCollectionFilters): CourseCollectionFilters {
  const library = useFilterLibrary((s) => s.filters)
  return useMemo(() => resolveCollectionFilters(filters, library), [filters, library])
}
