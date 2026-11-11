import type { Student } from '../api/types'
import type { TrendExportColumn, TrendExportData } from '../components/TrendAnalysis/TrendAnalysis'

export interface TrendExportAnalysis {
  name: string
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
`

function studentListHtml(students: Student[]) {
  if (students.length === 0) return '<div class="empty">None</div>'
  return `<ul>${students
    .map((s) => `<li><span>${esc(`${s.first_name} ${s.last_name}`)}</span><span>${esc(s.email)}</span></li>`)
    .join('')}</ul>`
}

function columnCardHtml(column: TrendExportColumn) {
  const meta =
    column.mode === 'collection'
      ? `<div><span>Courses</span><strong>${column.matchedCourseCount}</strong></div>`
      : `<div><span>Term</span><strong>${esc(column.term || '—')}</strong></div>
         <div><span>Time</span><strong>${esc(column.meetingTime ?? 'TBD')}</strong></div>
         <div><span>Instructor</span><strong>${esc(column.instructor ?? 'TBD')}</strong></div>`
  const students = column.students.length
    ? `<ul>${column.students
        .map((s) => `<li><span>${esc(s.name)}</span><span class="grade">${esc(s.grade)}</span></li>`)
        .join('')}</ul>`
    : '<div class="empty">No students</div>'
  const changes = column.hasPrevious
    ? `<details><summary class="lost">Lost from previous (${column.lost.length})</summary>${studentListHtml(column.lost)}</details>
       <details><summary class="added">New since previous (${column.added.length})</summary>${studentListHtml(column.added)}</details>`
    : ''
  return `<div class="column${column.mode === 'collection' ? ' column--collection' : ''}">
    <div class="column__head"><span class="column__number">${column.number}</span><span class="column__title">${esc(column.label)}</span></div>
    <div class="column__meta"><div><span>Students</span><strong>${column.students.length}</strong></div>${meta}</div>
    ${students}
    ${changes}
  </div>`
}

function summaryTableHtml(columns: TrendExportColumn[]) {
  const rows = columns
    .map(
      (c) => `<tr>
        <td>${c.number}</td>
        <td>${esc(c.label)}</td>
        <td>${esc(c.mode === 'collection' ? `Collection (${c.term})` : c.term || '—')}</td>
        <td class="num">${c.students.length}</td>
        <td class="num">${c.hasPrevious ? c.retained : '—'}</td>
        <td class="num lost">${c.hasPrevious ? c.lost.length : '—'}</td>
        <td class="num added">${c.hasPrevious ? c.added.length : '—'}</td>
      </tr>`,
    )
    .join('')
  return `<table>
    <thead><tr><th>#</th><th>Course / Collection</th><th>Term</th><th class="num">Students</th><th class="num">Retained</th><th class="num">Lost</th><th class="num">New</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function buildTrendSnapshotHtml(analyses: TrendExportAnalysis[], generatedAt = new Date()) {
  const sections = analyses
    .map(
      (analysis, i) => `<section class="analysis" id="analysis-${i + 1}">
        <h2>${esc(analysis.name)}</h2>
        ${analysis.data.svgMarkup ? `<div class="graph">${analysis.data.svgMarkup}</div>` : ''}
        ${analysis.data.columns.length ? summaryTableHtml(analysis.data.columns) : '<div class="empty">No columns</div>'}
        <div class="columns">${analysis.data.columns.map(columnCardHtml).join('')}</div>
      </section>`,
    )
    .join('')
  const toc = analyses.map((a, i) => `<a href="#analysis-${i + 1}">${esc(a.name)}</a>`).join('')
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
<main>${sections}</main>
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
