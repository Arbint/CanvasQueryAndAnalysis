import { ReactFlowProvider, useEdgesState, useNodesState, type Edge, type Node } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cleanGraphSnapshot } from '../../lib/sessionPersistence'
import type { GraphSnapshot } from '../../store/appStore'
import { useAppStore } from '../../store/appStore'
import { GraphCanvas } from './GraphCanvas'
import { OUTPUT_NODE_TYPE, ensureSingleOutputNode } from './graphEngine'
import '../CourseSearch/PresetEditorModal.css'
import './NodeGraph.css'

interface GraphEditorModalProps {
  title: string
  initialName: string
  initialGraph: GraphSnapshot
  onSave: (name: string, graph: GraphSnapshot) => void
  onCancel: () => void
}

/** Comparable form of a graph: what would be saved. */
const graphKey = (graph: GraphSnapshot) => JSON.stringify(cleanGraphSnapshot(graph))

/** Stops events reaching React ancestors (the trend card's double-click, the node graph's keys). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

function GraphEditor({ title, initialName, initialGraph, onSave, onCancel }: GraphEditorModalProps) {
  const [start] = useState(() => ensureSingleOutputNode(initialGraph.nodes, initialGraph.edges))
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(start.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(start.edges)
  const [name, setName] = useState(initialName)
  const setActiveStudentList = useAppStore((s) => s.setActiveStudentList)
  const nameRef = useRef<HTMLInputElement>(null)
  const startKey = useRef(graphKey(start))
  const outputConnected = edges.some((e) => nodes.some((n) => n.id === e.target && n.type === OUTPUT_NODE_TYPE))
  const canSave = name.trim().length > 0

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const save = () => {
    if (canSave) onSave(name.trim(), cleanGraphSnapshot({ nodes, edges }))
  }

  const cancel = () => {
    const changed = name !== initialName || graphKey({ nodes, edges }) !== startKey.current
    if (!changed || window.confirm('Discard the changes to this graph?')) onCancel()
  }

  return (
    <div className="preset-modal graph-editor" role="dialog" aria-modal="true" aria-label={title}>
      <div className="graph-editor__head">
        <h2 className="preset-modal__title">{title}</h2>
        <label className="graph-editor__name">
          <span className="preset-modal__label">Name</span>
          <input
            ref={nameRef}
            value={name}
            placeholder="e.g. Upper-level minus repeaters"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
        </label>
      </div>
      <div className="graph-editor__hint">
        Tab adds a node. The card's students are whatever connects to the <strong>Output</strong> node.
        {!outputConnected && <span className="graph-editor__warn"> Nothing is connected to Output yet.</span>}
      </div>
      <div className="graph-editor__canvas">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onShowStudents={setActiveStudentList}
          keyboardActive
        />
      </div>
      <div className="preset-modal__actions">
        <button className="btn btn--secondary" onClick={cancel}>Cancel</button>
        <button className="btn btn--primary" onClick={save} disabled={!canSave}>Save</button>
      </div>
    </div>
  )
}

/** Pop-up node editor for a Trend Analysis card's aggregation graph. */
export function GraphEditorModal(props: GraphEditorModalProps) {
  return createPortal(
    <div
      className="preset-modal__backdrop"
      onMouseDown={stop}
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onKeyDown={stop}
      onWheel={stop}
    >
      {/* Its own provider: independent of the Aggregation Graph tab's canvas. */}
      <ReactFlowProvider>
        <GraphEditor {...props} />
      </ReactFlowProvider>
    </div>,
    document.body,
  )
}
