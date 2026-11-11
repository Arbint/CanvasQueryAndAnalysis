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

export interface TrendAnalysisSnapshot {
  id: string
  name: string
  columns: TrendColumnSnapshot[]
}

export type WorkTab = 'aggregation' | 'trend' | 'audit' | 'gradeReport' | 'courseGrades'

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
    /** Multiple independent analyses (current format). */
    analyses?: TrendAnalysisSnapshot[]
    /** Single analysis (legacy session files). */
    columns?: TrendColumnSnapshot[]
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

  activeWorkTab: WorkTab
  setActiveWorkTab: (tab: WorkTab) => void

  gradeDisplayCourseId: number | null
  setGradeDisplayCourseId: (id: number | null) => void

  graphSnapshot: GraphSnapshot
  setGraphSnapshot: (snapshot: GraphSnapshot) => void
  pendingGraphSnapshot: GraphSnapshot | null
  setPendingGraphSnapshot: (snapshot: GraphSnapshot | null) => void

  trendAnalyses: TrendAnalysisSnapshot[]
  setTrendAnalyses: (analyses: TrendAnalysisSnapshot[]) => void
  pendingTrendAnalyses: TrendAnalysisSnapshot[] | null
  setPendingTrendAnalyses: (analyses: TrendAnalysisSnapshot[] | null) => void

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

  activeWorkTab: 'aggregation',
  setActiveWorkTab: (tab) => set({ activeWorkTab: tab }),

  gradeDisplayCourseId: null,
  setGradeDisplayCourseId: (id) => set({ gradeDisplayCourseId: id }),

  graphSnapshot: { nodes: [], edges: [] },
  setGraphSnapshot: (snapshot) => set({ graphSnapshot: snapshot }),
  pendingGraphSnapshot: null,
  setPendingGraphSnapshot: (snapshot) => set({ pendingGraphSnapshot: snapshot }),

  trendAnalyses: [],
  setTrendAnalyses: (analyses) => set({ trendAnalyses: analyses }),
  pendingTrendAnalyses: null,
  setPendingTrendAnalyses: (analyses) => set({ pendingTrendAnalyses: analyses }),

  pendingSessionLoad: null,
  setPendingSessionLoad: (session) => set({ pendingSessionLoad: session }),
  loadStatus: null,
  setLoadStatus: (status) => set({ loadStatus: status }),
}))
