export interface CurveHover {
  /** Cursor position in viewport (client) coordinates. */
  x: number
  y: number
}

interface CurvePopupProps {
  at: CurveHover
  title: string
  color?: string
  lines: string[]
}

const POPUP_WIDTH = 260
const OFFSET = 14

/** Popup that follows the cursor while hovering a curve, flipped to stay on screen. */
export function CurvePopup({ at, title, color, lines }: CurvePopupProps) {
  const left = at.x + OFFSET + POPUP_WIDTH > window.innerWidth ? at.x - OFFSET - POPUP_WIDTH : at.x + OFFSET
  const top = Math.min(at.y + OFFSET, window.innerHeight - 24 - lines.length * 20)
  return (
    <div className="trend-tooltip trend-tooltip--follow" style={{ left: Math.max(4, left), top: Math.max(4, top), width: POPUP_WIDTH }}>
      <div className="trend-tooltip__title" style={color ? { color } : undefined}>{title}</div>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  )
}
