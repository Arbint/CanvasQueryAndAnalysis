import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  formatTick,
  layoutCombinedGraph,
  scaleY,
  summarizeTrend,
  trendSummaryLines,
  type CombinedSeries,
} from '../../lib/trendData'
import { useElementSize } from '../../lib/useElementSize'
import { CurvePopup, type CurveHover } from './CurvePopup'

interface CombinedTrendViewProps {
  /** Every analysis, in tab order; `included` marks the ones toggled on. */
  series: (CombinedSeries & { included: boolean })[]
  onToggle: (id: string) => void
}

/** Overlays all analyses on one graph, column N of each sharing slot N. */
export function CombinedTrendView({ series, onToggle }: CombinedTrendViewProps) {
  const [zoom, setZoom] = useState(1)
  const [framed, setFramed] = useState(false)
  const [hovered, setHovered] = useState<{ series: number; column: number } | null>(null)
  const [hoveredCurve, setHoveredCurve] = useState<(CurveHover & { series: number }) | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewportSize = useElementSize(viewportRef)
  const visible = useMemo(() => series.filter((s) => s.included), [series])
  const frame = framed && viewportSize.width > 0 && viewportSize.height > 0 ? viewportSize : undefined
  const graph = useMemo(() => layoutCombinedGraph(visible, frame), [visible, frame])
  const scale = frame ? 1 : zoom
  const bottom = graph.height - graph.padBottom
  const plotHeight = bottom - graph.padTop
  const hoveredSeries = hovered ? visible[hovered.series] : null
  const hoveredColumn = hovered && hoveredSeries ? hoveredSeries.columns[hovered.column] : null
  const highlighted = hoveredCurve?.series ?? hovered?.series ?? null
  const curveSeries = hoveredCurve ? visible[hoveredCurve.series] : null
  const curveSummary = curveSeries ? summarizeTrend(curveSeries.columns.map((c) => c.count)) : null
  // Draw the highlighted curve last so it sits on top of the others.
  const drawOrder = visible.map((_, i) => i)
  if (highlighted !== null) drawOrder.push(...drawOrder.splice(highlighted, 1))

  const zoomBy = (delta: number) => {
    setFramed(false)
    setZoom((v) => Math.min(2, Math.max(0.6, v + delta)))
  }
  const resetView = () => {
    setFramed(false)
    setZoom(1)
  }

  return (
    <div className="trend-combined">
      <div className="trend-combined__toolbar">
        <div className="trend-combined__toggles" aria-label="Analyses shown in the combined view">
          {series.map((s) => (
            <button
              key={s.id}
              className={`trend-combined__toggle${s.included ? ' trend-combined__toggle--on' : ''}`}
              style={{ ['--series-color' as string]: s.color }}
              aria-pressed={s.included}
              title={s.included ? 'Hide from combined view' : 'Show in combined view'}
              onClick={() => onToggle(s.id)}
            >
              <span className="trend-combined__swatch" />
              {s.name}
            </button>
          ))}
        </div>
        <div className="trend-combined__zoom">
          <button className="trend-icon-button" title="Zoom out" onClick={() => zoomBy(-0.2)}>-</button>
          <button className="trend-icon-button" title="Zoom in" onClick={() => zoomBy(0.2)}>+</button>
          <button
            className={`trend-icon-button trend-frame-button${framed ? ' trend-frame-button--on' : ''}`}
            title="Frame: fit all curves to the graph, horizontally and vertically (F)"
            aria-pressed={framed}
            onClick={() => setFramed(true)}
          >
            Frame
          </button>
          <button className="trend-icon-button" title="Reset to the default view" onClick={resetView}>Reset</button>
        </div>
      </div>
      <div className="trend-combined__note">
        Columns are matched by position. Each analysis is counted with its own Count setting.
      </div>

      <div
        ref={viewportRef}
        className={`trend-combined__viewport${frame ? ' trend-combined__viewport--framed' : ''}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'f' || e.key === 'F') setFramed(true)
        }}
      >
        {visible.length === 0 ? (
          <div className="trend-combined__empty">Turn on at least one analysis above.</div>
        ) : (
          <svg
            className="trend-combined__svg"
            width={graph.width * scale}
            height={graph.height * scale}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
          >
            <line className="trend-graph__axis" x1={graph.padX} y1={bottom} x2={graph.width - graph.padX} y2={bottom} />
            <line className="trend-graph__axis" x1={graph.padX} y1={graph.padTop} x2={graph.padX} y2={bottom} />
            {graph.scale.ticks.map((tick) => {
              const y = scaleY(graph.scale, tick, graph.padTop, plotHeight)
              return (
                <g key={tick}>
                  <line className="trend-graph__grid" x1={graph.padX} y1={y} x2={graph.width - graph.padX} y2={y} />
                  <text className="trend-graph__tick" x={graph.padX - 10} y={y + 4} textAnchor="end">
                    {formatTick(tick)}
                  </text>
                </g>
              )
            })}
            {graph.slotXs.map((x, i) => (
              <g key={i}>
                <line className="trend-graph__column-line" x1={x} y1={graph.padTop} x2={x} y2={bottom} />
                <text className="trend-graph__x-term" x={x} y={bottom + 14} textAnchor="middle">{i + 1}</text>
              </g>
            ))}
            {drawOrder.map((si) => {
              const s = visible[si]
              const { points, label } = graph.series[si]
              const state = highlighted === null ? '' : highlighted === si ? ' trend-curve--highlight' : ' trend-curve--dim'
              const hoverCurve = (e: ReactMouseEvent) => setHoveredCurve({ series: si, x: e.clientX, y: e.clientY })
              const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
              return (
                <g key={s.id} className={`trend-curve${state}`} style={{ color: s.color }}>
                  {points.length > 1 && <polyline className="trend-combined__line" points={polyline} />}
                  {points.length > 1 && (
                    <polyline
                      className="trend-curve__hit"
                      points={polyline}
                      onMouseMove={hoverCurve}
                      onMouseLeave={() => setHoveredCurve(null)}
                    />
                  )}
                  {label && (
                    <text
                      className="trend-curve__label"
                      x={label.x}
                      y={label.y}
                      onMouseMove={hoverCurve}
                      onMouseLeave={() => setHoveredCurve(null)}
                    >
                      {label.text}
                    </text>
                  )}
                  {points.map((p, ci) => (
                    <g key={ci}>
                      <circle
                        className="trend-combined__dot"
                        cx={p.x}
                        cy={p.y}
                        r={5}
                        onMouseEnter={() => setHovered({ series: si, column: ci })}
                        onMouseLeave={() => setHovered(null)}
                      />
                      <text className="trend-combined__count" x={p.x + 8} y={p.y - 8}>{p.count}</text>
                      <text
                        className="trend-combined__x-label"
                        x={p.x}
                        y={graph.labelTop + si * graph.labelRowHeight}
                        textAnchor="middle"
                      >
                        <title>{`${s.name}: ${s.columns[ci].label}${s.columns[ci].term ? ` (${s.columns[ci].term})` : ''}`}</title>
                        {s.columns[ci].axisLabel}
                      </text>
                    </g>
                  ))}
                </g>
              )
            })}
          </svg>
        )}
        {hoveredSeries && hoveredColumn && (
          <div className="trend-tooltip">
            <div className="trend-tooltip__title" style={{ color: hoveredSeries.color }}>{hoveredSeries.name}</div>
            <div>Column {hovered!.column + 1}: {hoveredColumn.label}</div>
            {hoveredColumn.term && <div>{hoveredColumn.term}</div>}
            <div>Students: {hoveredColumn.count}</div>
          </div>
        )}
      </div>
      {hoveredCurve && curveSeries && curveSummary && !hovered && (
        <CurvePopup
          at={hoveredCurve}
          title={curveSeries.name}
          color={curveSeries.color}
          lines={trendSummaryLines(curveSummary, (i) => `column ${i + 1} (${curveSeries.columns[i].axisLabel})`)}
        />
      )}
    </div>
  )
}
