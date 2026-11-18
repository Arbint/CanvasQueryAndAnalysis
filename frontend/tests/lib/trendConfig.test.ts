import { describe, expect, it } from 'vitest'
import { loadFraction } from '../../src/components/shared/LoadProgressModal'
import {
  GRAPH_CONFIG_KIND,
  TREND_CONFIG_KIND,
  buildGraphConfig,
  buildTrendConfig,
  parseGraphConfig,
  parseTrendConfig,
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
    expect(session.trend?.analyses).toEqual([
      expect.objectContaining({ name: 'Cohort', countFilter: 'active', color: '#61afef', inCombined: false }),
    ])
    const [course, collection, prediction] = session.trend!.analyses![0].columns
    expect(course).toMatchObject({ mode: 'course', label: 'Fall', courseId: 42, width: 260 })
    expect(collection.collection).toEqual({ selectedTerms: ['Fall 2025'], department: 'GAMD', filter: { id: 'f1', name: 'Upper', expression: '$3***' } })
    expect(prediction.prediction).toEqual({ method: 'manual', lastN: 3, manualValue: 90, note: 'New section' })
  })

  it('accepts a full session file, dropping its graph', () => {
    const full = { version: 1, savedAt: 'x', courseSearch, graph: { nodes: [{ id: 'n' }], edges: [] }, trend: { analyses } }
    const session = parseTrendConfig(JSON.stringify(full))
    expect(session.graph).toBeUndefined()
    expect(session.trend?.analyses?.[0].name).toBe('Cohort')
  })

  it('rejects files that are not configurations', () => {
    expect(() => parseTrendConfig('not json')).toThrow(/JSON/)
    expect(() => parseTrendConfig('{"version":1}')).toThrow(/configuration/)
  })

  it('points a graph configuration to the graph Load', () => {
    const graphFile = JSON.stringify(buildGraphConfig(courseSearch, { nodes: [], edges: [] }))
    expect(() => parseTrendConfig(graphFile)).toThrow(/Aggregation Graph/)
  })
})

describe('Aggregation Graph configuration files', () => {
  const graph = {
    nodes: [
      { id: 'n1', type: 'courseNode', position: { x: 10, y: 20 }, data: { selectedCourseId: 42, students: [{ id: 1 }] } },
      { id: 'n2', type: 'courseCollectionNode', position: { x: 300, y: 20 }, data: { filter: { id: null, name: '$3***', expression: '$3***' } } },
      { id: 'n3', type: 'unionNode', position: { x: 600, y: 20 }, data: { inputCount: 2 } },
    ],
    edges: [{ id: 'e1', source: 'n1', sourceHandle: 'output', target: 'n3', targetHandle: 'input-0' }],
  }

  it('round-trips the course search and graph, without student data or a trend part', () => {
    const config = buildGraphConfig(courseSearch, graph)
    expect(config.kind).toBe(GRAPH_CONFIG_KIND)
    expect(config).not.toHaveProperty('trend')
    const session = parseGraphConfig(JSON.stringify(config))
    expect(session.trend).toBeUndefined()
    expect(session.courseSearch).toEqual(courseSearch)
    expect(session.graph!.nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3'])
    expect(session.graph!.nodes[0].data).toEqual({ selectedCourseId: 42 })
    expect(session.graph!.nodes[1].data.filter).toEqual({ id: null, name: '$3***', expression: '$3***' })
    expect(session.graph!.edges).toEqual([expect.objectContaining({ source: 'n1', target: 'n3', targetHandle: 'input-0' })])
  })

  it('accepts an old full session file, dropping its trend part', () => {
    const full = { version: 1, savedAt: 'x', courseSearch, graph, trend: { analyses } }
    const session = parseGraphConfig(JSON.stringify(full))
    expect(session.trend).toBeUndefined()
    expect(session.graph!.nodes).toHaveLength(3)
  })

  it('rejects other files, pointing a trend configuration to Trend Analysis', () => {
    expect(() => parseGraphConfig('nope')).toThrow(/JSON/)
    expect(() => parseGraphConfig(JSON.stringify({ version: 1, courseSearch }))).toThrow(/Aggregation Graph configuration/)
    expect(() => parseGraphConfig(JSON.stringify(buildTrendConfig(courseSearch, analyses)))).toThrow(/Trend Analysis/)
  })
})

describe('loadFraction', () => {
  const progress = (over: Partial<LoadProgress>): LoadProgress => ({
    title: '', kind: 'trend', stage: 'reading', message: '', columnsDone: 0, columnsTotal: 0, warnings: [], error: null, ...over,
  })

  it('advances through the steps and the columns loaded', () => {
    expect(loadFraction(progress({ stage: 'reading' }))).toBe(0)
    expect(loadFraction(progress({ stage: 'columns', columnsDone: 2, columnsTotal: 4 }))).toBeCloseTo(0.9)
    expect(loadFraction(progress({ stage: 'done' }))).toBe(1)
  })

  it('uses the graph steps for a graph load', () => {
    expect(loadFraction(progress({ kind: 'graph', stage: 'courses' }))).toBeCloseTo(0.5)
    expect(loadFraction(progress({ kind: 'graph', stage: 'graph' }))).toBeCloseTo(0.75)
  })
})
