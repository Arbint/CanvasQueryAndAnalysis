import type { Course } from '../api/types'
import { compileFilterExpression, legacyFiltersToExpression } from './filterExpression'

/**
 * The filter expression a collection uses. `id` links it to a saved expression
 * in the filter library (editing that entry updates every collection using it);
 * name and expression are kept as a copy so sessions still work on a browser
 * whose library does not have it. A null id is an unsaved, inline expression.
 */
export interface CollectionFilterRef {
  id: string | null
  name: string
  expression: string
}

export interface CourseCollectionFilters {
  selectedTerms: string[]
  department: string
  filter: CollectionFilterRef | null
}

export function emptyCourseCollectionFilters(): CourseCollectionFilters {
  return { selectedTerms: [], department: '', filter: null }
}

/** Saved shapes accepted when restoring a collection, including pre-expression ones. */
export interface StoredCollectionFilters {
  selectedTerms?: string[]
  department?: string
  filter?: CollectionFilterRef | null
  /** Legacy graph node filters. */
  includeFilters?: string[]
  excludeFilters?: string[]
  /** Legacy trend column filter. */
  numberPattern?: string
}

/** Restores saved filters, converting the old include/exclude/number filters to an expression. */
export function normalizeCollectionFilters(stored: StoredCollectionFilters | undefined | null): CourseCollectionFilters {
  const base = {
    selectedTerms: [...(stored?.selectedTerms ?? [])],
    department: stored?.department ?? '',
  }
  if (stored?.filter !== undefined) return { ...base, filter: stored.filter ? { ...stored.filter } : null }
  const includes = [...(stored?.includeFilters ?? [])]
  if (stored?.numberPattern?.trim()) includes.push(stored.numberPattern)
  const expression = legacyFiltersToExpression(includes, stored?.excludeFilters ?? [])
  // Named after the expression itself, so trend axis labels stay as informative as the old pattern.
  return { ...base, filter: expression ? { id: null, name: expression, expression } : null }
}

export function parseDepartment(courseCode: string): string {
  return courseCode.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? ''
}

export function parseCourseNumber(courseCode: string): string {
  return courseCode.match(/\d{4}/)?.[0] ?? courseCode.match(/\d+/)?.[0] ?? ''
}

// Each * stands for exactly one character; everything else is literal.
function wildcardToRegexSource(pattern: string): string {
  return [...pattern]
    .map((c) => (c === '*' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
}

export function matchesWildcard(pattern: string, value: string): boolean {
  return new RegExp(`^${wildcardToRegexSource(pattern)}$`).test(value)
}

/** Case-insensitive "contains" match, with the same * wildcard as matchesWildcard. */
export function containsWildcard(pattern: string, value: string): boolean {
  return new RegExp(wildcardToRegexSource(pattern), 'i').test(value)
}

/**
 * Whether a course belongs to a collection. `filters.filter` should already be
 * resolved against the library (see resolveCollectionFilters).
 */
export function courseMatchesFilters(course: Course, filters: CourseCollectionFilters): boolean {
  const { selectedTerms, department, filter } = filters
  if (selectedTerms.length > 0 && !selectedTerms.includes(course.term_name)) return false
  if (department.trim() && parseDepartment(course.course_code) !== department.trim().toUpperCase()) return false
  if (filter && !compileFilterExpression(filter.expression).matches(course)) return false
  return true
}

/** Uses the library's current name and expression for a linked filter. */
export function resolveCollectionFilters(
  filters: CourseCollectionFilters,
  library: { id: string; name: string; expression: string }[],
): CourseCollectionFilters {
  const ref = filters.filter
  if (!ref?.id) return filters
  const saved = library.find((f) => f.id === ref.id)
  if (!saved || (saved.name === ref.name && saved.expression === ref.expression)) return filters
  return { ...filters, filter: { id: saved.id, name: saved.name, expression: saved.expression } }
}
