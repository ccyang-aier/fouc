import { useEffect, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  Bell,
  CalendarBlank,
  CaretDown,
  ChartLine,
  Check,
  CornersOut,
  Database,
  FileText,
  Flag,
  FlowArrow,
  Hand,
  LinkSimple,
  ListChecks,
  Lightbulb,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  NotePencil,
  Plus,
  ShareNetwork,
  Stack,
  Trash,
  User,
  UsersThree,
  Wrench,
} from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsSeverity, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type Offset = { x: number; y: number }
type BuiltInNodeId = 'ticket' | 'impact' | 'evidence' | 'flow' | 'people' | 'relations' | 'actions'
type CustomIconId = 'note' | 'document' | 'link' | 'task' | 'person' | 'stack' | 'alert' | 'database' | 'flag' | 'idea' | 'tool' | 'chart'
type NodeBox = Offset & { width: number; height: number }
type GraphNode = { id: string; kind: BuiltInNodeId | 'custom'; box: NodeBox; title?: string; content?: string; icon?: CustomIconId; edited?: boolean; viewSize?: Pick<NodeBox, 'width' | 'height'> }
type GraphEdge = { id: string; source: string; target: string }

const STAGE_WIDTH = 1020
const STAGE_HEIGHT = 680
const MIN_ZOOM = 0.44
const MAX_ZOOM = 1.2
const CUSTOM_NODE_VIEW_SIZE = { width: 220, height: 128 }
const CUSTOM_NODE_EDIT_SIZE = { width: 240, height: 174 }
const INITIAL_NODES: GraphNode[] = [
  { id: 'ticket', kind: 'ticket', box: { x: 382, y: 238, width: 256, height: 152 } },
  { id: 'impact', kind: 'impact', box: { x: 48, y: 64, width: 220, height: 140 } },
  { id: 'evidence', kind: 'evidence', box: { x: 62, y: 456, width: 224, height: 140 } },
  { id: 'flow', kind: 'flow', box: { x: 746, y: 54, width: 212, height: 146 } },
  { id: 'people', kind: 'people', box: { x: 748, y: 278, width: 218, height: 136 } },
  { id: 'relations', kind: 'relations', box: { x: 322, y: 512, width: 222, height: 128 } },
  { id: 'actions', kind: 'actions', box: { x: 704, y: 498, width: 216, height: 132 } },
]
const INITIAL_EDGES: GraphEdge[] = ['impact', 'evidence', 'flow', 'people', 'relations', 'actions'].map((target) => ({ id: `ticket-${target}`, source: 'ticket', target }))
const CUSTOM_ICON_OPTIONS = [
  { id: 'note', label: '便签', icon: NotePencil },
  { id: 'document', label: '文档', icon: FileText },
  { id: 'link', label: '链接', icon: LinkSimple },
  { id: 'task', label: '任务', icon: ListChecks },
  { id: 'person', label: '人员', icon: User },
  { id: 'stack', label: '模块', icon: Stack },
  { id: 'alert', label: '提醒', icon: Bell },
  { id: 'database', label: '数据', icon: Database },
  { id: 'flag', label: '标记', icon: Flag },
  { id: 'idea', label: '想法', icon: Lightbulb },
  { id: 'tool', label: '工具', icon: Wrench },
  { id: 'chart', label: '指标', icon: ChartLine },
] satisfies { id: CustomIconId; label: string; icon: typeof Stack }[]

export function DtsRelationshipGraph({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const [zoom, setZoom] = useState(0.76)
  const [panMode, setPanMode] = useState(false)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [nodes, setNodes] = useState<GraphNode[]>(() => cloneInitialNodes())
  const [edges, setEdges] = useState<GraphEdge[]>(() => [...INITIAL_EDGES])
  const [selectedNode, setSelectedNode] = useState<string | null>('ticket')
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [activity, setActivity] = useState('拖拽节点自由排列')
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasDragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null)
  const nextNodeIdRef = useRef(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setZoom(calculateFitZoom(entry.contentRect.width, entry.contentRect.height))
      setOffset({ x: 0, y: 0 })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  function fitCanvas() {
    const canvas = canvasRef.current
    if (canvas) setZoom(calculateFitZoom(canvas.clientWidth, canvas.clientHeight))
    setOffset({ x: 0, y: 0 })
    setActivity('已适应画布')
  }

  function resetLayout() {
    setNodes(cloneInitialNodes())
    setEdges([...INITIAL_EDGES])
    setSelectedNode('ticket')
    setEditingNode(null)
    nextNodeIdRef.current = 1
    fitCanvas()
    setActivity('布局已重置')
  }

  function moveNode(nodeId: string, position: Offset) {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, box: { ...node.box, ...position } } : node))
  }

  function addNode(parentId: string) {
    const parent = nodes.find((node) => node.id === parentId)
    if (!parent) return
    const count = nextNodeIdRef.current++
    const id = `custom-${count}`
    const box = findOpenPosition(nodes, parent.box, CUSTOM_NODE_EDIT_SIZE.width, CUSTOM_NODE_EDIT_SIZE.height)
    setNodes((current) => [...current, { id, kind: 'custom', title: `新建节点 ${count}`, content: '拖动节点调整位置，继续新建可扩展这条关系。', icon: 'note', box, viewSize: CUSTOM_NODE_VIEW_SIZE }])
    setEdges((current) => [...current, { id: `${parentId}-${id}`, source: parentId, target: id }])
    setSelectedNode(id)
    setEditingNode(id)
    setActivity(`已从${graphNodeLabel(parent)}新建节点`)
  }

  function deleteNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    setNodes((current) => current.filter((item) => item.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNode((current) => current === nodeId ? null : current)
    setEditingNode((current) => current === nodeId ? null : current)
    setActivity(`已删除${graphNodeLabel(node)}`)
  }

  function updateNode(nodeId: string, patch: Pick<GraphNode, 'title' | 'content' | 'icon'>) {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, ...patch } : node))
    setActivity('节点内容已更新')
  }

  function startEditingNode(nodeId: string) {
    setNodes((current) => current.map((node) => {
      if (node.id !== nodeId) return node
      const defaults = editableNodeDefaults(node, ticket, detail)
      return {
        ...node,
        title: node.title ?? defaults.title,
        content: node.content ?? defaults.content,
        icon: node.icon ?? defaults.icon,
        viewSize: node.viewSize ?? { width: node.box.width, height: node.box.height },
        box: { ...node.box, ...CUSTOM_NODE_EDIT_SIZE },
      }
    }))
    setSelectedNode(nodeId)
    setEditingNode(nodeId)
    setActivity('正在编辑节点')
  }

  function finishEditingNode(nodeId: string) {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, edited: true, title: node.title?.trim() || '未命名节点', content: node.content?.trim() || '暂无补充内容。', box: { ...node.box, ...(node.viewSize ?? CUSTOM_NODE_VIEW_SIZE) } } : node))
    setEditingNode(null)
    setActivity('节点修改已保存')
  }

  function startCanvasDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!panMode) return
    event.preventDefault()
    canvasDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveCanvas(event: React.PointerEvent<HTMLDivElement>) {
    const drag = canvasDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({ x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY })
  }

  return (
    <div ref={canvasRef} aria-label="DTS 工单关系图谱" className="relative min-h-0 flex-1 overflow-hidden bg-[var(--panel)]" style={{ backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--muted) 28%, transparent) 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }}>
      <GraphSummary nodeCount={nodes.length} activity={activity} />
      <CanvasControls zoom={zoom} panMode={panMode} onZoomOut={() => { setZoom((value) => Math.max(MIN_ZOOM, value - 0.08)); setActivity('画布已缩小') }} onZoomIn={() => { setZoom((value) => Math.min(MAX_ZOOM, value + 0.08)); setActivity('画布已放大') }} onFit={fitCanvas} onReset={resetLayout} onTogglePan={() => { setPanMode((value) => !value); setActivity(panMode ? '拖动画布已关闭' : '拖动画布已开启') }} />
      <div className={cn('absolute inset-0', panMode && 'cursor-grab select-none active:cursor-grabbing')} onPointerDown={startCanvasDrag} onPointerMove={moveCanvas} onPointerUp={() => { canvasDragRef.current = null }} onPointerCancel={() => { canvasDragRef.current = null }}>
        <div className="absolute left-1/2 top-1/2 origin-center transition-transform duration-150" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
          <GraphConnectors nodes={nodes} edges={edges} />
          {nodes.map((node) => <DraggableNode key={node.id} node={node} zoom={zoom} selected={selectedNode === node.id} onMove={moveNode} onSelect={setSelectedNode} onAdd={addNode} onEdit={() => startEditingNode(node.id)} onDelete={deleteNode}>{renderNodeContent(node, ticket, detail, editingNode === node.id, (patch) => updateNode(node.id, patch), () => finishEditingNode(node.id))}</DraggableNode>)}
        </div>
      </div>
    </div>
  )
}

function DraggableNode({ node, zoom, selected, onMove, onSelect, onAdd, onEdit, onDelete, children }: { node: GraphNode; zoom: number; selected: boolean; onMove: (nodeId: string, position: Offset) => void; onSelect: (nodeId: string) => void; onAdd: (nodeId: string) => void; onEdit: () => void; onDelete: (nodeId: string) => void; children: React.ReactNode }) {
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null)
  function startDrag(event: React.PointerEvent<HTMLDivElement>) { if ((event.target as HTMLElement).closest('a, button, input, textarea, select')) return; event.stopPropagation(); onSelect(node.id); dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: node.box.x, y: node.box.y } }; event.currentTarget.setPointerCapture(event.pointerId) }
  function moveDrag(event: React.PointerEvent<HTMLDivElement>) { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; event.stopPropagation(); onMove(node.id, { x: drag.origin.x + (event.clientX - drag.startX) / zoom, y: drag.origin.y + (event.clientY - drag.startY) / zoom }) }
  function moveWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) { if ((event.target as HTMLElement).matches('input, textarea, select')) return; const delta = event.shiftKey ? 24 : 8; const movement = event.key === 'ArrowLeft' ? { x: -delta, y: 0 } : event.key === 'ArrowRight' ? { x: delta, y: 0 } : event.key === 'ArrowUp' ? { x: 0, y: -delta } : event.key === 'ArrowDown' ? { x: 0, y: delta } : null; if (!movement) return; event.preventDefault(); onSelect(node.id); onMove(node.id, { x: node.box.x + movement.x, y: node.box.y + movement.y }) }
  const label = graphNodeLabel(node)
  return <div role="button" tabIndex={0} aria-label={`拖动${label}节点`} aria-pressed={selected} className={cn('group absolute z-10 touch-none cursor-grab rounded-[11px] outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', selected && 'z-20 [&>*:last-child]:bg-[color-mix(in_srgb,var(--accent-soft)_24%,var(--panel))]')} style={{ left: node.box.x, top: node.box.y, width: node.box.width, height: node.box.height, '--node-frame-color': selected ? 'var(--accent)' : 'color-mix(in srgb, var(--ink) 26%, transparent)' } as React.CSSProperties} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={(event) => { event.stopPropagation(); dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} onKeyDown={moveWithKeyboard}>
    <NodeActions label={label} selected={selected} onAdd={() => onAdd(node.id)} onEdit={onEdit} onDelete={() => onDelete(node.id)} />
    {children}
  </div>
}

function NodeActions({ label, selected, onAdd, onEdit, onDelete }: { label: string; selected: boolean; onAdd: () => void; onEdit: () => void; onDelete: () => void }) {
  const baseClassName = 'pointer-events-auto flex size-7 items-center justify-center rounded-full border outline-none transition-[background-color,color,border-color,transform] active:scale-90 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'
  return <div className={cn('pointer-events-none absolute -top-2 right-0 z-30 flex -translate-y-full gap-1.5 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-focus-within:opacity-100', selected && 'opacity-100')}><button type="button" aria-label={`从${label}新建节点`} title="新建关联节点" onClick={(event) => { event.stopPropagation(); onAdd() }} className={cn(baseClassName, 'border-[var(--accent)] bg-[var(--accent)] text-white hover:brightness-105')}><Plus className="size-3.5" weight="bold" /></button><button type="button" aria-label={`编辑${label}节点`} title="编辑节点" onClick={(event) => { event.stopPropagation(); onEdit() }} className={cn(baseClassName, 'border-[#4d5f78] bg-[#4d5f78] text-white hover:brightness-105')}><NotePencil className="size-3.5" weight="bold" /></button><button type="button" aria-label={`删除${label}节点`} title="删除节点" onClick={(event) => { event.stopPropagation(); onDelete() }} className={cn(baseClassName, 'border-[var(--err-ink)] bg-[var(--err-ink)] text-white hover:brightness-105')}><Trash className="size-3.5" /></button></div>
}

function CustomNodeEditor({ node, onChange, onDone }: { node: GraphNode; onChange: (patch: Pick<GraphNode, 'title' | 'content' | 'icon'>) => void; onDone: () => void }) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const activeIcon = CUSTOM_ICON_OPTIONS.find((option) => option.id === (node.icon ?? 'note')) ?? CUSTOM_ICON_OPTIONS[0]
  const ActiveIcon = activeIcon.icon
  return <section aria-label="编辑节点" className="relative h-full rounded-[10px] bg-panel px-3 py-2.5"><NodeFrame /><div className="relative z-10 flex h-full flex-col">
    <div className="flex items-center gap-1.5"><DropdownMenu open={iconPickerOpen} onOpenChange={setIconPickerOpen}><DropdownMenuTrigger asChild><button type="button" aria-label="选择节点图标" title="选择节点图标" className="flex h-7 items-center gap-1 rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2 text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ActiveIcon className="size-3.5" weight="bold" /><CaretDown className="size-3" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-[188px] p-2"><p className="px-1 pb-2 text-[8px] font-medium text-[var(--muted)]">选择节点图标</p><div className="grid grid-cols-4 gap-1">{CUSTOM_ICON_OPTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={`选择${label}图标`} aria-pressed={(node.icon ?? 'note') === id} title={label} onClick={() => { onChange({ title: node.title, content: node.content, icon: id }); setIconPickerOpen(false) }} className={cn('flex size-8 items-center justify-center rounded-[7px] border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', (node.icon ?? 'note') === id ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-transparent text-[var(--muted-strong)] hover:border-[var(--line)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]')}><Icon className="size-4" weight="bold" /></button>)}</div></DropdownMenuContent></DropdownMenu><span className="text-[8px] text-[var(--muted)]">节点图标</span><button type="button" aria-label="完成编辑" onClick={onDone} className="ml-auto flex size-7 items-center justify-center rounded-[7px] bg-[var(--accent)] text-white outline-none transition-[filter,transform] hover:brightness-105 active:scale-90 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Check className="size-3.5" weight="bold" /></button></div>
    <input aria-label="节点标题" value={node.title ?? ''} maxLength={32} onChange={(event) => onChange({ title: event.target.value, content: node.content, icon: node.icon })} className="mt-2.5 h-7 w-full border-0 border-b border-dashed border-[var(--line)] bg-transparent px-0 text-[10.5px] font-semibold text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]" placeholder="输入节点标题" />
    <textarea aria-label="节点内容" value={node.content ?? ''} maxLength={120} onChange={(event) => onChange({ title: node.title, content: event.target.value, icon: node.icon })} className="mt-2 min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[8.5px] leading-4 text-[var(--muted-strong)] outline-none placeholder:text-[var(--muted)]" placeholder="输入节点内容" />
  </div></section>
}

function GraphSummary({ nodeCount, activity }: { nodeCount: number; activity: string }) { return <div aria-live="polite" className="pointer-events-none absolute left-4 top-4 z-30 flex h-8 items-center gap-2 rounded-[9px] border border-[var(--line)] bg-panel/95 px-2.5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.65)] backdrop-blur"><ShareNetwork className="size-3.5 text-[var(--ink)]" weight="bold" /><span className="text-[8.5px] font-semibold text-[var(--ink)]">关系画布</span><span className="text-[8px] text-[var(--muted)]">{nodeCount} 个节点 · {activity}</span></div> }

function CanvasControls({ zoom, panMode, onZoomOut, onZoomIn, onFit, onReset, onTogglePan }: { zoom: number; panMode: boolean; onZoomOut: () => void; onZoomIn: () => void; onFit: () => void; onReset: () => void; onTogglePan: () => void }) {
  return <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-2"><ControlButton label="放大" onClick={onZoomIn}><MagnifyingGlassPlus className="size-4" /></ControlButton><ControlButton label="缩小" onClick={onZoomOut}><MagnifyingGlassMinus className="size-4" /></ControlButton><ControlButton label={`适应画布，当前 ${Math.round(zoom * 100)}%`} onClick={onFit}><CornersOut className="size-4" /></ControlButton><ControlButton label="重置节点布局" onClick={onReset}><ArrowCounterClockwise className="size-4" /></ControlButton><button type="button" aria-label="拖动画布" aria-pressed={panMode} onClick={onTogglePan} className={cn(controlClassName, panMode && 'border-[#172033] bg-[#172033] text-white hover:bg-[#172033]')}><Hand className="size-4" weight={panMode ? 'fill' : 'regular'} /></button></div>
}

const controlClassName = 'flex size-9 items-center justify-center rounded-[10px] border border-[var(--line-strong)] bg-panel text-[var(--muted-strong)] shadow-[0_8px_20px_-14px_rgba(15,23,42,0.55)] outline-none transition-[background,color,border-color,transform] hover:border-[#b7c0cf] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-90 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'
function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} onClick={onClick} className={controlClassName}>{children}</button> }

function GraphConnectors({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node.box]))
  const visibleEdges = edges.flatMap((edge) => { const source = nodeMap.get(edge.source); const target = nodeMap.get(edge.target); return source && target ? [{ edge, geometry: calculateEdge(source, target) }] : [] })
  return <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} fill="none"><g stroke="#172033" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 6">{visibleEdges.map(({ edge, geometry }) => <path key={edge.id} d={geometry.path} />)}</g><g fill="var(--panel)" stroke="#172033" strokeWidth="2">{visibleEdges.map(({ edge, geometry }) => <circle key={edge.id} cx={geometry.end.x} cy={geometry.end.y} r="4" />)}</g></svg>
}

function calculateEdge(source: NodeBox, target: NodeBox): { path: string; end: Offset } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  if (Math.abs(dx) >= Math.abs(dy)) { const direction = dx >= 0 ? 1 : -1; const start = { x: sourceCenter.x + direction * source.width / 2, y: sourceCenter.y }; const end = { x: targetCenter.x - direction * (target.width / 2 + 4), y: targetCenter.y }; const bend = Math.max(48, Math.abs(end.x - start.x) * 0.42); return { path: `M ${start.x} ${start.y} C ${start.x + direction * bend} ${start.y}, ${end.x - direction * bend} ${end.y}, ${end.x} ${end.y}`, end } }
  const direction = dy >= 0 ? 1 : -1
  const start = { x: sourceCenter.x, y: sourceCenter.y + direction * source.height / 2 }
  const end = { x: targetCenter.x, y: targetCenter.y - direction * (target.height / 2 + 4) }
  const bend = Math.max(48, Math.abs(end.y - start.y) * 0.42)
  return { path: `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * bend}, ${end.x} ${end.y - direction * bend}, ${end.x} ${end.y}`, end }
}

function renderNodeContent(node: GraphNode, ticket: DtsTicketSummary, detail: DtsTicketDetail | null, editing = false, onChange: (patch: Pick<GraphNode, 'title' | 'content' | 'icon'>) => void = () => undefined, onDone: () => void = () => undefined): React.ReactNode {
  if (editing) return <CustomNodeEditor node={node} onChange={onChange} onDone={onDone} />
  if (node.edited || node.kind === 'custom') {
    const EditedIcon = CUSTOM_ICON_OPTIONS.find((option) => option.id === node.icon)?.icon ?? NotePencil
    return <GraphNote title={node.title ?? '新建节点'} icon={EditedIcon} meta={node.kind === 'custom' ? '自定义' : '已编辑'} tone="slate"><p className="line-clamp-3 text-[8.5px] leading-4 text-[var(--muted-strong)]">{node.content || '暂无补充内容。'}</p></GraphNote>
  }
  if (node.kind === 'ticket') return <CenterTicketNote ticket={ticket} detail={detail} />
  if (node.kind === 'impact') return <GraphNote title="影响范围" icon={Stack} meta={`${ticket.productPath.length || 1} 项`} tone="violet">{(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).slice(0, 3).map((item, index) => <CompactRow key={`${item}-${index}`} label={item} value={index === 0 ? '核心服务' : `${index + 1} 个版本`} />)}</GraphNote>
  if (node.kind === 'evidence') return <GraphNote title="关键证据" icon={FileText} meta={`${detail?.fields.length ?? 0} 条`} tone="mint">{detail?.fields.length ? detail.fields.slice(0, 3).map((field) => <CompactRow key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />) : <EmptyCopy>等待 DTS 返回详情字段。</EmptyCopy>}</GraphNote>
  if (node.kind === 'flow') return <FlowNote nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} status={ticket.status} />
  if (node.kind === 'people') return <GraphNote title="责任人与时间" icon={User} meta={`${detail?.handlers.length || (ticket.currentHandler ? 1 : 0)} 人`} tone="blue"><IconRow icon={User} label="负责人" value={ticket.currentHandler ?? '待分配'} /><IconRow icon={UsersThree} label="创建人" value={ticket.creator ?? '—'} /><IconRow icon={CalendarBlank} label="创建时间" value={ticket.createdAt ?? '—'} /></GraphNote>
  if (node.kind === 'relations') return <GraphNote title="关联问题" icon={LinkSimple} meta={`${detail?.relations.length ?? 0} 个`} tone="blue">{detail?.relations.length ? detail.relations.slice(0, 3).map((relation, index) => <RelatedRow key={`${relation.objectType}-${relation.externalId}`} relation={relation} severity={index === 0 ? '严重' : '一般'} />) : <EmptyCopy>暂无外部关联问题。</EmptyCopy>}</GraphNote>
  if (node.kind === 'actions') return <GraphNote title="下一步行动" icon={ListChecks} meta="2 项" tone="mint"><ActionRow index={1} title={detail?.currentNode?.name ?? '确认问题范围'} owner={detail?.currentNode?.handler ?? ticket.currentHandler ?? '待分配'} /><ActionRow index={2} title={nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)} owner="完成后流转" /></GraphNote>
  return null
}

function GraphNote({ title, icon: Icon, meta, tone, children }: { title: string; icon: typeof Stack; meta: string; tone: 'blue' | 'violet' | 'mint' | 'slate'; children: React.ReactNode }) {
  const toneClass = { blue: 'text-[#3b6fe8]', violet: 'text-[#7255df]', mint: 'text-[#149777]', slate: 'text-[#66758a]' }[tone]
  return <section className="relative h-full rounded-[10px] bg-panel px-3.5 py-3 shadow-none transition-colors duration-150"><NodeFrame /><div className="relative z-10"><header className="mb-3 flex items-center gap-2"><Icon className={cn('size-4 shrink-0', toneClass)} weight="bold" /><h2 className="text-[10.5px] font-semibold text-[var(--ink)]">{title}</h2><span className="ml-auto text-[7.5px] text-[var(--muted)]">{meta}</span></header><div className="space-y-2.5">{children}</div></div></section>
}

function NodeFrame() { return <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" fill="none"><rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="10" stroke="var(--node-frame-color, color-mix(in srgb, var(--ink) 26%, transparent))" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" /></svg> }

function CenterTicketNote({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) { const description = ticket.remark || detail?.fields.find((field) => field.label.includes('描述'))?.value?.toString() || '暂无补充描述，可结合周边关系继续处理。'; return <article className="relative h-full rounded-[10px] bg-panel px-4 py-3.5 shadow-none transition-colors duration-150"><NodeFrame /><div className="relative z-10 h-full"><div className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', severityTone(ticket.severity))} /><SeverityBadge value={ticket.severity} /><span className="rounded-[4px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[7px] text-[var(--accent-ink)]">{ticket.status}</span></div><h2 className="mt-2.5 line-clamp-2 text-[12px] font-semibold leading-[17px] tracking-[-0.01em] text-[var(--ink)]">{ticket.title}</h2><p className="mt-1.5 line-clamp-2 text-[8.5px] leading-[14px] text-[var(--muted-strong)]">{description}</p><div className="absolute inset-x-0 bottom-0 flex items-center gap-2 text-[7.5px] text-[var(--muted)]"><span className="truncate">{ticket.id}</span><span className="ml-auto truncate">{ticket.currentHandler ?? '待分配'}</span></div></div></article> }
function FlowNote({ nodes, currentNode, status }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; status: string }) { const visible = nodes.length ? nodes.slice(0, 4) : [{ id: 'current', name: status, status: 'active', handler: null, handledAt: null }]; const activeIndex = Math.max(0, visible.findIndex((node) => node.id === currentNode?.id)); return <GraphNote title="流程进度" icon={FlowArrow} meta={`${visible.length} 个阶段`} tone="blue"><ol className="space-y-2">{visible.map((node, index) => { const active = index === activeIndex; const done = index < activeIndex; return <li key={node.id} className="flex items-center gap-2"><span className={cn('flex size-3.5 items-center justify-center rounded-full border', active ? 'border-[#172033] text-[#172033]' : done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-2.5" weight="bold" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[#172033]' : 'bg-[var(--line-strong)]')} />}</span><span className={cn('min-w-0 flex-1 truncate text-[8.5px]', active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</span>{active ? <span className="rounded-[4px] bg-[var(--accent-soft)] px-1 py-0.5 text-[7px] text-[var(--accent-ink)]">当前</span> : null}</li> })}</ol></GraphNote> }

function findOpenPosition(nodes: GraphNode[], source: NodeBox, width: number, height: number): NodeBox {
  const candidates = [{ x: source.x + source.width + 48, y: source.y + 28 }, { x: source.x - width - 48, y: source.y + 28 }, { x: source.x + 24, y: source.y + source.height + 52 }, { x: source.x + 24, y: source.y - height - 52 }, { x: source.x + source.width + 48, y: source.y + source.height + 38 }, { x: source.x - width - 48, y: source.y + source.height + 38 }]
  for (const candidate of candidates) { const box = { x: clamp(candidate.x, 0, STAGE_WIDTH - width), y: clamp(candidate.y, 36, STAGE_HEIGHT - height), width, height }; if (!nodes.some((node) => rectanglesOverlap(box, node.box, 24))) return box }
  for (let y = 56; y <= STAGE_HEIGHT - height; y += 52) for (let x = 24; x <= STAGE_WIDTH - width; x += 58) { const box = { x, y, width, height }; if (!nodes.some((node) => rectanglesOverlap(box, node.box, 20))) return box }
  return { x: clamp(source.x + 36, 0, STAGE_WIDTH - width), y: clamp(source.y + 36, 36, STAGE_HEIGHT - height), width, height }
}

function rectanglesOverlap(a: NodeBox, b: NodeBox, gap: number): boolean { return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y }
function CompactRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-2 text-[8.5px]"><span className="size-1.5 shrink-0 rounded-full bg-[#7888a5]" /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="max-w-[78px] truncate text-[var(--muted)]">{value}</span></div> }
function IconRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) { return <div className="grid grid-cols-[62px_minmax(0,1fr)] items-center gap-2 text-[8.5px]"><span className="flex items-center gap-1.5 text-[var(--muted)]"><Icon className="size-3.5" />{label}</span><span className="truncate text-right font-medium text-[var(--ink-soft)]">{value}</span></div> }
function RelatedRow({ relation, severity }: { relation: DtsTicketDetail['relations'][number]; severity: string }) { return <a href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="grid grid-cols-[7px_minmax(0,1fr)_36px] items-center gap-2 text-[8.5px] text-[var(--ink-soft)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className={cn('size-1.5 rounded-full', severity === '严重' ? 'bg-[#ef4565]' : 'bg-[#f29d38]')} /><span className="truncate">{relation.externalId}</span><span className="rounded-[4px] bg-[var(--surface-subtle)] px-1 py-0.5 text-center text-[7px] text-[var(--muted)]">{severity}</span></a> }
function ActionRow({ index, title, owner }: { index: number; title: string; owner: string }) { return <div className="flex items-start gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[7.5px] font-semibold text-[var(--accent-ink)]">{index}</span><div className="min-w-0"><p className="truncate text-[8.5px] font-semibold text-[var(--ink)]">{title}</p><p className="mt-0.5 truncate text-[7.5px] text-[var(--muted)]">{owner}</p></div></div> }
function EmptyCopy({ children }: { children: React.ReactNode }) { return <p className="text-[8.5px] leading-4 text-[var(--muted)]">{children}</p> }
function SeverityBadge({ value }: { value: DtsSeverity | null }) { return <span className={cn('rounded-[4px] px-1.5 py-0.5 text-[7px] font-medium', severityBadgeTone(value))}>{value ?? '一般'}</span> }
function editableNodeDefaults(node: GraphNode, ticket: DtsTicketSummary, detail: DtsTicketDetail | null): Required<Pick<GraphNode, 'title' | 'content' | 'icon'>> {
  if (node.kind === 'custom') return { title: node.title ?? '新建节点', content: node.content ?? '拖动节点调整位置，继续新建可扩展这条关系。', icon: node.icon ?? 'note' }
  if (node.kind === 'ticket') return { title: ticket.title, content: ticket.remark || '暂无补充描述，可结合周边关系继续处理。', icon: 'document' }
  if (node.kind === 'impact') return { title: '影响范围', content: (ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).join('；'), icon: 'stack' }
  if (node.kind === 'evidence') return { title: '关键证据', content: detail?.fields.slice(0, 3).map((field) => `${field.label}：${field.value == null ? '—' : String(field.value)}`).join('；') || '等待 DTS 返回详情字段。', icon: 'database' }
  if (node.kind === 'flow') return { title: '流程进度', content: detail?.flowNodes.map((item) => item.name).join(' → ') || ticket.status, icon: 'task' }
  if (node.kind === 'people') return { title: '责任人与时间', content: `负责人：${ticket.currentHandler ?? '待分配'}；创建人：${ticket.creator ?? '—'}；创建时间：${ticket.createdAt ?? '—'}`, icon: 'person' }
  if (node.kind === 'relations') return { title: '关联问题', content: detail?.relations.map((relation) => relation.externalId).join('；') || '暂无外部关联问题。', icon: 'link' }
  return { title: '下一步行动', content: `${detail?.currentNode?.name ?? '确认问题范围'}；${nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)}`, icon: 'task' }
}
function cloneInitialNodes(): GraphNode[] { return INITIAL_NODES.map((node) => ({ ...node, box: { ...node.box } })) }
function graphNodeLabel(node: GraphNode): string { if (node.kind === 'custom') return node.title ?? '新建节点'; return { ticket: '当前工单', impact: '影响范围', evidence: '关键证据', flow: '流程进度', people: '责任人与时间', relations: '关联问题', actions: '下一步行动' }[node.kind] }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }
function calculateFitZoom(width: number, height: number): number { return Math.min(1, Math.max(MIN_ZOOM, (width - 58) / STAGE_WIDTH), Math.max(MIN_ZOOM, (height - 44) / STAGE_HEIGHT)) }
function severityTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[#d92d20]' : value === '严重' ? 'bg-[#ef4565]' : value === '一般' ? 'bg-[#e6982d]' : 'bg-[#6681f5]' }
function severityBadgeTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[color-mix(in_srgb,var(--err-ink)_16%,transparent)] text-[var(--err-ink)]' : value === '严重' ? 'bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] text-[var(--err-ink)]' : value === '一般' ? 'bg-[var(--warn-soft)] text-[var(--warn-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
function nextNodeTitle(nodes: DtsFlowNodeSummary[], current: DtsFlowNodeSummary | null): string { if (!nodes.length || !current) return '补充处理结论并推进流程'; const index = nodes.findIndex((node) => node.id === current.id); return nodes[index + 1]?.name ?? '完成当前节点并关闭工单' }
