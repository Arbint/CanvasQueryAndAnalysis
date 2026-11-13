import { useMemo, useState } from 'react'
import { GRAPH_TICKS, layoutCombinedGraph, type CombinedSeries } from '../../lib/trendData'

interface CombinedTrendViewProps {
  /** Every analysis, in tab order; `included` marks the ones toggled on. */
  series: (CombinedSeries & { included: boolean })[]
  onToggle: (id: string) => void
}

/** Overlays all analyses on one graph, column N of each sharing slot N. */
export function CombinedTrendView({ series, onToggle }: CombinedTrendViewProps) {
  const [zoom, setZoom] = useState(1)
  const [hovered, setHovered] = useState<{ series: number; column: number } | null>(null)
  const visible = useMemo(() => series.filter((s) => s.included), [series])
  const graph = useMemo(() => layoutCombinedGraph(visible), [visible])
  const bottom = graph.height - graph.padBottom
  const plotHeight = bottom - graph.padTop
  const hoveredSeries = hovered ? visible[hovered.series] : null
  const hoveredColumn = hovered && hoveredSeries ? hoveredSeries.columns[hovered.column] : null

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
          <button className="trend-icon-button" title="Zoom out" onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}>-</button>
          <button className="trend-icon-button" title="Auto fit" onClick={() => setZoom(1)}>Fit</button>
          <button className="trend-icon-button" title="Zoom in" onClick={() => setZoom((v) => Math.min(2, v + 0.2))}>+</button>
        </div>
      </div>
      <div className="trend-combined__note">
        Columns are matched by position. Each analysis is counted with its own Count setting.
      </div>

      <div className="trend-combined__viewport">
        {visible.length === 0 ? (
          <div className="trend-combined__empty">Turn on at least one analysis above.</div>
        ) : (
          <svg
            className="trend-combined__svg"
            width={graph.width * zoom}
            height={graph.height * zoom}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
          >
            <line className="trend-graph__axis" x1={graph.padX} y1={bottom} x2={graph.width - graph.padX} y2={bottom} />
            <line className="trend-graph__axis" x1={graph.padX} y1={graph.padTop} x2={graph.padX} y2={bottom} />
            {GRAPH_TICKS.map((tick) => {
              const y = graph.padTop + (1 - tick) * plotHeight
              return (
                <g key={tick}>
                  <line className="trend-graph__grid" x1={graph.padX} y1={y} x2={graph.width - graph.padX} y2={y} />
                  <text className="trend-graph__tick" x={graph.padX - 10} y={y + 4} textAnchor="end">
                    {Math.round(graph.maxCount * tick)}
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
            {visible.map((s, si) => {
              const points = graph.series[si].points
              return (
                <g key={s.id} style={{ color: s.color }}>
                  {points.length > 1 && (
                    <polyline
                      className="trend-combined__line"
                      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    />
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
    </div>
  )
}
