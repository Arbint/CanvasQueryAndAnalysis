import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { Course, Student } from '../../src/api/types'
import { ensureSingleOutputNode, graphOutputStudents } from '../../src/components/NodeGraph/graphEngine'
import { evaluateGraphStudents, graphSourceCourses } from '../../src/lib/graphEvaluation'
import { cleanTrendColumns, isEmptySession } from '../../src/lib/sessionPersistence'
import { resolveGraphRef } from '../../src/store/graphLibraryStore'

const student = (id: number): Student => ({
  id, first_name: `F${id}`, last_name: `L${id}`, ssid: '', login_id: '', email: '', enrollment_state: 'active',
})
const course = (id: number, course_code: string, term_name: string): Course => ({
  id, name: `C${id}`, course_code, instructor: 'X', term_name, student_count: null,
})
const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data })
const edge = (source: string, target: string, targetHandle: string): Edge => ({ id: `${source}-${target}-${targetHandle}`, source, target, targetHandle, sourceHandle: 'output' })

describe('Output node', () => {
  it('adds one when missing and keeps it undeletable', () => {
    const { nodes } = ensureSingleOutputNode([node('a', 'courseNode')], [])
    const outputs = nodes.filter((n) => n.type === 'outputNode')
    expect(outputs).toHaveLength(1)
    expect(outputs[0].deletable).toBe(false)
  })

  it('drops extra Output nodes with their connections', () => {
    const { nodes, edges } = ensureSingleOutputNode(
      [node('a', 'courseNode'), node('o1', 'outputNode'), node('o2', 'outputNode')],
      [edge('a', 'o1', 'input'), edge('a', 'o2', 'input')],
    )
    expect(nodes.map((n) => n.id)).toEqual(['a', 'o1'])
    expect(edges.map((e) => e.target)).toEqual(['o1'])
  })

  it('gives the students connected to it', () => {
    const nodes = [node('a', 'courseNode'), node('b', 'courseNode'), node('s', 'subtractNode'), node('o', 'outputNode')]
    const edges = [edge('a', 's', 'from'), edge('b', 's', 'subtract-0'), edge('s', 'o', 'input')]
    const result = graphOutputStudents(nodes, edges, { a: [student(1), student(2), student(3)], b: [student(2)] })
    expect(result.map((s) => s.id)).toEqual([1, 3])
    expect(graphOutputStudents([node('o', 'outputNode')], [], {})).toEqual([])
  })
})

describe('evaluateGraphStudents', () => {
  const courses = [
    course(1, 'GAMD 3170 01', 'Fall 2025'),
    course(2, 'GAMD 3180 01', 'Spring 2026'),
    course(3, 'ANGD 3100 01', 'Fall 2025'),
    course(4, 'GAMD 1100 01', 'Fall 2025'),
  ]
  const roster: Record<number, Student[]> = {
    1: [student(1), student(2)],
    2: [student(3)],
    3: [student(4)],
    4: [student(2), student(9)],
    50: [student(1)],
  }
  // Upper-level collection minus one specific course.
  const graph = {
    nodes: [
      node('col', 'courseCollectionNode', { selectedTerms: [], department: '', filter: { id: null, name: 'Upper', expression: '$3***' } }),
      node('one', 'courseNode', { selectedCourseId: 50 }),
      node('sub', 'subtractNode'),
      node('out', 'outputNode'),
    ],
    edges: [edge('col', 'sub', 'from'), edge('one', 'sub', 'subtract-0'), edge('sub', 'out', 'input')],
  }

  it('applies the card scope to collections only, then evaluates to the Output node', async () => {
    const fetched: number[] = []
    const getStudents = async (id: number) => { fetched.push(id); return roster[id] ?? [] }
    const result = await evaluateGraphStudents(graph, courses, { selectedTerms: ['Fall 2025'], department: 'GAMD' }, [], getStudents)
    // Collection: GAMD 3*** in Fall 2025 -> course 1 only; minus course 50's student 1.
    expect(result.students.map((s) => s.id)).toEqual([2])
    expect(result.courseCount).toBe(2)
    expect(fetched.sort()).toEqual([1, 50])
  })

  it('without a scope uses every matching course', async () => {
    const sources = graphSourceCourses(graph, courses, { selectedTerms: [], department: '' }, [])
    expect(sources.col).toEqual([1, 2, 3])
    expect(sources.one).toEqual([50])
  })

  it('uses a linked filter expression from the library', () => {
    const linked = { nodes: [node('col', 'courseCollectionNode', { selectedTerms: [], department: '', filter: { id: 'f1', name: 'x', expression: '$9***' } })], edges: [] }
    const sources = graphSourceCourses(linked, courses, { selectedTerms: [], department: '' }, [{ id: 'f1', name: 'x', expression: '$1***' }])
    expect(sources.col).toEqual([4])
  })
})

describe('saved graph references and sessions', () => {
  const graph = { nodes: [node('o', 'outputNode')], edges: [] }

  it('resolves a linked graph from the library, else keeps the copy', () => {
    const ref = { id: 'g1', name: 'Old', graph }
    const newer = { nodes: [node('o', 'outputNode'), node('c', 'courseNode')], edges: [] }
    expect(resolveGraphRef(ref, [{ id: 'g1', name: 'New', graph: newer }])).toEqual({ id: 'g1', name: 'New', graph: newer })
    expect(resolveGraphRef(ref, [])).toBe(ref)
    expect(resolveGraphRef(null, [])).toBeNull()
  })

  it('saves graph cards with their graph copy, without student data', () => {
    const [column] = cleanTrendColumns([{
      id: 'c1', mode: 'graph', label: '', courseId: null, matchedCourseCount: 2, width: 240,
      collection: { selectedTerms: ['Fall 2025'], department: 'GAMD', filter: null },
      graph: { id: 'g1', name: 'Upper', graph: { nodes: [node('a', 'courseNode', { selectedCourseId: 5, students: [student(1)] })], edges: [] } },
    }])
    expect(column.graph?.name).toBe('Upper')
    expect(column.graph?.graph.nodes[0].data).toEqual({ selectedCourseId: 5 })
    expect(column.collection.selectedTerms).toEqual(['Fall 2025'])
  })

  it('treats a graph with only its Output node as empty', () => {
    expect(isEmptySession({
      version: 1, savedAt: '', courseSearch: { selectedAccountId: null, selectedTermIds: [], keywords: [] },
      graph: { nodes: [node('o', 'outputNode')], edges: [] }, trend: { analyses: [] },
    })).toBe(true)
  })
})

describe('card scope', () => {
  it('limits courses by the card Terms and Department; an empty scope allows all', async () => {
    const { courseInScope, hasScope } = await import('../../src/lib/graphEvaluation')
    const c = course(1, 'GAMD 3170 01', 'Fall 2025')
    expect(hasScope({ selectedTerms: [], department: ' ' })).toBe(false)
    expect(hasScope({ selectedTerms: ['Fall 2025'], department: '' })).toBe(true)
    expect(courseInScope(c, { selectedTerms: ['Fall 2025'], department: '' })).toBe(true)
    expect(courseInScope(c, { selectedTerms: ['Spring 2026'], department: '' })).toBe(false)
    expect(courseInScope(c, { selectedTerms: [], department: 'angd' })).toBe(false)
    expect(courseInScope(c, { selectedTerms: [], department: '' })).toBe(true)
  })
})
