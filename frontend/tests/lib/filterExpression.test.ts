import { describe, expect, it } from 'vitest'
import type { Course } from '../../src/api/types'
import {
  compileFilterExpression,
  legacyFiltersToExpression,
  parseTermName,
  tokenizeFilterExpression,
} from '../../src/lib/filterExpression'

const course = (course_code: string, instructor: string, term_name: string): Course => ({
  id: 1,
  name: 'Course',
  course_code,
  instructor,
  term_name,
  student_count: null,
})

const matches = (expression: string, c: Course) => {
  const compiled = compileFilterExpression(expression)
  expect(compiled.error).toBeNull()
  return compiled.matches(c)
}

describe('course code patterns', () => {
  it('matches the course number with * as one character', () => {
    expect(matches('$2*3*', course('GAMD 2330 01', '', ''))).toBe(true)
    expect(matches('$2*3*', course('GAMD 2340 01', '', ''))).toBe(false)
    expect(matches('$2*3* or $2*6*', course('GAMD 2160 01', '', ''))).toBe(true)
  })

  it('matches department + number when the pattern has letters', () => {
    expect(matches('$GAMD2***', course('GAMD 2330 01', '', ''))).toBe(true)
    expect(matches('$angd2***', course('GAMD 2330 01', '', ''))).toBe(false)
  })
})

describe('faculty and semester keywords', () => {
  it('matches instructor names containing the keyword, ignoring case', () => {
    expect(matches('@jing', course('X 1000', 'Jingtian Li', ''))).toBe(true)
    expect(matches('@"Jingtian Li"', course('X 1000', 'Prof. Jingtian Li', ''))).toBe(true)
    expect(matches('@Kim', course('X 1000', 'Jingtian Li', ''))).toBe(false)
  })

  it('matches years and season codes', () => {
    const fall = course('X 1000', '', 'Fall 2025')
    expect(matches('#2025', fall)).toBe(true)
    expect(matches('#FA2025', fall)).toBe(true)
    expect(matches('#SP2025', fall)).toBe(false)
    expect(matches('#FA2024', fall)).toBe(false)
    expect(matches('#fa', fall)).toBe(true)
    expect(matches('#SU2025', course('X 1000', '', '2025 Summer I'))).toBe(true)
    expect(matches('#SP2026', course('X 1000', '', 'SP2026'))).toBe(true)
  })

  it('parses common term name formats', () => {
    expect(parseTermName('Fall 2025')).toEqual({ season: 'FA', year: 2025 })
    expect(parseTermName('2026 Spring')).toEqual({ season: 'SP', year: 2026 })
    expect(parseTermName('SU2025')).toEqual({ season: 'SU', year: 2025 })
    expect(parseTermName('Default Term')).toEqual({ season: null, year: null })
  })
})

describe('operators and precedence', () => {
  it('evaluates the feedback example', () => {
    const expr = '($**7* or $**8*) and $3*** and @Jing and #2025'
    expect(matches(expr, course('GAMD 3170 01', 'Jingtian Li', 'Fall 2025'))).toBe(true)
    expect(matches(expr, course('GAMD 3180 01', 'Jingtian Li', 'Spring 2025'))).toBe(true)
    expect(matches(expr, course('GAMD 3160 01', 'Jingtian Li', 'Fall 2025'))).toBe(false)
    expect(matches(expr, course('GAMD 2170 01', 'Jingtian Li', 'Fall 2025'))).toBe(false)
    expect(matches(expr, course('GAMD 3170 01', 'Robert Kim', 'Fall 2025'))).toBe(false)
    expect(matches(expr, course('GAMD 3170 01', 'Jingtian Li', 'Fall 2024'))).toBe(false)
  })

  it('binds not tighter than and, and and tighter than or', () => {
    const c = course('GAMD 3170 01', 'Kim', 'Fall 2025')
    // (not $3***) or $3*7*  -> true via the second part
    expect(matches('not $3*** or $3*7*', c)).toBe(true)
    // $1*** or ($3*** and @Li) -> false
    expect(matches('$1*** or $3*** and @Li', c)).toBe(false)
    expect(matches('not not $3***', c)).toBe(true)
    expect(matches('$3*** AND NOT @Li', c)).toBe(true)
  })

  it('treats an empty expression as matching everything', () => {
    expect(matches('   ', course('X 1000', '', ''))).toBe(true)
  })
})

describe('errors', () => {
  const errorOf = (expression: string) => compileFilterExpression(expression).error

  it('reports problems with their position', () => {
    expect(errorOf('$2*3* $2*6*')).toMatchObject({ start: 6 })
    expect(errorOf('($2*3* or $2*6*')?.message).toMatch(/closing \)/)
    expect(errorOf('$2*3* and')?.message).toMatch(/ends early/)
    expect(errorOf('foo')?.message).toMatch(/Unknown word/)
    expect(errorOf('$2-3')?.message).toMatch(/letters, digits and \*/)
    expect(errorOf('@')?.message).toMatch(/needs a value/)
    expect(errorOf('@"Jing')?.message).toMatch(/closing quote/)
    expect(errorOf('$1***)')?.message).toMatch(/Unexpected \)/)
  })

  it('matches no course when invalid', () => {
    expect(compileFilterExpression('$1*** $2***').matches(course('X 1000', '', ''))).toBe(false)
  })
})

describe('tokenizer', () => {
  it('classifies every character for highlighting', () => {
    const source = '($1* or @"A B") and not #FA2025 bad'
    const tokens = tokenizeFilterExpression(source)
    expect(tokens.map((t) => t.text).join('')).toBe(source)
    expect(tokens.filter((t) => t.type !== 'space').map((t) => t.type)).toEqual([
      'paren', 'code', 'operator', 'faculty', 'paren', 'operator', 'operator', 'term', 'error',
    ])
  })
})

describe('legacyFiltersToExpression', () => {
  it('converts include/exclude number filters', () => {
    expect(legacyFiltersToExpression(['3***'], [])).toBe('$3***')
    expect(legacyFiltersToExpression(['2*3*', '2*6*'], ['2*30'])).toBe('($2*3* or $2*6*) and not $2*30')
    expect(legacyFiltersToExpression([], ['', '1***'])).toBe('not $1***')
    expect(legacyFiltersToExpression([], [])).toBe('')
  })
})
