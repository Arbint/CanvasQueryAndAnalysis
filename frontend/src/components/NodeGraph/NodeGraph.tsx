import { Panel, useEdgesState, useNodesState, useReactFlow, type Edge, type Node } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { uniqueId } from '../../lib/ids'
import { buildGraphConfig, downloadGraphConfig, parseGraphConfig } from '../../lib/sessionPersistence'
import { GraphCanvas } from './GraphCanvas'
import { ensureSingleOutputNode } from './graphEngine'
import './NodeGraph.css'

const nextId = () => uniqueId('node')

/** The Aggregation Graph tab: the shared canvas plus store syncing and Save / Load. */
function NodeGraphInner() {
  const [initial] = useState(() => ensureSingleOutputNode([], []))
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const activeWorkTab = useAppStore((s) => s.activeWorkTab)
  const setActiveStudentList = useAppStore((s) => s.setActiveStudentList)
  const pendingAddCourseId = useAppStore((s) => s.pendingAddCourseId)
  const setPendingAddCourseId = useAppStore((s) => s.setPendingAddCourseId)
  const setGraphSnapshot = useAppStore((s) => s.setGraphSnapshot)
  const pendingGraphSnapshot = useAppStore((s) => s.pendingGraphSnapshot)
  const setPendingGraphSnapshot = useAppStore((s) => s.setPendingGraphSnapshot)
  const setLoadStatus = useAppStore((s) => s.setLoadStatus)
  const setPendingSessionLoad = useAppStore((s) => s.setPendingSessionLoad)
  const startLoadProgress = useAppStore((s) => s.startLoadProgress)
  const updateLoadProgress = useAppStore((s) => s.updateLoadProgress)
  const configInputRef = useRef<HTMLInputElement>(null)

  // --- Save / load the Aggregation Graph configuration ---

  const handleSaveConfig = () => {
    const { selectedAccountId, courseSearchSettings, graphSnapshot } = useAppStore.getState()
    downloadGraphConfig(buildGraphConfig(
      { selectedAccountId, selectedTermIds: courseSearchSettings.selectedTermIds, keywords: courseSearchSettings.keywords },
      graphSnapshot,
    ))
  }

  const handleLoadConfig = async (file: File | undefined) => {
    if (!file) return
    if (configInputRef.current) configInputRef.current.value = ''
    startLoadProgress(`Loading ${file.name}`, 'graph')
    try {
      const session = parseGraphConfig(await file.text())
      const nodeCount = session.graph?.nodes.length ?? 0
      updateLoadProgress({ message: `Read ${nodeCount} node${nodeCount === 1 ? '' : 's'}` })
      setLoadStatus('Loading search...')
      // The course search runs first (CourseSearch), then the graph is restored below.
      setPendingSessionLoad(session)
    } catch (error) {
      updateLoadProgress({ error: error instanceof Error ? error.message : 'Unable to read the file' })
    }
  }

  // A course clicked in the course list becomes a Course node in the middle of the view.
  useEffect(() => {
    if (pendingAddCourseId == null) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    const centerScreen = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const position = screenToFlowPosition(centerScreen)
    const newNode: Node = {
      id: nextId(),
      type: 'courseNode',
      position,
      data: { selectedCourseId: pendingAddCourseId },
      zIndex: 1,
    }
    setNodes((ns) => [...ns, newNode])
    setPendingAddCourseId(null)
  }, [pendingAddCourseId, setNodes, setPendingAddCourseId, screenToFlowPosition])

  useEffect(() => {
    setGraphSnapshot({ nodes, edges })
  }, [nodes, edges, setGraphSnapshot])

  useEffect(() => {
    if (!pendingGraphSnapshot) return
    const restored = ensureSingleOutputNode(pendingGraphSnapshot.nodes, pendingGraphSnapshot.edges)
    updateLoadProgress({ stage: 'graph', message: 'Rebuilding graph nodes and connections...' })
    setNodes(restored.nodes)
    setEdges(restored.edges)
    setPendingGraphSnapshot(null)
    setLoadStatus(null)
    // Fit the restored graph once React Flow has measured the nodes.
    requestAnimationFrame(() => requestAnimationFrame(() => void fitView({ padding: 0.15 })))
    const collections = restored.nodes.filter((n) => n.type === 'courseCollectionNode').length
    const realNodes = restored.nodes.filter((n) => n.type !== 'commentBoxNode').length
    updateLoadProgress((p) => ({
      stage: 'done',
      message: `Restored ${realNodes} node${realNodes === 1 ? '' : 's'} and ${restored.edges.length} connection${restored.edges.length === 1 ? '' : 's'}`,
      // Listed (which keeps the pop-up open) because it needs the user to act.
      warnings: collections
        ? [...p.warnings, `${collections} Course Collection node${collections === 1 ? '' : 's'}: press Collect to gather the students (students are not saved in the file).`]
        : p.warnings,
    }))
  }, [pendingGraphSnapshot, setEdges, setLoadStatus, setNodes, setPendingGraphSnapshot, updateLoadProgress, fitView])

  return (
    <div className="node-graph-host" ref={wrapperRef}>
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onShowStudents={setActiveStudentList}
        keyboardActive={activeWorkTab === 'aggregation'}
      >
        <Panel position="top-right" className="node-graph__config">
          <button
            className="node-graph__config-btn"
            title="Save the course search and this graph to a JSON file, to rebuild it later"
            onClick={handleSaveConfig}
          >
            Save
          </button>
          <button
            className="node-graph__config-btn"
            title="Load a saved graph: searches the courses, then rebuilds the nodes and connections"
            onClick={() => configInputRef.current?.click()}
          >
            Load
          </button>
          <input
            ref={configInputRef}
            className="node-graph__config-input"
            type="file"
            accept="application/json,.json"
            aria-label="Aggregation Graph configuration file"
            onChange={(e) => void handleLoadConfig(e.target.files?.[0])}
          />
        </Panel>
      </GraphCanvas>
    </div>
  )
}

export function NodeGraph() {
  return <NodeGraphInner />
}
