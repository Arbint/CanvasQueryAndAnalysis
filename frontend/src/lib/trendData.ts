import type { Student } from '../api/types'
import type { TrendCountFilter } from '../store/appStore'

// Shared by the live Trend Analysis view and its HTML snapshot export.

export const countFilterLabels: Record<TrendCountFilter, string> = {
  all: 'All students',
  active: 'Active',
  inactive: 'Inactive',
}

export const countFilters = Object.keys(countFilterLabels) as TrendCountFilter[]

/**
 * Collection columns are built with union(), which already marks a student
 * active when they are active in at least one matched course, and inactive
 * only when inactive in every one of them.
 */
export function filterByEnrollment<T extends Student>(students: T[], filter: TrendCountFilter): T[] {
  if (filter === 'all') return students
  return students.filter((s) => s.enrollment_state === filter)
}

export interface Comparison<T extends Student = Student> {
  retained: T[]
  lost: T[]
  added: T[]
}

export function compareStudents<T extends Student>(previous: T[] | null, current: T[]): Comparison<T> {
  if (!previous) return { retained: current, lost: [], added: [] }
  const previousIds = new Set(previous.map((s) => s.id))
  const currentIds = new Set(current.map((s) => s.id))
  return {
    retained: current.filter((s) => previousIds.has(s.id)),
    lost: previous.filter((s) => !currentIds.has(s.id)),
    added: current.filter((s) => !previousIds.has(s.id)),
  }
}

export interface TrendGraphLayout {
  width: number
  height: number
  padX: number
  padTop: number
  padBottom: number
  maxCount: number
  points: { x: number; y: number; count: number }[]
}

export const GRAPH_TICKS = [0, 0.25, 0.5, 0.75, 1]

/** Positions one point per column; each column's point sits over its card. */
export function layoutTrendGraph(widths: number[], counts: number[]): TrendGraphLayout {
  const gap = 8
  const maxCount = Math.max(1, ...counts)
  const contentWidth = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * gap
  const width = Math.max(640, contentWidth + 112)
  const height = 320
  const padX = 56
  const padTop = 24
  const padBottom = 88
  const plotHeight = height - padTop - padBottom
  let offset = padX
  const points = widths.map((w, i) => {
    const count = counts[i]
    const x = offset + w / 2
    const y = padTop + plotHeight - (count / maxCount) * plotHeight
    offset += w + gap
    return { x, y, count }
  })
  return { width, height, padX, padTop, padBottom, maxCount, points }
}

// --- Combined view (every analysis overlaid on one graph) ---

/** Default colors handed out to new analysis tabs, in order (One Dark Pro accents). */
export const ANALYSIS_COLORS = ['#61afef', '#98c379', '#e5c07b', '#c678dd', '#e06c75', '#56b6c2', '#d19a66']

export function defaultAnalysisColor(index: number): string {
  return ANALYSIS_COLORS[index % ANALYSIS_COLORS.length]
}

export interface CombinedSeriesColumn {
  /** Short label drawn under the axis. */
  axisLabel: string
  /** Full name, shown on hover. */
  label: string
  term: string
  count: number
}

export interface CombinedSeries {
  id: string
  name: string
  color: string
  columns: CombinedSeriesColumn[]
}

export interface CombinedGraphLayout {
  width: number
  height: number
  padX: number
  padTop: number
  padBottom: number
  maxCount: number
  /** X position of each column slot (column 1, 2, ...). */
  slotXs: number[]
  /** Y of the first label row; each series gets its own row below it. */
  labelTop: number
  labelRowHeight: number
  series: { points: { x: number; y: number; count: number }[] }[]
}

/**
 * Lays out several analyses on one graph. Columns are matched by position:
 * column N of every analysis shares slot N; a longer analysis simply extends
 * further right. Each series gets a fixed label row under the axis.
 */
export function layoutCombinedGraph(series: CombinedSeries[]): CombinedGraphLayout {
  const slot = 180
  const padX = 56
  const padTop = 24
  const plotHeight = 240
  const labelRowHeight = 16
  const slots = Math.max(1, ...series.map((s) => s.columns.length))
  const maxCount = Math.max(1, ...series.flatMap((s) => s.columns.map((c) => c.count)))
  const padBottom = 24 + Math.max(1, series.length) * labelRowHeight + 8
  const width = Math.max(640, padX * 2 + slots * slot)
  const height = padTop + plotHeight + padBottom
  const slotXs = Array.from({ length: slots }, (_, i) => padX + slot * (i + 0.5))
  return {
    width,
    height,
    padX,
    padTop,
    padBottom,
    maxCount,
    slotXs,
    labelTop: padTop + plotHeight + 24,
    labelRowHeight,
    series: series.map((s) => ({
      points: s.columns.map((c, i) => ({
        x: slotXs[i],
        y: padTop + plotHeight - (c.count / maxCount) * plotHeight,
        count: c.count,
      })),
    })),
  }
}
