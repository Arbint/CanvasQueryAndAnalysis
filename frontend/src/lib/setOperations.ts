import type { Student } from '../api/types'

// A student can be active in one course and inactive in another. When
// merging enrollment records for the same student across courses, treat
// them as active if active in any contributing course, inactive only if
// inactive in all of them.
function mergeEnrollmentState(students: Student[]): Student {
  const active = students.some((s) => s.enrollment_state === 'active')
  const base = students[0]
  return active && base.enrollment_state !== 'active'
    ? { ...base, enrollment_state: 'active' }
    : base
}

export function union(...lists: Student[][]): Student[] {
  const order: number[] = []
  const byId = new Map<number, Student[]>()
  for (const list of lists) {
    for (const student of list) {
      if (!byId.has(student.id)) {
        order.push(student.id)
        byId.set(student.id, [])
      }
      byId.get(student.id)!.push(student)
    }
  }
  return order.map((id) => mergeEnrollmentState(byId.get(id)!))
}

export function intersect(...lists: Student[][]): Student[] {
  if (lists.length === 0) return []
  const [first, ...rest] = lists
  const result: Student[] = []
  for (const student of first) {
    const matches = [student]
    let inAll = true
    for (const list of rest) {
      const match = list.find((s) => s.id === student.id)
      if (!match) {
        inAll = false
        break
      }
      matches.push(match)
    }
    if (inAll) result.push(mergeEnrollmentState(matches))
  }
  return result
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
