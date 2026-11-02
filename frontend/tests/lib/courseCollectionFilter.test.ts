import { describe, expect, it } from 'vitest'
import { containsWildcard, matchesWildcard } from '../../src/lib/courseCollectionFilter'

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
