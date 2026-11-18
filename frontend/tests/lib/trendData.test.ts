import { describe, expect, it } from 'vitest'
import {
  framedScale,
  layoutCombinedGraph,
  layoutTrendGraph,
  summarizeTrend,
  trendSummaryLines,
  zeroBasedScale,
  type CombinedSeries,
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
