import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { evaluateGraph } from './graphEngine'
import { CourseCollectionNode } from './nodes/CourseCollectionNode'
import { CourseNode, type CourseNodeData } from './nodes/CourseNode'
import { IntersectNode } from './nodes/IntersectNode'
import { SubtractNode } from './nodes/SubtractNode'
import { UnionNode } from './nodes/UnionNode'
import { NodePalette } from './NodePalette'
import './NodeGraph.css'

const NODE_TYPE_MAP = {
  courseNode: CourseNode,
  courseCollectionNode: CourseCollectionNode,
  unionNode: UnionNode,
  intersectNode: IntersectNode,
  subtractNode: SubtractNode,
}

let nodeIdCounter = 0
const nextId = () => `node-${++nodeIdCounter}`

function NodeGraphInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [palette, setPalette] = useState<{ screenPos: { x: number; y: number }; flowPos: { x: number; y: number } } | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const setActiveStudentList = useAppStore((s) => s.setActiveStudentList)
  const pendingAddCourseId = useAppStore((s) => s.pendingAddCourseId)
  const setPendingAddCourseId = useAppStore((s) => s.setPendingAddCourseId)

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
        data: {},
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
    }
    setNodes((ns) => [...ns, newNode])
    setPendingAddCourseId(null)
  }, [pendingAddCourseId, setNodes, setPendingAddCourseId, screenToFlowPosition])

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
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
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={NODE_TYPE_MAP}
        selectionOnDrag
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        fitView
      >
        <Background />
        <Controls />
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
