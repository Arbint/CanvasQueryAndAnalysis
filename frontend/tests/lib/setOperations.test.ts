import { describe, expect, it } from 'vitest'
import type { Student } from '../../src/api/types'
import { intersect, subtract, union } from '../../src/lib/setOperations'

function s(id: number): Student {
  return {
    id,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    ssid: `SSID${id}`,
    login_id: `user${id}`,
    enrollment_state: 'active',
    email: `user${id}@student.uiwtx.edu`,
  }
}

const A = s(1), B = s(2), C = s(3), D = s(4)

describe('union', () => {
  it('merges lists without duplicates', () => {
    expect(union([A, B], [B, C])).toEqual([A, B, C])
  })
  it('handles empty lists', () => {
    expect(union([], [A])).toEqual([A])
    expect(union([])).toEqual([])
  })
  it('single list returns copy', () => {
    expect(union([A, B])).toEqual([A, B])
  })
})

describe('intersect', () => {
  it('finds common students', () => {
    expect(intersect([A, B, C], [B, C, D])).toEqual([B, C])
  })
  it('empty input returns empty', () => {
    expect(intersect([])).toEqual([])
  })
  it('no overlap returns empty', () => {
    expect(intersect([A], [B])).toEqual([])
  })
  it('single list returns copy', () => {
    expect(intersect([A, B])).toEqual([A, B])
  })
})

describe('subtract', () => {
  it('removes specified students', () => {
    expect(subtract([A, B, C], [B])).toEqual([A, C])
  })
  it('multiple subtract lists', () => {
    expect(subtract([A, B], [B, C], [A])).toEqual([])
  })
  it('empty subtract list is identity', () => {
    expect(subtract([A, B])).toEqual([A, B])
  })
  it('empty from list returns empty', () => {
    expect(subtract([], [A])).toEqual([])
  })
})
