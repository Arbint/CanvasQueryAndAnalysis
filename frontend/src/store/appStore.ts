import { create } from 'zustand'
import type { Course, Student } from '../api/types'

interface AppStore {
  selectedAccountId: number | null
  setSelectedAccountId: (id: number) => void

  courses: Course[]
  setCourses: (courses: Course[]) => void
  updateCourseStudentCount: (courseId: number, count: number) => void

  activeStudentList: Student[]
  setActiveStudentList: (students: Student[]) => void

  pendingAddCourseId: number | null
  setPendingAddCourseId: (id: number | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

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
}))
