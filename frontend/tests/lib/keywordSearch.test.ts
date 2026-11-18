import { describe, expect, it } from 'vitest'
import { matchesKeywords } from '../../src/lib/keywordSearch'

describe('matchesKeywords', () => {
  it('needs every keyword, in any field, ignoring case', () => {
    expect(matchesKeywords('upper 2025', 'Upper level', '$3*** and #2025')).toBe(true)
    expect(matchesKeywords('upper 2024', 'Upper level', '$3*** and #2025')).toBe(false)
    expect(matchesKeywords('$3***', 'Upper level', '$3*** and #2025')).toBe(true)
    expect(matchesKeywords('GAME', 'game art')).toBe(true)
  })

  it('matches everything for an empty query and skips missing fields', () => {
    expect(matchesKeywords('   ', 'anything')).toBe(true)
    expect(matchesKeywords('x', null, undefined, 'x-ray')).toBe(true)
  })
})
