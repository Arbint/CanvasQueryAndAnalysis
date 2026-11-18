import { describe, expect, it } from 'vitest'
import {
  actualTrendLines,
  columnCounts,
  defaultPredictionSettings,
  framedScale,
  layoutCombinedGraph,
  layoutTrendGraph,
  predictNext,
  previousRealIndex,
  summarizeTrend,
  trendSummaryLines,
  zeroBasedScale,
  type CombinedSeries,
  type PredictionSettings,
} from '../../src/lib/trendData'

describe('scales', () => {
  it('zero-based scale runs from 0 to the max count', () => {
    const s = zeroBasedScale([10, 40, 20])
    expect(s.min).toBe(0)
    expect(s.max).toBe(40)
    expect(s.ticks).toEqual([0, 10, 20, 30, 40])
  })

  it('framed scale hugs the data range on whole-number ticks', () => {
    const s = framedScale([102, 110, 118])
    expect(s.min).toBeGreaterThan(0)
    expect(s.min).toBeLessThanOrEqual(102)
    expect(s.max).toBeGreaterThanOrEqual(118)
    expect(s.max - s.min).toBeLessThan(40)
    expect(s.ticks.every((t) => Number.isInteger(t))).toBe(true)
    expect(s.ticks[0]).toBe(s.min)
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max)
  })

  it('framed scale handles a flat curve', () => {
    const s = framedScale([50, 50])
    expect(s.min).toBeLessThan(50)
    expect(s.max).toBeGreaterThan(50)
  })
})

describe('layoutTrendGraph framing', () => {
  it('fits the points to the frame horizontally and vertically', () => {
    const g = layoutTrendGraph([240, 240, 240], [100, 120, 110], { width: 900, height: 400 })
    expect(g.width).toBe(900)
    expect(g.height).toBe(400)
    const ys = g.points.map((p) => p.y)
    const plotBottom = g.height - g.padBottom
    // Max sits near the top and min near the bottom of the plot area.
    expect(Math.min(...ys)).toBeLessThan(g.padTop + (plotBottom - g.padTop) * 0.25)
    expect(Math.max(...ys)).toBeGreaterThan(g.padTop + (plotBottom - g.padTop) * 0.75)
    expect(g.points[g.points.length - 1].x).toBeLessThan(900 - g.padX)
  })
})

describe('summarizeTrend', () => {
  it('detects growth, decline and stability', () => {
    expect(summarizeTrend([10, 20, 30])!.direction).toBe('growing')
    expect(summarizeTrend([30, 20, 10])!.direction).toBe('declining')
    expect(summarizeTrend([100, 101, 99, 100])!.direction).toBe('stable')
    expect(summarizeTrend([5])!.direction).toBe('single')
    expect(summarizeTrend([])).toBeNull()
  })

  it('reports change, peak and low', () => {
    const s = summarizeTrend([80, 120, 60])!
    expect(s.change).toBe(-20)
    expect(s.changePct).toBeCloseTo(-25)
    expect(s.peak).toEqual({ index: 1, count: 120 })
    expect(s.low).toEqual({ index: 2, count: 60 })
    const lines = trendSummaryLines(s, (i) => `col ${i + 1}`)
    expect(lines).toContain('Overall: 80 → 60 (-20, -25.0%)')
    expect(lines).toContain('Peak: 120 at col 2')
  })
})

describe('layoutCombinedGraph curve labels', () => {
  const series = (name: string, counts: number[]): CombinedSeries => ({
    id: name,
    name,
    color: '#fff',
    columns: counts.map((count) => ({ axisLabel: 'x', label: 'x', term: '', count })),
  })

  it('labels each curve at its end and keeps overlapping labels apart', () => {
    const g = layoutCombinedGraph([series('Alpha', [10, 50]), series('Beta', [10, 50])])
    const [a, b] = g.series.map((s) => s.label!)
    expect(a.text).toBe('Alpha')
    expect(a.x).toBeGreaterThan(g.series[0].points[1].x)
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(14)
    // Room is left for the label right of the last slot.
    expect(g.width).toBeGreaterThan(a.x + 'Alpha'.length * 6)
  })
})

describe('predictions', () => {
  const settings = (over: Partial<PredictionSettings> = {}): PredictionSettings => ({ ...defaultPredictionSettings(), ...over })

  it('total average trend applies the mean column-to-column change rate to the last count', () => {
    // +10%, then -50% -> average -20%; 55 * 0.8 = 44
    const r = predictNext([100, 110, 55], settings())
    expect(r.rate).toBeCloseTo(-0.2)
    expect(r.count).toBe(44)
    expect(r.columnsUsed).toBe(3)
  })

  it('last n columns uses only the last n, clamping n to the columns available', () => {
    const lastTwo = predictNext([100, 50, 60], settings({ method: 'lastN', lastN: 2 }))
    expect(lastTwo.rate).toBeCloseTo(0.2)
    expect(lastTwo.count).toBe(72)
    const tooMany = predictNext([100, 50, 60], settings({ method: 'lastN', lastN: 10 }))
    expect(tooMany.columnsUsed).toBe(3)
    expect(tooMany.count).toBe(predictNext([100, 50, 60], settings()).count)
  })

  it('manual uses the given value and note', () => {
    const r = predictNext([1, 2, 3], settings({ method: 'manual', manualValue: 75, note: 'Two new sections' }))
    expect(r.count).toBe(75)
    expect(r.rate).toBeNull()
    expect(r.basis).toContain('Two new sections')
  })

  it('needs two columns to compute a rate, and skips steps from 0', () => {
    expect(predictNext([40], settings()).basis).toMatch(/at least 2/)
    expect(predictNext([0, 10, 20], settings()).rate).toBeCloseTo(1)
  })

  it('columnCounts chains predictions and previousRealIndex skips them', () => {
    const student = (id: number) => ({ id, first_name: '', last_name: '', ssid: '', login_id: '', email: '', enrollment_state: 'active' as const })
    const students = (n: number) => Array.from({ length: n }, (_, i) => student(i))
    const { counts, predictions } = columnCounts(
      [{ students: students(100) }, { students: students(110) }, { students: [], prediction: settings() }, { students: [], prediction: settings() }],
      'all',
    )
    expect(counts).toEqual([100, 110, 121, 133])
    expect(predictions.map((p) => p !== null)).toEqual([false, false, true, true])
    expect(previousRealIndex([false, true, false], 2)).toBe(0)
    expect(previousRealIndex([true, false], 1)).toBeNull()
  })

  it('actualTrendLines ignores predicted points', () => {
    const lines = actualTrendLines([100, 90, 200], [false, false, true], (i) => `c${i + 1}`)!
    expect(lines[0]).toBe('Trend: Declining')
    expect(lines).toContain('Projected: 1 prediction column (dashed)')
  })
})
