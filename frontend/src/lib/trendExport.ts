import type { Student } from '../api/types'
import type { TrendExportColumn, TrendExportData, TrendExportStudent } from '../components/TrendAnalysis/TrendAnalysis'
import type { TrendCountFilter } from '../store/appStore'
import {
  GRAPH_TICKS,
  compareStudents,
  countFilterLabels,
  countFilters,
  filterByEnrollment,
  layoutCombinedGraph,
  layoutTrendGraph,
  type CombinedSeries,
  type Comparison,
} from './trendData'

export interface TrendExportAnalysis {
  name: string
  /** Tab color code, used for its line and labels in the combined view. */
  color: string
  /** Whether the combined view starts with this analysis switched on. */
  inCombined: boolean
  data: TrendExportData
}

function esc(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Standalone stylesheet for the exported file (it cannot reach the app's theme.css),
// using the same One Dark Pro palette.
const SNAPSHOT_CSS = `
:root {
  --bg-base: #282c34; --bg-elevated: #2c313a; --bg-overlay: #21252b; --bg-input: #1d2026;
  --surface-1: #31353f; --border: #404754;
  --text: #abb2bf; --heading: #e6efff; --muted: #7f899e;
  --blue: #61afef; --green: #98c379; --yellow: #e5c07b; --red: #e06c75; --cyan: #56b6c2;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg-base); color: var(--text); font: 14px 'Segoe UI', system-ui, sans-serif; }
header { padding: 16px 24px; background: var(--bg-overlay); border-bottom: 1px solid var(--border); }
h1 { margin: 0 0 4px; color: var(--heading); font-size: 20px; }
h2 { margin: 0 0 12px; color: var(--heading); font-size: 18px; }
.generated { color: var(--muted); font-size: 12px; }
.analysis__head { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.analysis__head h2 { margin: 0; }
.count-filter { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.count-filter select { height: 26px; padding: 0 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text); font: inherit; }
.toc { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.toc a { padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; color: var(--blue); text-decoration: none; font-size: 12px; }
.toc a:hover { background: var(--surface-1); }
main { padding: 24px; display: grid; gap: 32px; }
section.analysis { padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-elevated); }
.graph { overflow-x: auto; margin-bottom: 16px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-base); }
.graph svg { display: block; margin: 0 auto; }
.trend-graph__axis { stroke: #636d83; stroke-width: 1; }
.trend-graph__grid { stroke: var(--border); stroke-width: 1; opacity: 0.45; }
.trend-graph__tick, .trend-graph__count, .trend-graph__x-term { fill: var(--muted); font-size: 11px; }
.trend-graph__x-label { fill: var(--text); font-size: 11px; font-weight: 600; }
.trend-graph__line { fill: none; stroke: var(--cyan); stroke-width: 2; }
.trend-graph__column-line { stroke: var(--border); stroke-width: 1; stroke-dasharray: 4 4; opacity: 0.55; }
.trend-graph__dot { fill: var(--blue); stroke: var(--bg-base); stroke-width: 2; }
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; }
th { color: var(--heading); background: var(--bg-overlay); font-weight: 600; }
td.num, th.num { text-align: right; }
.lost { color: var(--red); } .added { color: var(--green); }
.columns { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; align-items: flex-start; }
.column { flex: 0 0 260px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-1); }
.column--collection { border-top: 2px solid var(--green); }
.column__head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.column__number { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; background: var(--bg-input); color: var(--cyan); font-size: 11px; font-weight: 700; }
.column__title { color: var(--heading); font-weight: 600; }
.column__meta { display: grid; gap: 2px; margin-bottom: 8px; padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); font-size: 12px; }
.column__meta div { display: flex; justify-content: space-between; gap: 8px; }
.column__meta span { color: var(--muted); }
.column__meta strong { color: var(--text); text-align: right; }
ul { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; font-size: 12px; }
li { display: flex; justify-content: space-between; gap: 8px; padding: 3px 4px; border-bottom: 1px solid #3b404a; }
li .grade { color: var(--yellow); font-weight: 600; }
details { margin-top: 8px; font-size: 12px; }
summary { cursor: pointer; color: var(--text); }
.empty { color: var(--muted); font-style: italic; }
.combined__toggles { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.combined__toggle { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid var(--border); border-radius: 12px; font-size: 12px; cursor: pointer; user-select: none; }
.combined__toggle input { accent-color: var(--series-color); margin: 0; }
.combined__swatch { width: 10px; height: 10px; border-radius: 50%; background: var(--series-color); }
.combined__note { margin-bottom: 12px; color: var(--muted); font-size: 12px; }
.combined__line { fill: none; stroke: currentColor; stroke-width: 2; }
.combined__dot { fill: currentColor; stroke: var(--bg-base); stroke-width: 2; }
.combined__count { fill: currentColor; font-size: 11px; }
.combined__x-label { fill: currentColor; font-size: 11px; font-weight: 600; }
`

function studentListHtml(students: Student[]) {
  if (students.length === 0) return '<div class="empty">None</div>'
  return `<ul>${students
    .map((s) => `<li><span>${esc(`${s.first_name} ${s.last_name}`)}</span><span>${esc(s.email)}</span></li>`)
    .join('')}</ul>`
}

/** One column after applying a count filter. */
interface FilteredColumn {
  column: TrendExportColumn
  students: TrendExportStudent[]
  comparison: Comparison<TrendExportStudent>
  hasPrevious: boolean
}

function filterColumns(columns: TrendExportColumn[], filter: TrendCountFilter): FilteredColumn[] {
  const lists = columns.map((c) => filterByEnrollment(c.students, filter))
  return columns.map((column, i) => ({
    column,
    students: lists[i],
    comparison: compareStudents(i > 0 ? lists[i - 1] : null, lists[i]),
    hasPrevious: i > 0,
  }))
}

function graphSvg(filtered: FilteredColumn[]) {
  const g = layoutTrendGraph(
    filtered.map((f) => f.column.width),
    filtered.map((f) => f.students.length),
  )
  const bottom = g.height - g.padBottom
  const ticks = GRAPH_TICKS.map((tick) => {
    const y = g.padTop + (1 - tick) * (g.height - g.padTop - g.padBottom)
    return `<line class="trend-graph__grid" x1="${g.padX}" y1="${y}" x2="${g.width - g.padX}" y2="${y}"/>
      <text class="trend-graph__tick" x="${g.padX - 10}" y="${y + 4}" text-anchor="end">${Math.round(g.maxCount * tick)}</text>`
  }).join('')
  const line = g.points.length > 1
    ? `<polyline class="trend-graph__line" points="${g.points.map((p) => `${p.x},${p.y}`).join(' ')}"/>`
    : ''
  const points = g.points.map((p, i) => {
    const c = filtered[i].column
    return `<line class="trend-graph__column-line" x1="${p.x}" y1="${g.padTop}" x2="${p.x}" y2="${bottom}"/>
      <circle class="trend-graph__dot" cx="${p.x}" cy="${p.y}" r="6"/>
      <text class="trend-graph__count" x="${p.x}" y="${p.y - 12}" text-anchor="middle">${p.count}</text>
      <text class="trend-graph__x-label" x="${p.x}" y="${g.height - 54}" text-anchor="middle">${esc(c.axisLabel)}</text>
      <text class="trend-graph__x-term" x="${p.x}" y="${g.height - 36}" text-anchor="middle">${esc(c.axisTerm)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
    <line class="trend-graph__axis" x1="${g.padX}" y1="${bottom}" x2="${g.width - g.padX}" y2="${bottom}"/>
    <line class="trend-graph__axis" x1="${g.padX}" y1="${g.padTop}" x2="${g.padX}" y2="${bottom}"/>
    ${ticks}${line}${points}
  </svg>`
}

function columnCardHtml({ column, students: list, comparison, hasPrevious }: FilteredColumn) {
  const meta =
    column.mode === 'collection'
      ? `<div><span>Courses</span><strong>${column.matchedCourseCount}</strong></div>`
      : `<div><span>Term</span><strong>${esc(column.term || '—')}</strong></div>
         <div><span>Time</span><strong>${esc(column.meetingTime ?? 'TBD')}</strong></div>
         <div><span>Instructor</span><strong>${esc(column.instructor ?? 'TBD')}</strong></div>`
  const students = list.length
    ? `<ul>${list
        .map((s) => `<li><span>${esc(`${s.first_name} ${s.last_name}`)}</span><span class="grade">${esc(s.displayGrade)}</span></li>`)
        .join('')}</ul>`
    : '<div class="empty">No students</div>'
  const changes = hasPrevious
    ? `<details><summary class="lost">Lost from previous (${comparison.lost.length})</summary>${studentListHtml(comparison.lost)}</details>
       <details><summary class="added">New since previous (${comparison.added.length})</summary>${studentListHtml(comparison.added)}</details>`
    : ''
  return `<div class="column${column.mode === 'collection' ? ' column--collection' : ''}">
    <div class="column__head"><span class="column__number">${column.number}</span><span class="column__title">${esc(column.label)}</span></div>
    <div class="column__meta"><div><span>Students</span><strong>${list.length}</strong></div>${meta}</div>
    ${students}
    ${changes}
  </div>`
}

function summaryTableHtml(filtered: FilteredColumn[]) {
  const rows = filtered
    .map(
      ({ column: c, students, comparison, hasPrevious }) => `<tr>
        <td>${c.number}</td>
        <td>${esc(c.label)}</td>
        <td>${esc(c.mode === 'collection' ? `Collection (${c.term})` : c.term || '—')}</td>
        <td class="num">${students.length}</td>
        <td class="num">${hasPrevious ? comparison.retained.length : '—'}</td>
        <td class="num lost">${hasPrevious ? comparison.lost.length : '—'}</td>
        <td class="num added">${hasPrevious ? comparison.added.length : '—'}</td>
      </tr>`,
    )
    .join('')
  return `<table>
    <thead><tr><th>#</th><th>Course / Collection</th><th>Term</th><th class="num">Students</th><th class="num">Retained</th><th class="num">Lost</th><th class="num">New</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

function combinedSeries(analyses: TrendExportAnalysis[]): CombinedSeries[] {
  return analyses.map((a, i) => ({
    id: String(i),
    name: a.name,
    color: a.color,
    columns: a.data.columns.map((c) => ({
      axisLabel: c.axisLabel,
      label: c.label,
      term: c.axisTerm,
      count: filterByEnrollment(c.students, a.data.countFilter).length,
    })),
  }))
}

/**
 * Every analysis overlaid on one graph, column N of each sharing slot N.
 * All series are drawn (each in its own group) so the toggles can show/hide them.
 */
function combinedSectionHtml(analyses: TrendExportAnalysis[]) {
  const series = combinedSeries(analyses)
  const g = layoutCombinedGraph(series)
  const bottom = g.height - g.padBottom
  const plotHeight = bottom - g.padTop
  const ticks = GRAPH_TICKS.map((tick) => {
    const y = g.padTop + (1 - tick) * plotHeight
    return `<line class="trend-graph__grid" x1="${g.padX}" y1="${y}" x2="${g.width - g.padX}" y2="${y}"/>
      <text class="trend-graph__tick" x="${g.padX - 10}" y="${y + 4}" text-anchor="end">${Math.round(g.maxCount * tick)}</text>`
  }).join('')
  const slots = g.slotXs.map((x, i) =>
    `<line class="trend-graph__column-line" x1="${x}" y1="${g.padTop}" x2="${x}" y2="${bottom}"/>
     <text class="trend-graph__x-term" x="${x}" y="${bottom + 14}" text-anchor="middle">${i + 1}</text>`,
  ).join('')
  const groups = series.map((s, si) => {
    const points = g.series[si].points
    const line = points.length > 1
      ? `<polyline class="combined__line" points="${points.map((p) => `${p.x},${p.y}`).join(' ')}"/>`
      : ''
    const marks = points.map((p, ci) => {
      const c = s.columns[ci]
      const tip = `${s.name}: ${c.label}${c.term ? ` (${c.term})` : ''} - ${c.count} students`
      return `<circle class="combined__dot" cx="${p.x}" cy="${p.y}" r="5"><title>${esc(tip)}</title></circle>
        <text class="combined__count" x="${p.x + 8}" y="${p.y - 8}">${p.count}</text>
        <text class="combined__x-label" x="${p.x}" y="${g.labelTop + si * g.labelRowHeight}" text-anchor="middle"><title>${esc(tip)}</title>${esc(c.axisLabel)}</text>`
    }).join('')
    const hidden = analyses[si].inCombined ? '' : ' style="display:none"'
    return `<g data-series="${si}" color="${esc(s.color)}"${hidden}>${line}${marks}</g>`
  }).join('')
  const toggles = analyses.map((a, i) =>
    `<label class="combined__toggle" style="--series-color: ${esc(a.color)}">
      <input type="checkbox" data-series-toggle="${i}"${a.inCombined ? ' checked' : ''}>
      <span class="combined__swatch"></span>${esc(a.name)}
    </label>`,
  ).join('')
  return `<section class="analysis" id="combined">
    <div class="analysis__head"><h2>Combined</h2></div>
    <div class="combined__toggles">${toggles}</div>
    <div class="combined__note">Columns are matched by position. Each analysis is counted with its own Count setting.</div>
    <div class="graph"><svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
      <line class="trend-graph__axis" x1="${g.padX}" y1="${bottom}" x2="${g.width - g.padX}" y2="${bottom}"/>
      <line class="trend-graph__axis" x1="${g.padX}" y1="${g.padTop}" x2="${g.padX}" y2="${bottom}"/>
      ${ticks}${slots}${groups}
    </svg></div>
  </section>`
}

/** One pre-rendered view of an analysis per count filter; the dropdown shows one at a time. */
function analysisVariantsHtml(data: TrendExportData) {
  if (data.columns.length === 0) return '<div class="empty">No columns</div>'
  return countFilters
    .map((filter) => {
      const filtered = filterColumns(data.columns, filter)
      return `<div class="variant" data-filter="${filter}"${filter === data.countFilter ? '' : ' hidden'}>
        <div class="graph">${graphSvg(filtered)}</div>
        ${summaryTableHtml(filtered)}
        <div class="columns">${filtered.map(columnCardHtml).join('')}</div>
      </div>`
    })
    .join('')
}

function countFilterSelectHtml(selected: TrendCountFilter) {
  const options = countFilters
    .map((f) => `<option value="${f}"${f === selected ? ' selected' : ''}>${esc(countFilterLabels[f])}</option>`)
    .join('')
  return `<label class="count-filter">Count <select data-count-filter>${options}</select></label>`
}

const SNAPSHOT_SCRIPT = `
document.querySelectorAll('select[data-count-filter]').forEach(function (select) {
  select.addEventListener('change', function () {
    var section = select.closest('section.analysis');
    section.querySelectorAll('.variant').forEach(function (v) {
      v.hidden = v.getAttribute('data-filter') !== select.value;
    });
  });
});
document.querySelectorAll('input[data-series-toggle]').forEach(function (box) {
  box.addEventListener('change', function () {
    var group = document.querySelector('g[data-series="' + box.getAttribute('data-series-toggle') + '"]');
    if (group) group.style.display = box.checked ? '' : 'none';
  });
});
`

export function buildTrendSnapshotHtml(analyses: TrendExportAnalysis[], generatedAt = new Date()) {
  const sections = analyses
    .map(
      (analysis, i) => `<section class="analysis" id="analysis-${i + 1}" style="border-top: 3px solid ${esc(analysis.color)}">
        <div class="analysis__head">
          <h2>${esc(analysis.name)}</h2>
          ${analysis.data.columns.length ? countFilterSelectHtml(analysis.data.countFilter) : ''}
        </div>
        ${analysisVariantsHtml(analysis.data)}
      </section>`,
    )
    .join('')
  const toc = `<a href="#combined">Combined</a>` +
    analyses.map((a, i) => `<a href="#analysis-${i + 1}" style="color: ${esc(a.color)}">${esc(a.name)}</a>`).join('')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trend Analysis Snapshot</title>
<style>${SNAPSHOT_CSS}</style>
</head>
<body>
<header>
  <h1>Trend Analysis Snapshot</h1>
  <div class="generated">Generated ${esc(generatedAt.toLocaleString())} · ${analyses.length} analys${analyses.length === 1 ? 'is' : 'es'}</div>
  <nav class="toc">${toc}</nav>
</header>
<main>${combinedSectionHtml(analyses)}${sections}</main>
<script>${SNAPSHOT_SCRIPT}</script>
</body>
</html>`
}

export function downloadTrendSnapshot(analyses: TrendExportAnalysis[]) {
  const blob = new Blob([buildTrendSnapshotHtml(analyses)], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trend-analysis-${new Date().toISOString().slice(0, 10)}.html`
  link.click()
  URL.revokeObjectURL(url)
}
