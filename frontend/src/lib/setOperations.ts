import type { Student } from '../api/types'

export function union(...lists: Student[][]): Student[] {
  const seen = new Set<number>()
  const result: Student[] = []
  for (const list of lists) {
    for (const student of list) {
      if (!seen.has(student.id)) {
        seen.add(student.id)
        result.push(student)
      }
    }
  }
  return result
}

export function intersect(...lists: Student[][]): Student[] {
  if (lists.length === 0) return []
  const [first, ...rest] = lists
  return first.filter((student) =>
    rest.every((list) => list.some((s) => s.id === student.id))
  )
}

export function diff(a: Student[], b: Student[]): Student[] {
  const bIds = new Set(b.map((s) => s.id))
  const aIds = new Set(a.map((s) => s.id))
  return [
    ...a.filter((s) => !bIds.has(s.id)),
    ...b.filter((s) => !aIds.has(s.id)),
  ]
}

export function subtract(from: Student[], ...subtractLists: Student[][]): Student[] {
  const removeIds = new Set<number>()
  for (const list of subtractLists) {
    for (const student of list) {
      removeIds.add(student.id)
    }
  }
  return from.filter((student) => !removeIds.has(student.id))
}
