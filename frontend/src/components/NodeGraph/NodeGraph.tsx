import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type OnNodeDrag,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { uniqueId } from '../../lib/ids'
import { buildGraphConfig, downloadGraphConfig, parseGraphConfig } from '../../lib/sessionPersistence'
import { evaluateGraph } from './graphEngine'
import { CourseCollectionNode } from './nodes/CourseCollectionNode'
import { CourseNode, type CourseNodeData } from './nodes/CourseNode'
import { DiffNode } from './nodes/DiffNode'
import { IntersectNode } from './nodes/IntersectNode'
import { SubtractNode } from './nodes/SubtractNode'
import { UnionNode } from './nodes/UnionNode'
import { NodePalette } from './NodePalette'
import { CommentBoxNode } from './nodes/CommentBoxNode'
import './NodeGraph.css'

const NODE_TYPE_MAP = {
  commentBoxNode: CommentBoxNode,
  courseNode: CourseNode,
  courseCollectionNode: CourseCollectionNode,
  unionNode: UnionNode,
  intersectNode: IntersectNode,
  subtractNode: SubtractNode,
  diffNode: DiffNode,
}

const nextId = () => uniqueId('node')

const COMMENT_BOX_WIDTH = 420
const COMMENT_BOX_HEIGHT = 260

type CommentBoxData = Record<string, unknown> & {
  childIds?: string[]
}

type DragGroup = {
  commentId: string
  origin: { x: number; y: number }
  children: { id: string; position: { x: number; y: number } }[]
}

function getNodeSize(node: Node) {
  return {
    width: node.measured?.width ?? node.width ?? (node.type === 'commentBoxNode' ? COMMENT_BOX_WIDTH : 180),
    height: node.measured?.height ?? node.height ?? (node.type === 'commentBoxNode' ? COMMENT_BOX_HEIGHT : 96),
  }
}

function nodeCenterIsInsideComment(node: Node, comment: Node) {
  if (node.id === comment.id || node.type === 'commentBoxNode') return false
  const nodeSize = getNodeSize(node)
  const commentSize = getNodeSize(comment)
  const center = {
    x: node.position.x + nodeSize.width / 2,
    y: node.position.y + nodeSize.height / 2,
  }
  return (
    center.x >= comment.position.x &&
    center.x <= comment.position.x + commentSize.width &&
    center.y >= comment.position.y &&
    center.y <= comment.position.y + commentSize.height
  )
}

function getContainedNodeIds(nodes: Node[], comment: Node) {
  return nodes
    .filter((node) => nodeCenterIsInsideComment(node, comment))
    .map((node) => node.id)
}

function refreshCommentMembership(nodes: Node[]) {
  return nodes.map((node) => {
    if (node.type !== 'commentBoxNode') return node
    return {
      ...node,
      data: {
        ...node.data,
        childIds: getContainedNodeIds(nodes, node),
      } satisfies CommentBoxData,
    }
  })
}

function NodeGraphInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [palette, setPalette] = useState<{ screenPos: { x: number; y: number }; flowPos: { x: number; y: number } } | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const dragGroupRef = useRef<DragGroup | null>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
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

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const filtered = eds.filter(
          (e) => !(e.target === connection.target && e.targetHandle === connection.targetHandle)
        )
        return addEdge(connection, filtered)
      })
    },
    []
  )

  type FlowDiv = HTMLDivElement & {
    _lastFlowPos?: { x: number; y: number }
    _lastScreenPos?: { x: number; y: number }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = flowRef.current?.getBoundingClientRect()
    if (!rect) return
    const el = flowRef.current as FlowDiv
    el._lastFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    el._lastScreenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [screenToFlowPosition])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab' && !palette) {
        e.preventDefault()
        const el = flowRef.current as FlowDiv
        const screenPos = el._lastScreenPos ?? { x: 100, y: 100 }
        const flowPos = el._lastFlowPos ?? screenToFlowPosition({ x: screenPos.x, y: screenPos.y })
        setPalette({ screenPos, flowPos })
      }
      if (e.key === 'Escape') setPalette(null)
    },
    [palette, screenToFlowPosition]
  )

  const handlePaletteSelect = useCallback(
    (type: string) => {
      if (!palette) return
      const newNode: Node = {
        id: nextId(),
        type,
        position: palette.flowPos,
        data: type === 'commentBoxNode'
          ? { label: 'Comment', color: 'amber', childIds: [] } satisfies CommentBoxData
          : {},
        style: type === 'commentBoxNode'
          ? { width: COMMENT_BOX_WIDTH, height: COMMENT_BOX_HEIGHT }
          : undefined,
        zIndex: type === 'commentBoxNode' ? 0 : 1,
      }
      setNodes((ns) => [...ns, newNode])
      setPalette(null)
    },
    [palette, setNodes]
  )

  useEffect(() => {
    if (pendingAddCourseId == null) return
    const rect = flowRef.current?.getBoundingClientRect()
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
    const { nodes: restoredNodes, edges: restoredEdges } = pendingGraphSnapshot
    updateLoadProgress({ stage: 'graph', message: 'Rebuilding graph nodes and connections...' })
    setNodes(restoredNodes)
    setEdges(restoredEdges)
    setPendingGraphSnapshot(null)
    setLoadStatus(null)
    // Fit the restored graph once React Flow has measured the nodes.
    requestAnimationFrame(() => requestAnimationFrame(() => void fitView({ padding: 0.15 })))
    const collections = restoredNodes.filter((n) => n.type === 'courseCollectionNode').length
    const realNodes = restoredNodes.filter((n) => n.type !== 'commentBoxNode').length
    updateLoadProgress((p) => ({
      stage: 'done',
      message: `Restored ${realNodes} node${realNodes === 1 ? '' : 's'} and ${restoredEdges.length} connection${restoredEdges.length === 1 ? '' : 's'}`,
      // Listed (which keeps the pop-up open) because it needs the user to act.
      warnings: collections
        ? [...p.warnings, `${collections} Course Collection node${collections === 1 ? '' : 's'}: press Collect to gather the students (students are not saved in the file).`]
        : p.warnings,
    }))
  }, [pendingGraphSnapshot, setEdges, setLoadStatus, setNodes, setPendingGraphSnapshot, updateLoadProgress, fitView])

  const handleNodeDragStart: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (node.type !== 'commentBoxNode') {
        dragGroupRef.current = null
        return
      }
      const childIds = getContainedNodeIds(nodes, node)
      dragGroupRef.current = {
        commentId: node.id,
        origin: node.position,
        children: nodes
          .filter((candidate) => childIds.includes(candidate.id))
          .map((candidate) => ({ id: candidate.id, position: candidate.position })),
      }
    },
    [nodes]
  )

  const handleNodeDrag: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      const dragGroup = dragGroupRef.current
      if (!dragGroup || dragGroup.commentId !== node.id) return
      const delta = {
        x: node.position.x - dragGroup.origin.x,
        y: node.position.y - dragGroup.origin.y,
      }
      setNodes((currentNodes) => currentNodes.map((currentNode) => {
        const child = dragGroup.children.find((candidate) => candidate.id === currentNode.id)
        if (!child) return currentNode
        return {
          ...currentNode,
          position: {
            x: child.position.x + delta.x,
            y: child.position.y + delta.y,
          },
        }
      }))
    },
    [setNodes]
  )

  const handleNodeDragStop: OnNodeDrag<Node> = useCallback(
    () => {
      dragGroupRef.current = null
      setNodes((currentNodes) => refreshCommentMembership(currentNodes))
    },
    [setNodes]
  )

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'commentBoxNode') return
      const courseStudents: Record<string, unknown> = {}
      for (const n of nodes) {
        if (n.type === 'courseNode' || n.type === 'courseCollectionNode') {
          courseStudents[n.id] = (n.data as CourseNodeData).students ?? []
        }
      }
      try {
        const results = evaluateGraph(nodes, edges, courseStudents as Record<string, never>)
        setActiveStudentList(results[node.id] ?? [])
      } catch {
        setActiveStudentList([])
      }
    },
    [nodes, edges, setActiveStudentList]
  )

  return (
    <div
      ref={flowRef}
      className="node-graph"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={NODE_TYPE_MAP}
        selectionOnDrag
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        fitView
      >
        <Background />
        <Controls />
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
      </ReactFlow>
      {palette && (
        <NodePalette
          position={palette.screenPos}
          onSelect={handlePaletteSelect}
          onClose={() => setPalette(null)}
        />
      )}
    </div>
  )
}

export function NodeGraph() {
  return <NodeGraphInner />
}
