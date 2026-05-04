import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { Course, Student } from '../api/types'

export interface CourseSearchSettings {
  selectedTermIds: string[]
  keywords: string[]
}

export interface GraphSnapshot {
  nodes: Node[]
  edges: Edge[]
}

export interface TrendCollectionFilters {
  selectedTerms: string[]
  department: string
  numberPattern: string
}

export interface TrendColumnSnapshot {
  id: string
  mode: 'course' | 'collection'
  courseId: number | null
  collection: TrendCollectionFilters
  matchedCourseCount: number
  width: number
}

export interface SavedSession {
  version: 1
  savedAt: string
  courseSearch: {
    selectedAccountId: number | null
    selectedTermIds: string[]
    keywords: string[]
  }
  graph: GraphSnapshot
  trend: {
    columns: TrendColumnSnapshot[]
  }
}

interface AppStore {
  selectedAccountId: number | null
  setSelectedAccountId: (id: number | null) => void

  courseSearchSettings: CourseSearchSettings
  setCourseSearchSettings: (settings: CourseSearchSettings) => void

  courses: Course[]
  setCourses: (courses: Course[]) => void
  updateCourseStudentCount: (courseId: number, count: number) => void

  activeStudentList: Student[]
  setActiveStudentList: (students: Student[]) => void

  pendingAddCourseId: number | null
  setPendingAddCourseId: (id: number | null) => void

  graphSnapshot: GraphSnapshot
  setGraphSnapshot: (snapshot: GraphSnapshot) => void
  pendingGraphSnapshot: GraphSnapshot | null
  setPendingGraphSnapshot: (snapshot: GraphSnapshot | null) => void

  trendColumns: TrendColumnSnapshot[]
  setTrendColumns: (columns: TrendColumnSnapshot[]) => void
  pendingTrendColumns: TrendColumnSnapshot[] | null
  setPendingTrendColumns: (columns: TrendColumnSnapshot[] | null) => void

  pendingSessionLoad: SavedSession | null
  setPendingSessionLoad: (session: SavedSession | null) => void
  loadStatus: string | null
  setLoadStatus: (status: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  courseSearchSettings: { selectedTermIds: [], keywords: [] },
  setCourseSearchSettings: (settings) => set({ courseSearchSettings: settings }),

  courses: [],
  setCourses: (courses) => set({ courses }),
  updateCourseStudentCount: (courseId, count) =>
    set((state) => ({
      courses: state.courses.map((c) =>
        c.id === courseId ? { ...c, student_count: count } : c
      ),
    })),

  activeStudentList: [],
  setActiveStudentList: (students) => set({ activeStudentList: students }),

  pendingAddCourseId: null,
  setPendingAddCourseId: (id) => set({ pendingAddCourseId: id }),

  graphSnapshot: { nodes: [], edges: [] },
  setGraphSnapshot: (snapshot) => set({ graphSnapshot: snapshot }),
  pendingGraphSnapshot: null,
  setPendingGraphSnapshot: (snapshot) => set({ pendingGraphSnapshot: snapshot }),

  trendColumns: [],
  setTrendColumns: (columns) => set({ trendColumns: columns }),
  pendingTrendColumns: null,
  setPendingTrendColumns: (columns) => set({ pendingTrendColumns: columns }),

  pendingSessionLoad: null,
  setPendingSessionLoad: (session) => set({ pendingSessionLoad: session }),
  loadStatus: null,
  setLoadStatus: (status) => set({ loadStatus: status }),
}))
