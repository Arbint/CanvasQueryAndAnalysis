import { describe, expect, it } from 'vitest'
import { loadFraction } from '../../src/components/TrendAnalysis/LoadProgressModal'
import {
  TREND_CONFIG_KIND,
  buildTrendConfig,
  parseTrendConfig,
  readSessionFile,
} from '../../src/lib/sessionPersistence'
import type { LoadProgress, TrendAnalysisSnapshot } from '../../src/store/appStore'

const analyses: TrendAnalysisSnapshot[] = [{
  id: 'a1',
  name: 'Cohort',
  countFilter: 'active',
  color: '#61afef',
  inCombined: false,
  columns: [
    {
      id: 'c1', mode: 'course', label: 'Fall', courseId: 42,
      collection: { selectedTerms: [], department: '', filter: null }, matchedCourseCount: 0, width: 260,
    },
    {
      id: 'c2', mode: 'collection', label: '', courseId: null,
      collection: { selectedTerms: ['Fall 2025'], department: 'GAMD', filter: { id: 'f1', name: 'Upper', expression: '$3***' } },
      matchedCourseCount: 4, width: 240,
    },
    {
      id: 'c3', mode: 'prediction', label: 'Next', courseId: null,
      collection: { selectedTerms: [], department: '', filter: null }, matchedCourseCount: 0, width: 240,
      prediction: { method: 'manual', lastN: 3, manualValue: 90, note: 'New section' },
    },
  ],
}]

const courseSearch = { selectedAccountId: 1, selectedTermIds: ['101', '102'], keywords: ['GAMD'] }

describe('Trend Analysis configuration files', () => {
  it('round-trips the course search and every analysis setting', () => {
    const config = buildTrendConfig(courseSearch, analyses, new Date('2026-11-18T00:00:00Z'))
    expect(config.kind).toBe(TREND_CONFIG_KIND)
    expect(config).not.toHaveProperty('graph')
    const session = parseTrendConfig(JSON.stringify(config))
    expect(session.graph).toBeUndefined()
    expect(session.courseSearch).toEqual(courseSearch)
    expect(session.trend.analyses).toEqual([
      expect.objectContaining({ name: 'Cohort', countFilter: 'active', color: '#61afef', inCombined: false }),
    ])
    const [course, collection, prediction] = session.trend.analyses![0].columns
    expect(course).toMatchObject({ mode: 'course', label: 'Fall', courseId: 42, width: 260 })
    expect(collection.collection).toEqual({ selectedTerms: ['Fall 2025'], department: 'GAMD', filter: { id: 'f1', name: 'Upper', expression: '$3***' } })
    expect(prediction.prediction).toEqual({ method: 'manual', lastN: 3, manualValue: 90, note: 'New section' })
  })

  it('accepts a full session file, dropping its graph', () => {
    const full = { version: 1, savedAt: 'x', courseSearch, graph: { nodes: [{ id: 'n' }], edges: [] }, trend: { analyses } }
    const session = parseTrendConfig(JSON.stringify(full))
    expect(session.graph).toBeUndefined()
    expect(session.trend.analyses?.[0].name).toBe('Cohort')
  })

  it('rejects files that are not configurations', () => {
    expect(() => parseTrendConfig('not json')).toThrow(/JSON/)
    expect(() => parseTrendConfig('{"version":1}')).toThrow(/configuration/)
  })

  it('lets the header Load open a trend configuration too', async () => {
    const text = JSON.stringify(buildTrendConfig(courseSearch, analyses))
    const file = { text: async () => text } as File
    const session = await readSessionFile(file)
    expect(session.graph).toBeUndefined()
    expect(session.trend.analyses).toHaveLength(1)
  })
})

describe('loadFraction', () => {
  const progress = (over: Partial<LoadProgress>): LoadProgress => ({
    title: '', stage: 'reading', message: '', columnsDone: 0, columnsTotal: 0, warnings: [], error: null, ...over,
  })

  it('advances through the steps and the columns loaded', () => {
    expect(loadFraction(progress({ stage: 'reading' }))).toBe(0)
    expect(loadFraction(progress({ stage: 'columns', columnsDone: 2, columnsTotal: 4 }))).toBeCloseTo(0.9)
    expect(loadFraction(progress({ stage: 'done' }))).toBe(1)
  })
})
