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

// --- Predictions (projected columns) ---

export type PredictionMethod = 'average' | 'lastN' | 'manual'

export const predictionMethodLabels: Record<PredictionMethod, string> = {
  average: 'Total average trend',
  lastN: 'Last n columns',
  manual: 'Manual',
}

export interface PredictionSettings {
  method: PredictionMethod
  /** Columns used by 'lastN' (clamped to the columns available). */
  lastN: number
  /** Count used by 'manual'. */
  manualValue: number
  /** Why the manual value was chosen. */
  note: string
}

export function defaultPredictionSettings(): PredictionSettings {
  return { method: 'average', lastN: 3, manualValue: 0, note: '' }
}

export interface PredictionResult {
  count: number
  /** Average change rate per column (0.05 = +5%); null for manual or too few columns. */
  rate: number | null
  /** Columns the rate was computed from. */
  columnsUsed: number
  /** One-line explanation of how the count was produced. */
  basis: string
}

function percent(rate: number): string {
  const value = (rate * 100).toFixed(1)
  return `${rate > 0 ? '+' : ''}${value}%`
}

/**
 * Predicts the next count from the counts before it. The average change rate
 * is the mean of the column-to-column percentage changes (steps from a count
 * of 0 are skipped), applied to the last count.
 */
export function predictNext(previous: number[], settings: PredictionSettings): PredictionResult {
  if (settings.method === 'manual') {
    const count = Math.max(0, Math.round(Number(settings.manualValue) || 0))
    return { count, rate: null, columnsUsed: 0, basis: settings.note.trim() ? `Manual: ${settings.note.trim()}` : 'Manual value' }
  }
  if (previous.length < 2) {
    const count = previous[previous.length - 1] ?? 0
    return { count, rate: null, columnsUsed: previous.length, basis: 'Needs at least 2 columns before it' }
  }
  const n = settings.method === 'lastN'
    ? Math.min(previous.length, Math.max(2, Math.round(settings.lastN) || 2))
    : previous.length
  const window = previous.slice(-n)
  const rates: number[] = []
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1] > 0) rates.push((window[i] - window[i - 1]) / window[i - 1])
  }
  const rate = rates.length ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0
  const last = window[window.length - 1]
  const count = Math.max(0, Math.round(last * (1 + rate)))
  const scope = settings.method === 'lastN' ? `last ${n} columns` : `all ${n} columns`
  return { count, rate, columnsUsed: n, basis: `Avg change ${percent(rate)} per column over ${scope}` }
}

/** A column as far as counting goes: its students, or prediction settings. */
export interface CountableColumn {
  students: Student[]
  prediction?: PredictionSettings | null
}

/**
 * Count per column under a count filter. A prediction column predicts from
 * every column before it (earlier predictions included, so several in a row
 * project further ahead).
 */
export function columnCounts(columns: CountableColumn[], filter: TrendCountFilter): {
  counts: number[]
  predictions: (PredictionResult | null)[]
} {
  const counts: number[] = []
  const predictions: (PredictionResult | null)[] = []
  for (const column of columns) {
    if (column.prediction) {
      const result = predictNext(counts, column.prediction)
      counts.push(result.count)
      predictions.push(result)
    } else {
      counts.push(filterByEnrollment(column.students, filter).length)
      predictions.push(null)
    }
  }
  return { counts, predictions }
}

/**
 * Index of the column each column compares its students with: the nearest
 * real (non-prediction) column before it, or null.
 */
export function previousRealIndex(isPrediction: boolean[], index: number): number | null {
  for (let i = index - 1; i >= 0; i--) if (!isPrediction[i]) return i
  return null
}

// --- Graph scales and framing ---

/** Vertical axis of a graph: the value range shown and where grid lines sit. */
export interface YScale {
  min: number
  max: number
  ticks: number[]
}

/** Pixel size to fit a graph into ("frame" it), like a graph editor's Frame All. */
export interface FrameSize {
  width: number
  height: number
}

export const GRAPH_TICKS = [0, 0.25, 0.5, 0.75, 1]

/** Default axis: 0 up to the largest count. */
export function zeroBasedScale(values: number[]): YScale {
  const max = Math.max(1, ...values)
  return { min: 0, max, ticks: GRAPH_TICKS.map((t) => max * t) }
}

function niceStep(range: number, target: number): number {
  const raw = range / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * magnitude
  return Math.max(1, step)
}

/**
 * Framed axis: the counts' own range plus a little headroom, on whole-number
 * ticks, so small differences between columns fill the graph height.
 */
export function framedScale(values: number[]): YScale {
  if (values.length === 0) return zeroBasedScale(values)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = hi === lo ? Math.max(1, Math.abs(hi) * 0.1) : (hi - lo) * 0.1
  lo = Math.max(0, lo - pad)
  hi += pad
  const step = niceStep(hi - lo, 4)
  const min = Math.floor(lo / step) * step
  const max = Math.max(min + step, Math.ceil(hi / step) * step)
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v)
  return { min, max, ticks }
}

/** Y pixel of a value on a scale whose plot area spans top..top+height. */
export function scaleY(scale: YScale, value: number, top: number, height: number): number {
  const span = scale.max - scale.min || 1
  return top + height - ((value - scale.min) / span) * height
}

export function formatTick(value: number): string {
  return String(Math.round(value))
}

export interface TrendGraphLayout {
  width: number
  height: number
  padX: number
  padTop: number
  padBottom: number
  scale: YScale
  points: { x: number; y: number; count: number }[]
}

/**
 * Positions one point per column. By default each column's point sits over
 * its card; with `frame`, the points spread evenly across the given size and
 * the axis fits the counts.
 */
export function layoutTrendGraph(widths: number[], counts: number[], frame?: FrameSize): TrendGraphLayout {
  const gap = 8
  const padX = 56
  const padTop = 24
  const padBottom = 88
  if (frame) {
    const width = Math.max(240, frame.width)
    const height = Math.max(padTop + padBottom + 80, frame.height)
    const plotHeight = height - padTop - padBottom
    const scale = framedScale(counts)
    const slot = (width - padX * 2) / Math.max(1, counts.length)
    const points = counts.map((count, i) => ({
      x: padX + slot * (i + 0.5),
      y: scaleY(scale, count, padTop, plotHeight),
      count,
    }))
    return { width, height, padX, padTop, padBottom, scale, points }
  }
  const scale = zeroBasedScale(counts)
  const contentWidth = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * gap
  const width = Math.max(640, contentWidth + 112)
  const height = 320
  const plotHeight = height - padTop - padBottom
  let offset = padX
  const points = widths.map((w, i) => {
    const count = counts[i]
    const x = offset + w / 2
    const y = scaleY(scale, count, padTop, plotHeight)
    offset += w + gap
    return { x, y, count }
  })
  return { width, height, padX, padTop, padBottom, scale, points }
}

export interface CurveSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Leads to or from a predicted point. */
  predicted: boolean
}

/** Line segments between consecutive points; segments touching a predicted point are marked. */
export function curveSegments(points: { x: number; y: number }[], predicted: boolean[]): CurveSegment[] {
  const segments: CurveSegment[] = []
  for (let i = 1; i < points.length; i++) {
    segments.push({
      x1: points[i - 1].x,
      y1: points[i - 1].y,
      x2: points[i].x,
      y2: points[i].y,
      predicted: Boolean(predicted[i] || predicted[i - 1]),
    })
  }
  return segments
}

/**
 * Trend summary of a curve's actual (non-predicted) points, so projections
 * do not count as evidence of the trend. `columnName` gets the original index.
 */
export function actualTrendLines(
  counts: number[],
  predicted: boolean[],
  columnName: (index: number) => string,
): string[] | null {
  const actual = counts.map((count, index) => ({ count, index })).filter((p) => !predicted[p.index])
  const summary = summarizeTrend(actual.map((p) => p.count))
  if (!summary) return null
  const lines = trendSummaryLines(summary, (i) => columnName(actual[i].index))
  const projected = predicted.filter(Boolean).length
  if (projected) lines.push(`Projected: ${projected} prediction column${projected === 1 ? '' : 's'} (dashed)`)
  return lines
}

// --- Curve summaries (hover popups) ---

export type TrendDirection = 'growing' | 'declining' | 'stable' | 'single'

export const trendDirectionLabels: Record<TrendDirection, string> = {
  growing: 'Growing',
  declining: 'Declining',
  stable: 'Stable',
  single: 'Single column',
}

export interface TrendSummary {
  direction: TrendDirection
  first: number
  last: number
  change: number
  /** Change as a percentage of the first count; null when the first count is 0. */
  changePct: number | null
  /** Least-squares slope: average students gained (or lost) per column. */
  slope: number
  average: number
  peak: { index: number; count: number }
  low: { index: number; count: number }
  columnCount: number
}

/** Overall trend of a curve, judged by its least-squares slope relative to its mean. */
export function summarizeTrend(counts: number[]): TrendSummary | null {
  const n = counts.length
  if (n === 0) return null
  const average = counts.reduce((sum, c) => sum + c, 0) / n
  const meanX = (n - 1) / 2
  let num = 0
  let den = 0
  counts.forEach((c, i) => {
    num += (i - meanX) * (c - average)
    den += (i - meanX) ** 2
  })
  const slope = den === 0 ? 0 : num / den
  // Total fitted change across the curve, relative to its average size.
  const relative = (slope * (n - 1)) / Math.max(1, average)
  const direction: TrendDirection =
    n < 2 ? 'single' : relative > 0.05 ? 'growing' : relative < -0.05 ? 'declining' : 'stable'
  let peak = { index: 0, count: counts[0] }
  let low = { index: 0, count: counts[0] }
  counts.forEach((count, index) => {
    if (count > peak.count) peak = { index, count }
    if (count < low.count) low = { index, count }
  })
  const first = counts[0]
  const last = counts[n - 1]
  return {
    direction,
    first,
    last,
    change: last - first,
    changePct: first === 0 ? null : ((last - first) / first) * 100,
    slope,
    average,
    peak,
    low,
    columnCount: n,
  }
}

function signed(value: number, digits = 0): string {
  const text = Math.abs(value).toFixed(digits)
  if (Number(text) === 0) return text
  return value > 0 ? `+${text}` : `-${text}`
}

/** Text lines describing a curve, shared by the live popup and the export's hover titles. */
export function trendSummaryLines(summary: TrendSummary, columnName: (index: number) => string): string[] {
  const lines = [`Trend: ${trendDirectionLabels[summary.direction]}`]
  if (summary.columnCount > 1) {
    const pct = summary.changePct === null ? '' : `, ${signed(summary.changePct, 1)}%`
    lines.push(`Overall: ${summary.first} → ${summary.last} (${signed(summary.change)}${pct})`)
    lines.push(`Avg change per column: ${signed(summary.slope, 1)}`)
  }
  lines.push(`Peak: ${summary.peak.count} at ${columnName(summary.peak.index)}`)
  lines.push(`Low: ${summary.low.count} at ${columnName(summary.low.index)}`)
  lines.push(
    `Average: ${summary.average.toFixed(1)} over ${summary.columnCount} column${summary.columnCount === 1 ? '' : 's'}`,
  )
  return lines
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
  /** A projected count (prediction column), drawn dashed and hollow. */
  predicted?: boolean
}

export interface CombinedSeries {
  id: string
  name: string
  color: string
  columns: CombinedSeriesColumn[]
}

/** An analysis's columns as a combined-view series (counts under its own count filter). */
export function seriesColumns(data: {
  countFilter: TrendCountFilter
  columns: (CountableColumn & { axisLabel: string; label: string; axisTerm: string })[]
}): CombinedSeriesColumn[] {
  const { counts } = columnCounts(data.columns, data.countFilter)
  return data.columns.map((c, i) => ({
    axisLabel: c.axisLabel,
    label: c.label,
    term: c.axisTerm,
    count: counts[i],
    predicted: Boolean(c.prediction),
  }))
}

export interface CurveLabel {
  x: number
  y: number
  text: string
}

export interface CombinedGraphLayout {
  width: number
  height: number
  padX: number
  padTop: number
  padBottom: number
  scale: YScale
  /** X position of each column slot (column 1, 2, ...). */
  slotXs: number[]
  /** Y of the first label row; each series gets its own row below it. */
  labelTop: number
  labelRowHeight: number
  series: { points: { x: number; y: number; count: number }[]; label: CurveLabel | null }[]
}

const CURVE_LABEL_MAX_CHARS = 22
const CURVE_LABEL_CHAR_WIDTH = 6.6
const CURVE_LABEL_HEIGHT = 14

export function curveLabelText(name: string): string {
  return name.length > CURVE_LABEL_MAX_CHARS ? `${name.slice(0, CURVE_LABEL_MAX_CHARS - 1)}…` : name
}

type LabelAnchor = { x: number; y: number; text: string }

/**
 * Names each curve just right of its last point. Labels that would overlap
 * (similar height and overlapping horizontally) are pushed apart vertically.
 */
function placeCurveLabels(anchors: (LabelAnchor | null)[], minY: number, maxY: number): (CurveLabel | null)[] {
  const order = anchors
    .map((anchor, index) => ({ anchor, index }))
    .filter((e): e is { anchor: LabelAnchor; index: number } => e.anchor !== null)
    .sort((p, q) => p.anchor.y - q.anchor.y)
  const placed: { x: number; right: number; y: number }[] = []
  const result: (CurveLabel | null)[] = anchors.map(() => null)
  for (const { anchor, index } of order) {
    const x = anchor.x + 12
    const right = x + anchor.text.length * CURVE_LABEL_CHAR_WIDTH
    let y = Math.max(minY, anchor.y + 4)
    let moved = true
    while (moved) {
      moved = false
      for (const p of placed) {
        if (right > p.x && x < p.right && Math.abs(p.y - y) < CURVE_LABEL_HEIGHT) {
          y = p.y + CURVE_LABEL_HEIGHT
          moved = true
        }
      }
    }
    y = Math.min(maxY, y)
    placed.push({ x, right, y })
    result[index] = { x, y, text: anchor.text }
  }
  return result
}

/**
 * Lays out several analyses on one graph. Columns are matched by position:
 * column N of every analysis shares slot N; a longer analysis simply extends
 * further right. Each series gets a fixed label row under the axis and a
 * name label at the end of its curve. With `frame`, the graph fills the given
 * size and the axis fits the counts.
 */
export function layoutCombinedGraph(series: CombinedSeries[], frame?: FrameSize): CombinedGraphLayout {
  const padX = 56
  const padTop = 24
  const labelRowHeight = 16
  const slots = Math.max(1, ...series.map((s) => s.columns.length))
  const counts = series.flatMap((s) => s.columns.map((c) => c.count))
  const padBottom = 24 + Math.max(1, series.length) * labelRowHeight + 8
  const longestLabel = Math.max(0, ...series.map((s) => curveLabelText(s.name).length))
  // Extra room right of the last slot so the curve name labels are not cut off.
  const labelSpace = Math.max(0, longestLabel * CURVE_LABEL_CHAR_WIDTH + 16 - padX)
  let slot = 180
  let plotHeight = 240
  let scale = zeroBasedScale(counts)
  if (frame) {
    slot = Math.max(48, (frame.width - padX * 2 - labelSpace) / slots)
    plotHeight = Math.max(80, frame.height - padTop - padBottom)
    scale = framedScale(counts)
  }
  const naturalWidth = padX * 2 + slots * slot + labelSpace
  const width = frame ? Math.max(frame.width, naturalWidth) : Math.max(640, naturalWidth)
  const height = padTop + plotHeight + padBottom
  const slotXs = Array.from({ length: slots }, (_, i) => padX + slot * (i + 0.5))
  const laidOut = series.map((s) =>
    s.columns.map((c, i) => ({
      x: slotXs[i],
      y: scaleY(scale, c.count, padTop, plotHeight),
      count: c.count,
    })),
  )
  const labels = placeCurveLabels(
    laidOut.map((points, si) => {
      const last = points[points.length - 1]
      return last ? { x: last.x, y: last.y, text: curveLabelText(series[si].name) } : null
    }),
    padTop + 10,
    padTop + plotHeight + 4,
  )
  return {
    width,
    height,
    padX,
    padTop,
    padBottom,
    scale,
    slotXs,
    labelTop: padTop + plotHeight + 24,
    labelRowHeight,
    series: laidOut.map((points, si) => ({ points, label: labels[si] })),
  }
}
