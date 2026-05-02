import React, { useCallback, useRef, useState } from 'react'
import './ResizableColumns.css'

interface ResizableColumnsProps {
  left: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
}

const MIN_WIDTH = 180
const DEFAULT_WIDTHS = [280, 0, 280] // center is flex-grow

export function ResizableColumns({ left, center, right }: ResizableColumnsProps) {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_WIDTHS[0])
  const [rightWidth, setRightWidth] = useState(DEFAULT_WIDTHS[2])
  const containerRef = useRef<HTMLDivElement>(null)

  const startDrag = useCallback(
    (side: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = side === 'left' ? leftWidth : rightWidth

      const onMove = (moveEvent: MouseEvent) => {
        const delta = side === 'left'
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX
        const next = Math.max(MIN_WIDTH, startWidth + delta)
        if (side === 'left') setLeftWidth(next)
        else setRightWidth(next)
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [leftWidth, rightWidth]
  )

  return (
    <div className="resizable-columns" ref={containerRef}>
      <div className="resizable-column" style={{ width: leftWidth, minWidth: MIN_WIDTH }}>
        {left}
      </div>
      <div className="resizable-handle" onMouseDown={startDrag('left')} />
      <div className="resizable-column resizable-column--grow">
        {center}
      </div>
      <div className="resizable-handle" onMouseDown={startDrag('right')} />
      <div className="resizable-column" style={{ width: rightWidth, minWidth: MIN_WIDTH }}>
        {right}
      </div>
    </div>
  )
}
