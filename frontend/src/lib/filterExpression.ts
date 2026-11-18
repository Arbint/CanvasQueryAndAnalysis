import type { Course } from '../api/types'

// Course collection filter expressions.
//
//   $2*3*        course code pattern: matched against the course number, each *
//                is exactly one character ($2*3* -> 2 first, 3 third digit).
//                With letters it matches department + number: $GAMD2***
//   @Jing        faculty keyword: the instructor name contains it (any case)
//   #2025        semester keyword: #2025 any term in 2025, #FA2025 fall 2025,
//                #SP2025 spring, #SU2025 summer, #WI2025 winter, #FA any fall
//   and or not   Python-style boolean operators (precedence: not > and > or)
//   ( )          grouping
//
// Keyword values containing spaces can be quoted: @"Jingtian Li"

export type FilterTokenType = 'code' | 'faculty' | 'term' | 'operator' | 'paren' | 'space' | 'error'

export interface FilterToken {
  type: FilterTokenType
  /** Source text, including the $ / @ / # prefix and quotes. */
  text: string
  /** Value without prefix or quotes (operators lower-cased). */
  value: string
  start: number
  end: number
}

export interface FilterExpressionError {
  message: string
  start: number
  end: number
}

type FilterNode =
  | { kind: 'or' | 'and'; items: FilterNode[] }
  | { kind: 'not'; item: FilterNode }
  | { kind: 'code' | 'faculty' | 'term'; value: string }

const PREFIX_TYPES: Record<string, FilterTokenType> = { $: 'code', '@': 'faculty', '#': 'term' }
const OPERATORS = new Set(['and', 'or', 'not'])
const STOP = /[\s()]/

/** Splits an expression into tokens. Never throws; bad input becomes 'error' tokens. */
export function tokenizeFilterExpression(source: string): FilterToken[] {
  const tokens: FilterToken[] = []
  let i = 0
  const push = (type: FilterTokenType, start: number, end: number, value: string) =>
    tokens.push({ type, text: source.slice(start, end), value, start, end })

  while (i < source.length) {
    const start = i
    const ch = source[i]
    if (/\s/.test(ch)) {
      while (i < source.length && /\s/.test(source[i])) i++
      push('space', start, i, '')
    } else if (ch === '(' || ch === ')') {
      i++
      push('paren', start, i, ch)
    } else if (ch in PREFIX_TYPES) {
      i++
      let value: string
      if (source[i] === '"') {
        const close = source.indexOf('"', i + 1)
        if (close === -1) {
          i = source.length
          push('error', start, i, source.slice(start + 2))
          continue
        }
        value = source.slice(i + 1, close)
        i = close + 1
      } else {
        while (i < source.length && !STOP.test(source[i])) i++
        value = source.slice(start + 1, i)
      }
      const type = PREFIX_TYPES[ch]
      const valid = value.trim().length > 0 && (type !== 'code' || /^[A-Za-z0-9*]+$/.test(value))
      push(valid ? type : 'error', start, i, value.trim())
    } else {
      while (i < source.length && !STOP.test(source[i]) && !(source[i] in PREFIX_TYPES)) i++
      const word = source.slice(start, i)
      push(OPERATORS.has(word.toLowerCase()) ? 'operator' : 'error', start, i, word.toLowerCase())
    }
  }
  return tokens
}

function describeError(token: FilterToken): string {
  if (token.text.length <= 1) return `"${token.text}" needs a value after it`
  if (token.text[0] === '$') return `Course code pattern "${token.text}" may only contain letters, digits and *`
  if (token.text[1] === '"') return `Missing closing quote in ${token.text}`
  if (token.text[0] === '@' || token.text[0] === '#') return `"${token.text}" needs a value after it`
  return `Unknown word "${token.text}" (use $code, @faculty, #semester, and, or, not)`
}

/** Recursive-descent parser over the non-space tokens. */
function parse(tokens: FilterToken[], sourceLength: number): { node: FilterNode | null; error: FilterExpressionError | null } {
  const list = tokens.filter((t) => t.type !== 'space')
  const bad = list.find((t) => t.type === 'error')
  if (bad) return { node: null, error: { message: describeError(bad), start: bad.start, end: bad.end } }
  if (list.length === 0) return { node: null, error: null }

  let pos = 0
  const peek = () => list[pos]
  const fail = (message: string, token?: FilterToken): never => {
    throw { message, start: token?.start ?? sourceLength, end: token?.end ?? sourceLength } satisfies FilterExpressionError
  }

  const parseOr = (): FilterNode => {
    const items = [parseAnd()]
    while (peek()?.type === 'operator' && peek().value === 'or') {
      pos++
      items.push(parseAnd())
    }
    return items.length === 1 ? items[0] : { kind: 'or', items }
  }
  const parseAnd = (): FilterNode => {
    const items = [parseNot()]
    while (peek()?.type === 'operator' && peek().value === 'and') {
      pos++
      items.push(parseNot())
    }
    return items.length === 1 ? items[0] : { kind: 'and', items }
  }
  const parseNot = (): FilterNode => {
    if (peek()?.type === 'operator' && peek().value === 'not') {
      pos++
      return { kind: 'not', item: parseNot() }
    }
    return parsePrimary()
  }
  const parsePrimary = (): FilterNode => {
    const token = peek()
    if (!token) return fail('Expression ends early: expected a $code, @faculty, #semester or (')
    if (token.type === 'paren' && token.value === '(') {
      pos++
      const inner = parseOr()
      const close = peek()
      if (!close || close.type !== 'paren' || close.value !== ')') return fail('Missing closing )', close ?? token)
      pos++
      return inner
    }
    if (token.type === 'code' || token.type === 'faculty' || token.type === 'term') {
      pos++
      return { kind: token.type, value: token.value }
    }
    if (token.type === 'paren') return fail('Unexpected )', token)
    return fail(`Expected a $code, @faculty, #semester or ( before "${token.text}"`, token)
  }

  try {
    const node = parseOr()
    const extra = peek()
    if (extra) {
      const message = extra.type === 'paren'
        ? 'Unexpected )'
        : `Expected "and" or "or" before "${extra.text}"`
      fail(message, extra)
    }
    return { node, error: null }
  } catch (error) {
    return { node: null, error: error as FilterExpressionError }
  }
}

// --- Matching ---

function wildcardRegex(pattern: string, flags = ''): RegExp {
  const source = [...pattern].map((c) => (c === '*' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')
  return new RegExp(`^${source}$`, flags)
}

function courseDepartment(courseCode: string): string {
  return courseCode.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
}

function courseNumber(courseCode: string): string {
  return courseCode.match(/\d{4}/)?.[0] ?? courseCode.match(/\d+/)?.[0] ?? ''
}

type Season = 'FA' | 'SP' | 'SU' | 'WI'

const SEASON_WORDS: Record<string, Season> = {
  fa: 'FA', fall: 'FA', autumn: 'FA',
  sp: 'SP', spring: 'SP',
  su: 'SU', summer: 'SU',
  wi: 'WI', winter: 'WI',
}

/** Season and year of a Canvas term name such as "Fall 2025", "2025 Spring" or "SU2025". */
export function parseTermName(name: string): { season: Season | null; year: number | null } {
  const seasonMatch = name.match(/(?:^|[^a-z])(fall|autumn|fa|spring|sp|summer|su|winter|wi)(?![a-z])/i)
  const yearMatch = name.match(/(?:19|20)\d{2}/)
  return {
    season: seasonMatch ? SEASON_WORDS[seasonMatch[1].toLowerCase()] : null,
    year: yearMatch ? Number(yearMatch[0]) : null,
  }
}

function matchesTerm(keyword: string, termName: string): boolean {
  const parsed = keyword.match(/^(fall|autumn|spring|summer|winter|fa|sp|su|wi)?\s*((?:19|20)\d{2})?$/i)
  if (parsed && (parsed[1] || parsed[2])) {
    const term = parseTermName(termName)
    if (parsed[1] && term.season !== SEASON_WORDS[parsed[1].toLowerCase()]) return false
    if (parsed[2] && term.year !== Number(parsed[2])) return false
    return true
  }
  // Anything else: the term name contains the keyword.
  return termName.toLowerCase().includes(keyword.toLowerCase())
}

function matchesCode(pattern: string, courseCode: string): boolean {
  if (/[A-Za-z]/.test(pattern)) {
    return wildcardRegex(pattern.toUpperCase(), 'i').test(`${courseDepartment(courseCode)}${courseNumber(courseCode)}`)
  }
  return wildcardRegex(pattern).test(courseNumber(courseCode))
}

function evaluate(node: FilterNode, course: Course): boolean {
  switch (node.kind) {
    case 'or':
      return node.items.some((item) => evaluate(item, course))
    case 'and':
      return node.items.every((item) => evaluate(item, course))
    case 'not':
      return !evaluate(node.item, course)
    case 'code':
      return matchesCode(node.value, course.course_code)
    case 'faculty':
      return (course.instructor ?? '').toLowerCase().includes(node.value.toLowerCase())
    case 'term':
      return matchesTerm(node.value, course.term_name)
  }
}

export interface CompiledFilter {
  /** Null when the expression is valid (an empty expression matches every course). */
  error: FilterExpressionError | null
  matches: (course: Course) => boolean
}

const compiledCache = new Map<string, CompiledFilter>()

/** Parses an expression once; invalid expressions match no course. */
export function compileFilterExpression(source: string): CompiledFilter {
  const cached = compiledCache.get(source)
  if (cached) return cached
  const { node, error } = parse(tokenizeFilterExpression(source), source.length)
  const compiled: CompiledFilter = {
    error,
    matches: error ? () => false : node ? (course) => evaluate(node, course) : () => true,
  }
  if (compiledCache.size > 200) compiledCache.clear()
  compiledCache.set(source, compiled)
  return compiled
}

/**
 * Expression equivalent to the old include/exclude course number filters:
 * a course had to match any include pattern and no exclude pattern.
 */
export function legacyFiltersToExpression(includes: string[] = [], excludes: string[] = []): string {
  const clean = (list: string[]) => list.map((p) => p.trim()).filter((p) => /^[A-Za-z0-9*]+$/.test(p))
  const group = (list: string[]) => {
    const codes = list.map((p) => `$${p}`)
    return codes.length === 1 ? codes[0] : `(${codes.join(' or ')})`
  }
  const inc = clean(includes)
  const exc = clean(excludes)
  const parts: string[] = []
  if (inc.length) parts.push(group(inc))
  if (exc.length) parts.push(`not ${group(exc)}`)
  return parts.join(' and ')
}
