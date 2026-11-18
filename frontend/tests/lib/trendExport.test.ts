import { describe, expect, it } from 'vitest'
import { buildTrendSnapshotHtml, type TrendExportAnalysis } from '../../src/lib/trendExport'
import type { TrendExportColumn, TrendExportStudent } from '../../src/components/TrendAnalysis/TrendAnalysis'

function students(count: number, offset = 0): TrendExportStudent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: offset + i,
    first_name: `First${offset + i}`,
    last_name: `Last${offset + i}`,
    ssid: String(offset + i),
    login_id: `s${offset + i}`,
    enrollment_state: 'active',
    email: `s${offset + i}@student.example.edu`,
    displayGrade: 'A',
  }))
}

function column(number: number, count: number): TrendExportColumn {
  return {
    number,
    mode: 'course',
    label: `Course ${number}`,
    axisLabel: `C${number}`,
    axisTerm: `Term ${number}`,
    term: `Term ${number}`,
    instructor: null,
    meetingTime: null,
    matchedCourseCount: 0,
    width: 240,
    students: students(count, number * 1000),
  }
}

function analysis(name: string, color: string, counts: number[], inCombined = true): TrendExportAnalysis {
  return { name, color, inCombined, data: { countFilter: 'all', columns: counts.map((c, i) => column(i + 1, c)) } }
}

describe('buildTrendSnapshotHtml', () => {
  const html = buildTrendSnapshotHtml([
    analysis('Cohort A', '#61afef', [100, 112, 120]),
    analysis('Cohort B', '#98c379', [90, 85, 70], false),
  ])
  const doc = new DOMParser().parseFromString(html, 'text/html')

  it('gives every graph section Frame and Reset buttons with default and framed views', () => {
    const sections = doc.querySelectorAll('section.analysis')
    expect(sections.length).toBe(3)
    sections.forEach((section) => {
      expect(section.querySelector('.graph-tools button[data-view="framed"]')).not.toBeNull()
      expect(section.querySelector('.graph-tools button[data-view="default"]')).not.toBeNull()
      expect(section.querySelector('.graph--default svg')).not.toBeNull()
      expect(section.querySelector('.graph--framed')).not.toBeNull()
    })
  })

  it('pre-renders a framed combined graph per on/off combination, showing the initial one', () => {
    const variants = Array.from(doc.querySelectorAll('[data-combined-framed] > [data-mask]'))
    expect(variants.map((v) => v.getAttribute('data-mask'))).toEqual(['0', '1', '2', '3'])
    // Only Cohort A starts switched on.
    expect(variants.filter((v) => !v.hasAttribute('hidden')).map((v) => v.getAttribute('data-mask'))).toEqual(['1'])
  })

  it('labels each combined curve and gives curves a trend popup', () => {
    const labels = Array.from(doc.querySelectorAll('#combined .graph--default .combined__label')).map((l) => l.textContent)
    expect(labels).toEqual(['Cohort A', 'Cohort B'])
    const tip = doc.querySelector('#combined .graph--default g[data-series="0"] .curve-hit')!.getAttribute('data-tip')!
    expect(tip.split('\n')[0]).toBe('Cohort A')
    expect(tip).toContain('Trend: Growing')
    const singleTip = doc.querySelector('#analysis-2 .curve-hit')!.getAttribute('data-tip')!
    expect(singleTip).toContain('Trend: Declining')
  })

  it('framed single graph fits the counts instead of starting at 0', () => {
    const ticks = Array.from(doc.querySelectorAll('#analysis-1 .variant:not([hidden]) .graph--framed .trend-graph__tick'))
      .map((t) => Number(t.textContent))
    expect(Math.min(...ticks)).toBeGreaterThan(0)
  })
})
