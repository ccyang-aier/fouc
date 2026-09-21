import { useEffect, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  CalendarBlank,
  Check,
  CornersOut,
  FileText,
  FlowArrow,
  Hand,
  LinkSimple,
  ListChecks,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ShareNetwork,
  Stack,
  User,
  UsersThree,
} from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsSeverity, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Offset = { x: number; y: number }
type NodeId = 'ticket' | 'impact' | 'evidence' | 'flow' | 'people' | 'relations' | 'actions'
type NodeBox = Offset & { width: number; height: number }
type NodeLayout = Record<NodeId, NodeBox>

const STAGE_WIDTH = 900
const STAGE_HEIGHT = 660
const MIN_ZOOM = 0.46
const MAX_ZOOM = 1.2
const INITIAL_NODES: NodeLayout = {
  ticket: { x: 310, y: 58, width: 255, height: 152 },
  impact: { x: 28, y: 205, width: 220, height: 140 },
  evidence: { x: 62, y: 424, width: 224, height: 140 },
  flow: { x: 658, y: 58, width: 212, height: 146 },
  people: { x: 578, y: 292, width: 218, height: 136 },
  relations: { x: 324, y: 472, width: 222, height: 128 },
  actions: { x: 654, y: 492, width: 216, height: 132 },
}
const EDGE_TARGETS: NodeId[] = ['impact', 'evidence', 'flow', 'people', 'relations', 'actions']

export function DtsRelationshipGraph({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const [zoom, setZoom] = useState(0.78)
  const [panMode, setPanMode] = useState(false)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [nodes, setNodes] = useState<NodeLayout>(() => cloneInitialNodes())
  const [selectedNode, setSelectedNode] = useState<NodeId>('ticket')
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasDragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null)

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
  }

  function resetLayout() {
    setNodes(cloneInitialNodes())
    setSelectedNode('ticket')
    fitCanvas()
  }

  function moveNode(nodeId: NodeId, position: Offset) {
    setNodes((current) => {
      const node = current[nodeId]
      return {
        ...current,
        [nodeId]: {
          ...node,
          x: clamp(position.x, 0, STAGE_WIDTH - node.width),
          y: clamp(position.y, 0, STAGE_HEIGHT - node.height),
        },
      }
    })
  }

  function startCanvasDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!panMode) return
    canvasDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveCanvas(event: React.PointerEvent<HTMLDivElement>) {
    const drag = canvasDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({ x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY })
  }

  return (
    <div
      ref={canvasRef}
      aria-label="DTS 工单关系图谱"
      className="relative min-h-0 flex-1 overflow-hidden bg-[var(--panel)]"
      style={{ backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--muted) 28%, transparent) 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }}
    >
      <GraphSummary />
      <CanvasControls
        zoom={zoom}
        panMode={panMode}
        onZoomOut={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.08))}
        onZoomIn={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.08))}
        onFit={fitCanvas}
        onReset={resetLayout}
        onTogglePan={() => setPanMode((value) => !value)}
      />
      <div
        className={cn('absolute inset-0', panMode && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={startCanvasDrag}
        onPointerMove={moveCanvas}
        onPointerUp={() => { canvasDragRef.current = null }}
        onPointerCancel={() => { canvasDragRef.current = null }}
      >
        <div
          className="absolute left-1/2 top-1/2 origin-center transition-transform duration-150"
          style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          <GraphConnectors nodes={nodes} />
          <DraggableNode nodeId="ticket" box={nodes.ticket} zoom={zoom} selected={selectedNode === 'ticket'} onMove={moveNode} onSelect={setSelectedNode}>
            <CenterTicketNote ticket={ticket} detail={detail} />
          </DraggableNode>
          <DraggableNode nodeId="impact" box={nodes.impact} zoom={zoom} selected={selectedNode === 'impact'} onMove={moveNode} onSelect={setSelectedNode}>
            <GraphNote title="影响范围" icon={Stack} meta={`${ticket.productPath.length || 1} 项`} tone="violet">
              {(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).slice(0, 3).map((item, index) => <CompactRow key={`${item}-${index}`} label={item} value={index === 0 ? '核心服务' : `${index + 1} 个版本`} />)}
            </GraphNote>
          </DraggableNode>
          <DraggableNode nodeId="evidence" box={nodes.evidence} zoom={zoom} selected={selectedNode === 'evidence'} onMove={moveNode} onSelect={setSelectedNode}>
            <GraphNote title="关键证据" icon={FileText} meta={`${detail?.fields.length ?? 0} 条`} tone="mint">
              {detail?.fields.length ? detail.fields.slice(0, 3).map((field) => <CompactRow key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />) : <EmptyCopy>等待 DTS 返回详情字段。</EmptyCopy>}
            </GraphNote>
          </DraggableNode>
          <DraggableNode nodeId="flow" box={nodes.flow} zoom={zoom} selected={selectedNode === 'flow'} onMove={moveNode} onSelect={setSelectedNode}>
            <FlowNote nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} status={ticket.status} />
          </DraggableNode>
          <DraggableNode nodeId="people" box={nodes.people} zoom={zoom} selected={selectedNode === 'people'} onMove={moveNode} onSelect={setSelectedNode}>
            <GraphNote title="责任人与时间" icon={User} meta={`${detail?.handlers.length || (ticket.currentHandler ? 1 : 0)} 人`} tone="blue">
              <IconRow icon={User} label="负责人" value={ticket.currentHandler ?? '待分配'} />
              <IconRow icon={UsersThree} label="创建人" value={ticket.creator ?? '—'} />
              <IconRow icon={CalendarBlank} label="创建时间" value={ticket.createdAt ?? '—'} />
            </GraphNote>
          </DraggableNode>
          <DraggableNode nodeId="relations" box={nodes.relations} zoom={zoom} selected={selectedNode === 'relations'} onMove={moveNode} onSelect={setSelectedNode}>
            <GraphNote title="关联问题" icon={LinkSimple} meta={`${detail?.relations.length ?? 0} 个`} tone="blue">
              {detail?.relations.length ? detail.relations.slice(0, 3).map((relation, index) => <RelatedRow key={`${relation.objectType}-${relation.externalId}`} relation={relation} severity={index === 0 ? '严重' : '一般'} />) : <EmptyCopy>暂无外部关联问题。</EmptyCopy>}
            </GraphNote>
          </DraggableNode>
          <DraggableNode nodeId="actions" box={nodes.actions} zoom={zoom} selected={selectedNode === 'actions'} onMove={moveNode} onSelect={setSelectedNode}>
            <GraphNote title="下一步行动" icon={ListChecks} meta="2 项" tone="mint">
              <ActionRow index={1} title={detail?.currentNode?.name ?? '确认问题范围'} owner={detail?.currentNode?.handler ?? ticket.currentHandler ?? '待分配'} />
              <ActionRow index={2} title={nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)} owner="完成后流转" />
            </GraphNote>
          </DraggableNode>
        </div>
      </div>
    </div>
  )
}

function DraggableNode({ nodeId, box, zoom, selected, onMove, onSelect, children }: { nodeId: NodeId; box: NodeBox; zoom: number; selected: boolean; onMove: (nodeId: NodeId, position: Offset) => void; onSelect: (nodeId: NodeId) => void; children: React.ReactNode }) {
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null)

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a, button')) return
    event.stopPropagation()
    onSelect(nodeId)
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: box.x, y: box.y } }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.stopPropagation()
    onMove(nodeId, { x: drag.origin.x + (event.clientX - drag.startX) / zoom, y: drag.origin.y + (event.clientY - drag.startY) / zoom })
  }

  function moveWithKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.shiftKey ? 24 : 8
    const movement = event.key === 'ArrowLeft' ? { x: -delta, y: 0 } : event.key === 'ArrowRight' ? { x: delta, y: 0 } : event.key === 'ArrowUp' ? { x: 0, y: -delta } : event.key === 'ArrowDown' ? { x: 0, y: delta } : null
    if (!movement) return
    event.preventDefault()
    onSelect(nodeId)
    onMove(nodeId, { x: box.x + movement.x, y: box.y + movement.y })
  }

  return <div
    role="button"
    tabIndex={0}
    aria-label={`拖动${nodeLabel(nodeId)}节点`}
    aria-pressed={selected}
    className={cn('absolute z-10 touch-none cursor-grab rounded-[11px] outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#172033]/35', selected && 'z-20 ring-2 ring-[#172033]/18 [&>*]:border-[#172033] [&>*]:shadow-[0_18px_38px_-22px_rgba(15,23,42,0.5)]')}
    style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    onPointerDown={startDrag}
    onPointerMove={moveDrag}
    onPointerUp={(event) => { event.stopPropagation(); dragRef.current = null }}
    onPointerCancel={() => { dragRef.current = null }}
    onKeyDown={moveWithKeyboard}
  >{children}</div>
}

function GraphSummary() {
  return <div className="pointer-events-none absolute left-4 top-4 z-30 flex h-8 items-center gap-2 rounded-[9px] border border-[var(--line)] bg-panel/95 px-2.5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.65)] backdrop-blur"><ShareNetwork className="size-3.5 text-[var(--ink)]" weight="bold" /><span className="text-[8.5px] font-semibold text-[var(--ink)]">关系画布</span><span className="text-[8px] text-[var(--muted)]">拖拽节点自由排列</span></div>
}

function CanvasControls({ zoom, panMode, onZoomOut, onZoomIn, onFit, onReset, onTogglePan }: { zoom: number; panMode: boolean; onZoomOut: () => void; onZoomIn: () => void; onFit: () => void; onReset: () => void; onTogglePan: () => void }) {
  return <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col overflow-hidden rounded-[10px] border border-[var(--line)] bg-panel/95 shadow-[0_14px_34px_-20px_rgba(15,23,42,0.5)] backdrop-blur"><ControlButton label="放大" onClick={onZoomIn}><MagnifyingGlassPlus className="size-4" /></ControlButton><ControlButton label="缩小" onClick={onZoomOut}><MagnifyingGlassMinus className="size-4" /></ControlButton><ControlButton label={`适应画布，当前 ${Math.round(zoom * 100)}%`} onClick={onFit}><CornersOut className="size-4" /></ControlButton><ControlButton label="重置节点布局" onClick={onReset}><ArrowCounterClockwise className="size-4" /></ControlButton><button type="button" aria-label="拖动画布" aria-pressed={panMode} onClick={onTogglePan} className={cn('flex size-9 items-center justify-center text-[var(--muted-strong)] outline-none transition-[background,color,transform] hover:bg-[var(--surface-hover)] active:scale-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]', panMode && 'bg-[#172033] text-white hover:bg-[#172033]')}><Hand className="size-4" weight={panMode ? 'fill' : 'regular'} /></button></div>
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className="flex size-9 items-center justify-center border-b border-[var(--line)] text-[var(--muted-strong)] outline-none transition-[background,color,transform] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-90 active:bg-[var(--surface-active)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">{children}</button>
}

function GraphConnectors({ nodes }: { nodes: NodeLayout }) {
  return <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} fill="none"><g stroke="#172033" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 6">{EDGE_TARGETS.map((targetId) => { const edge = calculateEdge(nodes.ticket, nodes[targetId]); return <path key={targetId} d={edge.path} /> })}</g><g fill="var(--panel)" stroke="#172033" strokeWidth="2">{EDGE_TARGETS.map((targetId) => { const edge = calculateEdge(nodes.ticket, nodes[targetId]); return <circle key={targetId} cx={edge.end.x} cy={edge.end.y} r="4" /> })}</g></svg>
}

function calculateEdge(source: NodeBox, target: NodeBox): { path: string; end: Offset } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = dx >= 0 ? 1 : -1
    const start = { x: sourceCenter.x + direction * source.width / 2, y: sourceCenter.y }
    const end = { x: targetCenter.x - direction * target.width / 2, y: targetCenter.y }
    const bend = Math.max(48, Math.abs(end.x - start.x) * 0.42)
    return { path: `M ${start.x} ${start.y} C ${start.x + direction * bend} ${start.y}, ${end.x - direction * bend} ${end.y}, ${end.x} ${end.y}`, end }
  }
  const direction = dy >= 0 ? 1 : -1
  const start = { x: sourceCenter.x, y: sourceCenter.y + direction * source.height / 2 }
  const end = { x: targetCenter.x, y: targetCenter.y - direction * target.height / 2 }
  const bend = Math.max(48, Math.abs(end.y - start.y) * 0.42)
  return { path: `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * bend}, ${end.x} ${end.y - direction * bend}, ${end.x} ${end.y}`, end }
}

function GraphNote({ title, icon: Icon, meta, tone, children }: { title: string; icon: typeof Stack; meta: string; tone: 'blue' | 'violet' | 'mint'; children: React.ReactNode }) {
  const toneClass = { blue: 'bg-[#eaf1ff] text-[#3b6fe8]', violet: 'bg-[#f0ecff] text-[#7255df]', mint: 'bg-[#e8f8f3] text-[#149777]' }[tone]
  return <section className="h-full rounded-[10px] border border-[var(--line-strong)] bg-panel px-3.5 py-3 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.52)] transition-[border-color,box-shadow] duration-150 hover:border-[#aeb7c7] hover:shadow-[0_16px_32px_-20px_rgba(15,23,42,0.38)]"><header className="mb-3 flex items-center gap-2"><span className={cn('flex size-6 items-center justify-center rounded-[7px]', toneClass)}><Icon className="size-3.5" weight="bold" /></span><h2 className="text-[10.5px] font-semibold text-[var(--ink)]">{title}</h2><span className="ml-auto text-[7.5px] text-[var(--muted)]">{meta}</span></header><div className="space-y-2.5">{children}</div></section>
}

function CenterTicketNote({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const description = ticket.remark || detail?.fields.find((field) => field.label.includes('描述'))?.value?.toString() || '暂无补充描述，可结合周边关系继续处理。'
  return <article className="relative h-full rounded-[10px] border border-dashed border-[#172033] bg-panel px-4 py-3.5 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.42)]"><div className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', severityTone(ticket.severity))} /><SeverityBadge value={ticket.severity} /><span className="rounded-[4px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[7px] text-[var(--accent-ink)]">{ticket.status}</span></div><h2 className="mt-2.5 line-clamp-2 text-[12px] font-semibold leading-[17px] tracking-[-0.01em] text-[var(--ink)]">{ticket.title}</h2><p className="mt-1.5 line-clamp-2 text-[8.5px] leading-[14px] text-[var(--muted-strong)]">{description}</p><div className="absolute inset-x-4 bottom-3 flex items-center gap-2 text-[7.5px] text-[var(--muted)]"><span className="truncate">{ticket.id}</span><span className="ml-auto truncate">{ticket.currentHandler ?? '待分配'}</span></div></article>
}

function FlowNote({ nodes, currentNode, status }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; status: string }) {
  const visible = nodes.length ? nodes.slice(0, 4) : [{ id: 'current', name: status, status: 'active', handler: null, handledAt: null }]
  const activeIndex = Math.max(0, visible.findIndex((node) => node.id === currentNode?.id))
  return <GraphNote title="流程进度" icon={FlowArrow} meta={`${visible.length} 个阶段`} tone="blue"><ol className="space-y-2">{visible.map((node, index) => { const active = index === activeIndex; const done = index < activeIndex; return <li key={node.id} className="flex items-center gap-2"><span className={cn('flex size-3.5 items-center justify-center rounded-full border', active ? 'border-[#172033] text-[#172033]' : done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-2.5" weight="bold" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[#172033]' : 'bg-[var(--line-strong)]')} />}</span><span className={cn('min-w-0 flex-1 truncate text-[8.5px]', active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</span>{active ? <span className="rounded-[4px] bg-[var(--accent-soft)] px-1 py-0.5 text-[7px] text-[var(--accent-ink)]">当前</span> : null}</li> })}</ol></GraphNote>
}

function CompactRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-2 text-[8.5px]"><span className="size-1.5 shrink-0 rounded-full bg-[#7888a5]" /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="max-w-[78px] truncate text-[var(--muted)]">{value}</span></div> }
function IconRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) { return <div className="grid grid-cols-[62px_minmax(0,1fr)] items-center gap-2 text-[8.5px]"><span className="flex items-center gap-1.5 text-[var(--muted)]"><Icon className="size-3.5" />{label}</span><span className="truncate text-right font-medium text-[var(--ink-soft)]">{value}</span></div> }
function RelatedRow({ relation, severity }: { relation: DtsTicketDetail['relations'][number]; severity: string }) { return <a href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="grid grid-cols-[7px_minmax(0,1fr)_36px] items-center gap-2 text-[8.5px] text-[var(--ink-soft)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className={cn('size-1.5 rounded-full', severity === '严重' ? 'bg-[#ef4565]' : 'bg-[#f29d38]')} /><span className="truncate">{relation.externalId}</span><span className="rounded-[4px] bg-[var(--surface-subtle)] px-1 py-0.5 text-center text-[7px] text-[var(--muted)]">{severity}</span></a> }
function ActionRow({ index, title, owner }: { index: number; title: string; owner: string }) { return <div className="flex items-start gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[7.5px] font-semibold text-[var(--accent-ink)]">{index}</span><div className="min-w-0"><p className="truncate text-[8.5px] font-semibold text-[var(--ink)]">{title}</p><p className="mt-0.5 truncate text-[7.5px] text-[var(--muted)]">{owner}</p></div></div> }
function EmptyCopy({ children }: { children: React.ReactNode }) { return <p className="text-[8.5px] leading-4 text-[var(--muted)]">{children}</p> }
function SeverityBadge({ value }: { value: DtsSeverity | null }) { return <span className={cn('rounded-[4px] px-1.5 py-0.5 text-[7px] font-medium', severityBadgeTone(value))}>{value ?? '一般'}</span> }
function cloneInitialNodes(): NodeLayout { return Object.fromEntries(Object.entries(INITIAL_NODES).map(([id, box]) => [id, { ...box }])) as NodeLayout }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }
function nodeLabel(nodeId: NodeId): string { return { ticket: '当前工单', impact: '影响范围', evidence: '关键证据', flow: '流程进度', people: '责任人与时间', relations: '关联问题', actions: '下一步行动' }[nodeId] }
function calculateFitZoom(width: number, height: number): number { return Math.min(0.95, Math.max(MIN_ZOOM, (width - 56) / STAGE_WIDTH), Math.max(MIN_ZOOM, (height - 42) / STAGE_HEIGHT)) }
function severityTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[#d92d20]' : value === '严重' ? 'bg-[#ef4565]' : value === '一般' ? 'bg-[#e6982d]' : 'bg-[#6681f5]' }
function severityBadgeTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[color-mix(in_srgb,var(--err-ink)_16%,transparent)] text-[var(--err-ink)]' : value === '严重' ? 'bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] text-[var(--err-ink)]' : value === '一般' ? 'bg-[var(--warn-soft)] text-[var(--warn-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
function nextNodeTitle(nodes: DtsFlowNodeSummary[], current: DtsFlowNodeSummary | null): string { if (!nodes.length || !current) return '补充处理结论并推进流程'; const index = nodes.findIndex((node) => node.id === current.id); return nodes[index + 1]?.name ?? '完成当前节点并关闭工单' }
