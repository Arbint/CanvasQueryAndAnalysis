import type { Student } from '../api/types'
import type { TrendExportColumn, TrendExportData, TrendExportStudent } from '../components/TrendAnalysis/TrendAnalysis'
import type { TrendCountFilter } from '../store/appStore'
import {
  actualTrendLines,
  columnCounts,
  compareStudents,
  countFilterLabels,
  countFilters,
  curveSegments,
  filterByEnrollment,
  formatTick,
  layoutCombinedGraph,
  layoutTrendGraph,
  predictionMethodLabels,
  previousRealIndex,
  scaleY,
  seriesColumns,
  type CombinedSeries,
  type Comparison,
  type FrameSize,
  type PredictionResult,
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
.line--predicted { stroke-dasharray: 6 5; }
.dot--predicted { fill: var(--bg-base) !important; stroke: currentColor; stroke-width: 2; }
.trend-graph__dot.dot--predicted { stroke: var(--blue); }
.column--prediction { border-top: 2px dashed var(--yellow); }
.column__basis { color: var(--text); font-size: 12px; }
.column__note { margin-top: 6px; padding: 6px 8px; border-left: 2px solid var(--yellow); background: var(--bg-input); color: var(--text); font-size: 12px; white-space: pre-wrap; }
tr.row--predicted td { font-style: italic; color: var(--muted); }
.curve-hit { fill: none; stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: help; }
.combined__label { fill: currentColor; font-size: 12px; font-weight: 700; paint-order: stroke; stroke: var(--bg-base); stroke-width: 3px; cursor: help; }
g[data-series] { transition: opacity 120ms ease; }
svg:has(g[data-series]:hover) g[data-series]:not(:hover) { opacity: 0.2; }
g[data-series]:hover .combined__line, .trend-curve:hover .trend-graph__line { stroke-width: 3.5; }
.graph-tools { display: flex; gap: 6px; margin-bottom: 6px; }
.graph-tools button { height: 24px; padding: 0 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
.graph-tools button:hover { border-color: var(--blue); color: var(--heading); }
.graph-tools button[aria-pressed="true"] { border-color: var(--blue); color: var(--blue); }
.graph-tools span { align-self: center; color: var(--muted); font-size: 11px; }
section.analysis:not([data-view="framed"]) .graph--framed, section.analysis[data-view="framed"] .graph--default { display: none; }
.graph--framed { overflow: hidden; }
.graph--framed svg { width: 100%; height: auto; }
.graph--framed .empty { padding: 24px; text-align: center; }
.tip { position: fixed; z-index: 100; width: 260px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-1); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45); color: var(--text); font-size: 13px; pointer-events: none; }
.tip__title { margin-bottom: 4px; color: var(--heading); font-weight: 600; }
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
  /** Students counted, or the predicted count for a prediction column. */
  count: number
  /** Set for prediction columns. */
  prediction: PredictionResult | null
  comparison: Comparison<TrendExportStudent>
  hasPrevious: boolean
}

function filterColumns(columns: TrendExportColumn[], filter: TrendCountFilter): FilteredColumn[] {
  const lists = columns.map((c) => filterByEnrollment(c.students, filter))
  const { counts, predictions } = columnCounts(columns, filter)
  const isPrediction = columns.map((c) => Boolean(c.prediction))
  return columns.map((column, i) => {
    // Compare with the nearest real column before it; predictions have no students.
    const previous = previousRealIndex(isPrediction, i)
    return {
      column,
      students: lists[i],
      count: counts[i],
      prediction: predictions[i],
      comparison: compareStudents(previous === null ? null : lists[previous], lists[i]),
      hasPrevious: previous !== null && !isPrediction[i],
    }
  })
}

/**
 * Size a framed graph is rendered at. Framed SVGs are then scaled to the page
 * width (keeping their aspect), so they fit horizontally without scrolling.
 */
const EXPORT_FRAME: FrameSize = { width: 1200, height: 420 }

/** Hover popup text for a curve: name, then the trend summary of its actual columns. */
function curveTip(name: string, counts: number[], predicted: boolean[], axisLabels: string[]): string {
  const lines = actualTrendLines(counts, predicted, (i) => `column ${i + 1} (${axisLabels[i]})`)
  return lines ? [name, ...lines].join('\n') : name
}

/** Curve drawn as segments, dashed where they lead to or from a predicted point. */
function segmentsSvg(points: { x: number; y: number }[], predicted: boolean[], className: string): string {
  return curveSegments(points, predicted)
    .map((s) => `<line class="${className}${s.predicted ? ' line--predicted' : ''}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`)
    .join('')
}

function graphSvg(filtered: FilteredColumn[], frame?: FrameSize) {
  const g = layoutTrendGraph(
    filtered.map((f) => f.column.width),
    filtered.map((f) => f.count),
    frame,
  )
  const predicted = filtered.map((f) => Boolean(f.prediction))
  const bottom = g.height - g.padBottom
  const ticks = g.scale.ticks.map((tick) => {
    const y = scaleY(g.scale, tick, g.padTop, g.height - g.padTop - g.padBottom)
    return `<line class="trend-graph__grid" x1="${g.padX}" y1="${y}" x2="${g.width - g.padX}" y2="${y}"/>
      <text class="trend-graph__tick" x="${g.padX - 10}" y="${y + 4}" text-anchor="end">${formatTick(tick)}</text>`
  }).join('')
  const columnLines = g.points.map((p) =>
    `<line class="trend-graph__column-line" x1="${p.x}" y1="${g.padTop}" x2="${p.x}" y2="${bottom}"/>`,
  ).join('')
  const polyline = g.points.map((p) => `${p.x},${p.y}`).join(' ')
  const tip = curveTip('Trend', g.points.map((p) => p.count), predicted, filtered.map((f) => f.column.axisLabel))
  const line = g.points.length > 1
    ? `<g class="trend-curve">${segmentsSvg(g.points, predicted, 'trend-graph__line')}
        <polyline class="curve-hit" points="${polyline}" data-tip="${esc(tip)}"/></g>`
    : ''
  const points = g.points.map((p, i) => {
    const { column: c, prediction } = filtered[i]
    const title = prediction ? `${c.label}: ${p.count} predicted - ${prediction.basis}` : `${c.label}: ${p.count} students`
    return `<circle class="trend-graph__dot${prediction ? ' dot--predicted' : ''}" cx="${p.x}" cy="${p.y}" r="6"><title>${esc(title)}</title></circle>
      <text class="trend-graph__count" x="${p.x}" y="${p.y - 12}" text-anchor="middle">${p.count}</text>
      <text class="trend-graph__x-label" x="${p.x}" y="${g.height - 54}" text-anchor="middle">${esc(c.axisLabel)}</text>
      <text class="trend-graph__x-term" x="${p.x}" y="${g.height - 36}" text-anchor="middle">${esc(c.axisTerm)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
    <line class="trend-graph__axis" x1="${g.padX}" y1="${bottom}" x2="${g.width - g.padX}" y2="${bottom}"/>
    <line class="trend-graph__axis" x1="${g.padX}" y1="${g.padTop}" x2="${g.padX}" y2="${bottom}"/>
    ${ticks}${columnLines}${line}${points}
  </svg>`
}

/** Frame / Reset buttons; they switch every graph in their section. */
const GRAPH_TOOLS_HTML = `<div class="graph-tools">
  <button type="button" data-view="framed" aria-pressed="false" title="Fit the curves to the graph, horizontally and vertically (F)">Frame</button>
  <button type="button" data-view="default" title="Back to the default view">Reset</button>
  <span>Hover a curve for its trend</span>
</div>`

function predictionCardHtml(column: TrendExportColumn, prediction: PredictionResult) {
  const method = column.prediction ? predictionMethodLabels[column.prediction.method] : ''
  const note = column.prediction?.method === 'manual' && column.prediction.note.trim()
    ? `<div class="column__note">${esc(column.prediction.note.trim())}</div>`
    : ''
  return `<div class="column column--prediction">
    <div class="column__head"><span class="column__number">${column.number}</span><span class="column__title">${esc(column.label)}</span></div>
    <div class="column__meta">
      <div><span>Predicted</span><strong>${prediction.count}</strong></div>
      <div><span>Method</span><strong>${esc(method)}</strong></div>
    </div>
    <div class="column__basis">${esc(prediction.basis)}</div>
    ${note}
  </div>`
}

function columnCardHtml({ column, students: list, comparison, hasPrevious, prediction }: FilteredColumn) {
  if (prediction) return predictionCardHtml(column, prediction)
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
      ({ column: c, count, prediction, comparison, hasPrevious }) => `<tr${prediction ? ' class="row--predicted"' : ''}>
        <td>${c.number}</td>
        <td>${esc(c.label)}</td>
        <td>${esc(prediction ? 'Prediction' : c.mode === 'collection' ? `Collection (${c.term})` : c.term || '—')}</td>
        <td class="num">${prediction ? `${count} (predicted)` : count}</td>
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
    columns: seriesColumns(a.data),
  }))
}

/**
 * Most analyses for which every on/off combination gets its own framed graph
 * (2^n - 1 of them), so framing fits exactly the curves switched on. Past this,
 * one framed graph fits all analyses and the toggles just hide curves.
 */
const MAX_FRAMED_COMBINATIONS_SERIES = 6

/**
 * One combined graph. `indices` are the analyses' positions in the full list
 * (used for `data-series`, which the toggles target); `hidden` hides a group.
 */
function combinedSvg(
  series: CombinedSeries[],
  indices: number[],
  frame: FrameSize | undefined,
  hidden: (index: number) => boolean,
) {
  const g = layoutCombinedGraph(series, frame)
  const bottom = g.height - g.padBottom
  const plotHeight = bottom - g.padTop
  const ticks = g.scale.ticks.map((tick) => {
    const y = scaleY(g.scale, tick, g.padTop, plotHeight)
    return `<line class="trend-graph__grid" x1="${g.padX}" y1="${y}" x2="${g.width - g.padX}" y2="${y}"/>
      <text class="trend-graph__tick" x="${g.padX - 10}" y="${y + 4}" text-anchor="end">${formatTick(tick)}</text>`
  }).join('')
  const slots = g.slotXs.map((x, i) =>
    `<line class="trend-graph__column-line" x1="${x}" y1="${g.padTop}" x2="${x}" y2="${bottom}"/>
     <text class="trend-graph__x-term" x="${x}" y="${bottom + 14}" text-anchor="middle">${i + 1}</text>`,
  ).join('')
  const groups = series.map((s, si) => {
    const { points, label } = g.series[si]
    const predicted = s.columns.map((c) => Boolean(c.predicted))
    const tip = esc(curveTip(s.name, s.columns.map((c) => c.count), predicted, s.columns.map((c) => c.axisLabel)))
    const tipAttrs = `data-tip="${tip}" data-tip-color="${esc(s.color)}"`
    const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
    const line = points.length > 1
      ? `${segmentsSvg(points, predicted, 'combined__line')}
        <polyline class="curve-hit" points="${polyline}" ${tipAttrs}/>`
      : ''
    const curveLabel = label
      ? `<text class="combined__label" x="${label.x}" y="${label.y}" ${tipAttrs}>${esc(label.text)}</text>`
      : ''
    const marks = points.map((p, ci) => {
      const c = s.columns[ci]
      const tip = `${s.name}: ${c.label}${c.term ? ` (${c.term})` : ''} - ${c.count} ${c.predicted ? 'predicted' : 'students'}`
      return `<circle class="combined__dot${c.predicted ? ' dot--predicted' : ''}" cx="${p.x}" cy="${p.y}" r="5"><title>${esc(tip)}</title></circle>
        <text class="combined__count" x="${p.x + 8}" y="${p.y - 8}">${p.count}</text>
        <text class="combined__x-label" x="${p.x}" y="${g.labelTop + si * g.labelRowHeight}" text-anchor="middle"><title>${esc(tip)}</title>${esc(c.axisLabel)}</text>`
    }).join('')
    const style = hidden(indices[si]) ? ' style="display:none"' : ''
    return `<g data-series="${indices[si]}" color="${esc(s.color)}"${style}>${line}${curveLabel}${marks}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
      <line class="trend-graph__axis" x1="${g.padX}" y1="${bottom}" x2="${g.width - g.padX}" y2="${bottom}"/>
      <line class="trend-graph__axis" x1="${g.padX}" y1="${g.padTop}" x2="${g.padX}" y2="${bottom}"/>
      ${ticks}${slots}${groups}
    </svg>`
}

function initialMask(analyses: TrendExportAnalysis[]): number {
  return analyses.reduce((mask, a, i) => (a.inCombined ? mask | (1 << i) : mask), 0)
}

/** Framed combined graphs: one per on/off combination (see MAX_FRAMED_COMBINATIONS_SERIES). */
function framedCombinedHtml(analyses: TrendExportAnalysis[], series: CombinedSeries[]) {
  const all = series.map((_, i) => i)
  if (series.length > MAX_FRAMED_COMBINATIONS_SERIES) {
    return `<div data-mask="all">${combinedSvg(series, all, EXPORT_FRAME, (i) => !analyses[i].inCombined)}</div>`
  }
  const start = initialMask(analyses)
  const variants = [`<div data-mask="0"${start === 0 ? '' : ' hidden'}><div class="empty">Turn on at least one analysis above.</div></div>`]
  for (let mask = 1; mask < 1 << series.length; mask++) {
    const indices = all.filter((i) => mask & (1 << i))
    const svg = combinedSvg(indices.map((i) => series[i]), indices, EXPORT_FRAME, () => false)
    variants.push(`<div data-mask="${mask}"${mask === start ? '' : ' hidden'}>${svg}</div>`)
  }
  return variants.join('')
}

/**
 * Every analysis overlaid on one graph, column N of each sharing slot N.
 * The default graph draws all series (each in its own group) so the toggles
 * can show/hide them; the framed graphs are pre-rendered per combination.
 */
function combinedSectionHtml(analyses: TrendExportAnalysis[]) {
  const series = combinedSeries(analyses)
  const defaultSvg = combinedSvg(series, series.map((_, i) => i), undefined, (i) => !analyses[i].inCombined)
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
    ${GRAPH_TOOLS_HTML}
    <div class="graph graph--default">${defaultSvg}</div>
    <div class="graph graph--framed" data-combined-framed>${framedCombinedHtml(analyses, series)}</div>
  </section>`
}

/** One pre-rendered view of an analysis per count filter; the dropdown shows one at a time. */
function analysisVariantsHtml(data: TrendExportData) {
  if (data.columns.length === 0) return '<div class="empty">No columns</div>'
  return countFilters
    .map((filter) => {
      const filtered = filterColumns(data.columns, filter)
      return `<div class="variant" data-filter="${filter}"${filter === data.countFilter ? '' : ' hidden'}>
        ${GRAPH_TOOLS_HTML}
        <div class="graph graph--default">${graphSvg(filtered)}</div>
        <div class="graph graph--framed">${graphSvg(filtered, EXPORT_FRAME)}</div>
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
    var section = box.closest('section.analysis');
    var index = box.getAttribute('data-series-toggle');
    // Default graph (and the single "all" framed graph): hide the group.
    section.querySelectorAll('.graph--default g[data-series="' + index + '"], [data-mask="all"] g[data-series="' + index + '"]')
      .forEach(function (group) { group.style.display = box.checked ? '' : 'none'; });
    // Framed graphs: show the one pre-rendered for the switched-on combination.
    var mask = 0;
    section.querySelectorAll('input[data-series-toggle]').forEach(function (b) {
      if (b.checked) mask |= 1 << Number(b.getAttribute('data-series-toggle'));
    });
    section.querySelectorAll('[data-combined-framed] > [data-mask]').forEach(function (v) {
      if (v.getAttribute('data-mask') !== 'all') v.hidden = Number(v.getAttribute('data-mask')) !== mask;
    });
  });
});

// Frame / Reset: switch every graph in the section between its default and framed view.
function setView(section, view) {
  section.setAttribute('data-view', view);
  section.querySelectorAll('.graph-tools button[data-view="framed"]').forEach(function (b) {
    b.setAttribute('aria-pressed', view === 'framed' ? 'true' : 'false');
  });
}
document.querySelectorAll('.graph-tools button[data-view]').forEach(function (button) {
  button.addEventListener('click', function () {
    setView(button.closest('section.analysis'), button.getAttribute('data-view'));
  });
});
// F frames the section under the cursor, like a graph editor's Frame All.
var hoveredSection = null;
document.addEventListener('mouseover', function (e) {
  hoveredSection = e.target.closest ? e.target.closest('section.analysis') : null;
});
document.addEventListener('keydown', function (e) {
  if ((e.key === 'f' || e.key === 'F') && hoveredSection && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) {
    setView(hoveredSection, 'framed');
  }
});

// Curve hover popup: name and trend summary, following the cursor.
var tip = document.createElement('div');
tip.className = 'tip';
tip.hidden = true;
document.body.appendChild(tip);
document.addEventListener('mousemove', function (e) {
  var target = e.target.closest ? e.target.closest('[data-tip]') : null;
  if (!target) { tip.hidden = true; return; }
  var lines = target.getAttribute('data-tip').split('\\n');
  tip.innerHTML = '';
  var title = document.createElement('div');
  title.className = 'tip__title';
  title.textContent = lines[0];
  var color = target.getAttribute('data-tip-color');
  if (color) title.style.color = color;
  tip.appendChild(title);
  lines.slice(1).forEach(function (line) {
    var row = document.createElement('div');
    row.textContent = line;
    tip.appendChild(row);
  });
  tip.hidden = false;
  var left = e.clientX + 14;
  if (left + 260 > window.innerWidth) left = e.clientX - 14 - 260;
  tip.style.left = Math.max(4, left) + 'px';
  tip.style.top = Math.max(4, Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 4)) + 'px';
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
