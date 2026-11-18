import { describe, expect, it } from 'vitest'
import type { Course } from '../../src/api/types'
import {
  containsWildcard,
  courseMatchesFilters,
  matchesWildcard,
  normalizeCollectionFilters,
  resolveCollectionFilters,
} from '../../src/lib/courseCollectionFilter'

describe('matchesWildcard', () => {
  it('matches the whole value, * standing for one character', () => {
    expect(matchesWildcard('3*7*', '3170')).toBe(true)
    expect(matchesWildcard('3***', '31700')).toBe(false)
  })
})

describe('containsWildcard', () => {
  it('matches anywhere in the value, ignoring case', () => {
    expect(containsWildcard('angd 3*7', 'ANGD 3170-01')).toBe(true)
    expect(containsWildcard('fall', 'Fall 2024')).toBe(true)
  })

  it('treats * as exactly one character', () => {
    expect(containsWildcard('3*7', '3170')).toBe(true)
    expect(containsWildcard('3*7', '37')).toBe(false)
  })

  it('treats other regex characters literally', () => {
    expect(containsWildcard('(a)', 'x(a)y')).toBe(true)
    expect(containsWildcard('a.c', 'abc')).toBe(false)
  })
})

const course = (course_code: string, term_name = 'Fall 2025', instructor = 'Jingtian Li'): Course => ({
  id: 1, name: 'C', course_code, instructor, term_name, student_count: null,
})

describe('normalizeCollectionFilters', () => {
  it('converts legacy include/exclude filters to an expression', () => {
    const f = normalizeCollectionFilters({ selectedTerms: ['Fall 2025'], department: 'GAMD', includeFilters: ['3***'], excludeFilters: ['3*9*'] })
    expect(f.filter).toEqual({ id: null, name: '$3*** and not $3*9*', expression: '$3*** and not $3*9*' })
    expect(f.selectedTerms).toEqual(['Fall 2025'])
  })

  it('converts the legacy trend number pattern', () => {
    expect(normalizeCollectionFilters({ selectedTerms: [], department: '', numberPattern: '2*3*' }).filter?.expression).toBe('$2*3*')
  })

  it('keeps current filters and handles missing data', () => {
    const filter = { id: 'f1', name: 'A', expression: '@Jing' }
    expect(normalizeCollectionFilters({ selectedTerms: [], department: '', filter }).filter).toEqual(filter)
    expect(normalizeCollectionFilters(undefined)).toEqual({ selectedTerms: [], department: '', filter: null })
  })
})

describe('courseMatchesFilters with expressions', () => {
  it('combines terms, department and the expression', () => {
    const filters = { selectedTerms: [], department: 'gamd', filter: { id: null, name: 'x', expression: '$3*** and #2025' } }
    expect(courseMatchesFilters(course('GAMD 3170 01'), filters)).toBe(true)
    expect(courseMatchesFilters(course('ANGD 3170 01'), filters)).toBe(false)
    expect(courseMatchesFilters(course('GAMD 3170 01', 'Fall 2024'), filters)).toBe(false)
    expect(courseMatchesFilters(course('GAMD 2170 01'), { ...filters, filter: null })).toBe(true)
  })
})

describe('resolveCollectionFilters', () => {
  it('reads a linked expression from the library, falling back to the saved copy', () => {
    const filters = { selectedTerms: [], department: '', filter: { id: 'f1', name: 'Old', expression: '$1***' } }
    const library = [{ id: 'f1', name: 'New', expression: '$2***' }]
    expect(resolveCollectionFilters(filters, library).filter).toEqual({ id: 'f1', name: 'New', expression: '$2***' })
    expect(resolveCollectionFilters(filters, []).filter?.expression).toBe('$1***')
  })
})
