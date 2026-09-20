import { useEffect, useMemo } from 'react'
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap,
  Position, ReactFlow, type Edge, type Node, type NodeProps, type NodeTypes,
  useEdgesState, useNodesState,
} from '@xyflow/react'
import {
  CalendarBlank, Check, FileText, FlowArrow, LinkSimple, ListChecks, ShareNetwork, Stack, User, UsersThree,
} from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsSeverity, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type GraphNodeData = {
  kind: 'impact' | 'flow' | 'evidence' | 'ticket' | 'people' | 'relations' | 'actions'
  ticket: DtsTicketSummary
  detail: DtsTicketDetail | null
}
type DtsGraphNode = Node<GraphNodeData, 'dtsGraph'>

const NODE_TYPES = { dtsGraph: DtsGraphNodeCard } satisfies NodeTypes
const GRAPH_EDGES: Edge[] = [
  graphEdge('ticket-impact', 'ticket', 'impact', 'source-left', 'target-right'),
  graphEdge('ticket-flow', 'ticket', 'flow', 'source-right', 'target-left'),
  graphEdge('ticket-evidence', 'ticket', 'evidence', 'source-left', 'target-right'),
  graphEdge('ticket-people', 'ticket', 'people', 'source-right', 'target-left'),
  graphEdge('ticket-relations', 'ticket', 'relations', 'source-bottom', 'target-top'),
  graphEdge('ticket-actions', 'ticket', 'actions', 'source-bottom', 'target-top'),
]

export function DtsRelationshipGraph({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const graphNodes = useMemo(() => buildNodes(ticket, detail), [ticket, detail])
  const [nodes, setNodes, onNodesChange] = useNodesState<DtsGraphNode>(graphNodes)
  const [edges, , onEdgesChange] = useEdgesState(GRAPH_EDGES)

  useEffect(() => setNodes(graphNodes), [graphNodes, setNodes])

  return (
    <div className="dts-flow relative min-h-0 flex-1 overflow-hidden bg-[var(--surface-subtle)]/35">
      <ReactFlow<DtsGraphNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.08, minZoom: 0.58, maxZoom: 1 }}
        minZoom={0.48}
        maxZoom={1.4}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        nodesConnectable={false}
        elevateNodesOnSelect
        aria-label="DTS 工单关系图谱"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.05} color="var(--line-strong)" bgColor="var(--surface-subtle)" />
        <div className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-3 rounded-[9px] border border-[var(--line)] bg-panel/95 px-3 py-2 shadow-[0_8px_24px_-18px_rgba(31,48,82,0.55)] backdrop-blur-sm"><span className="flex size-6 items-center justify-center rounded-[6px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><ShareNetwork className="size-3.5" weight="bold" /></span><span><span className="block text-[9px] font-semibold text-[var(--ink)]">关系网络</span><span className="mt-0.5 block text-[7.5px] text-[var(--muted)]">7 个节点 · 6 条关系 · 支持拖拽与缩放</span></span></div>
        <Controls aria-label="关系图视图控制" orientation="horizontal" position="top-right" fitViewOptions={{ padding: 0.08 }} />
        <MiniMap<DtsGraphNode> ariaLabel="关系图小地图" pannable zoomable position="bottom-right" nodeColor={(node) => node.data.kind === 'ticket' ? 'var(--accent)' : 'var(--accent-soft-line)' } maskColor="color-mix(in srgb, var(--panel) 78%, transparent)" bgColor="var(--panel)" />
      </ReactFlow>
    </div>
  )
}

function buildNodes(ticket: DtsTicketSummary, detail: DtsTicketDetail | null): DtsGraphNode[] {
  const data = (kind: GraphNodeData['kind']): GraphNodeData => ({ kind, ticket, detail })
  return [
    { id: 'impact', type: 'dtsGraph', position: { x: 20, y: 25 }, data: data('impact') },
    { id: 'flow', type: 'dtsGraph', position: { x: 590, y: 25 }, data: data('flow') },
    { id: 'evidence', type: 'dtsGraph', position: { x: 20, y: 245 }, data: data('evidence') },
    { id: 'ticket', type: 'dtsGraph', position: { x: 302, y: 205 }, data: data('ticket'), className: 'dts-flow-ticket-node' },
    { id: 'people', type: 'dtsGraph', position: { x: 590, y: 245 }, data: data('people') },
    { id: 'relations', type: 'dtsGraph', position: { x: 125, y: 475 }, data: data('relations') },
    { id: 'actions', type: 'dtsGraph', position: { x: 545, y: 475 }, data: data('actions') },
  ]
}

function DtsGraphNodeCard({ data, selected }: NodeProps<DtsGraphNode>) {
  return (
    <div className={cn('relative transition-[filter,transform] duration-150', selected && 'drop-shadow-[0_12px_22px_rgba(48,83,163,0.18)]')}>
      <GraphHandles />
      {data.kind === 'ticket' ? <TicketNode ticket={data.ticket} detail={data.detail} selected={selected} /> : <PeripheralNode kind={data.kind} ticket={data.ticket} detail={data.detail} selected={selected} />}
    </div>
  )
}

function PeripheralNode({ kind, ticket, detail, selected }: { kind: Exclude<GraphNodeData['kind'], 'ticket'>; ticket: DtsTicketSummary; detail: DtsTicketDetail | null; selected: boolean }) {
  if (kind === 'impact') return <GraphCard title="影响范围" icon={Stack} meta={`${ticket.productPath.length || 1} 个服务`} tone="violet" source="服务拓扑" selected={selected}><div className="space-y-2.5">{(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).slice(0, 3).map((item, index) => <GraphRow key={`${item}-${index}`} label={item} value={index === 0 ? '核心服务' : `${index + 1} 个版本`} />)}{ticket.productType && ticket.productPath[0] !== ticket.productType ? <GraphRow label={ticket.productType} value="可能受影响" hollow /> : null}</div></GraphCard>
  if (kind === 'flow') return <FlowGraphCard nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} status={ticket.status} selected={selected} />
  if (kind === 'evidence') return <GraphCard title="关键证据" icon={FileText} meta={`${detail?.fields.length ?? 0} 条`} tone="mint" source="工单系统" selected={selected}><div className="space-y-2">{detail?.fields.length ? detail.fields.slice(0, 4).map((field) => <EvidenceRow key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />) : <EmptyCardCopy>详情字段将在 DTS 返回数据后显示。</EmptyCardCopy>}</div></GraphCard>
  if (kind === 'people') return <GraphCard title="责任人与时间" icon={User} meta={`${detail?.handlers.length || (ticket.currentHandler ? 1 : 0)} 人`} tone="blue" selected={selected}><div className="space-y-3"><MetaRow icon={User} label="负责人" value={ticket.currentHandler ?? '待分配'} /><MetaRow icon={UsersThree} label="创建人" value={ticket.creator ?? '—'} /><MetaRow icon={CalendarBlank} label="创建时间" value={ticket.createdAt ?? '—'} /><MetaRow icon={FlowArrow} label="当前阶段" value={detail?.currentNode?.name ?? ticket.status} /></div></GraphCard>
  if (kind === 'relations') return <GraphCard wide title="关联问题" icon={LinkSimple} meta={`${detail?.relations.length ?? 0} 个`} tone="blue" source="问题库" selected={selected}>{detail?.relations.length ? <div className="space-y-2.5">{detail.relations.slice(0, 3).map((relation, index) => <RelatedRow key={`${relation.objectType}-${relation.externalId}`} relation={relation} severity={index === 0 ? '严重' : '一般'} />)}</div> : <EmptyCardCopy>当前工单没有外部关联对象。</EmptyCardCopy>}</GraphCard>
  return <GraphCard title="下一步行动" icon={ListChecks} meta="2 项" tone="mint" source="项目任务" selected={selected}><div className="space-y-3"><ActionRow index={1} title={detail?.currentNode?.name ?? '确认问题范围与复现条件'} owner={detail?.currentNode?.handler ?? ticket.currentHandler ?? '待分配'} /><ActionRow index={2} title={nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)} owner="完成后流转" /></div></GraphCard>
}

function GraphCard({ title, icon: Icon, meta, tone, source, children, selected, wide }: { title: string; icon: typeof Stack; meta: string; tone: 'blue' | 'violet' | 'mint'; source?: string; children: React.ReactNode; selected: boolean; wide?: boolean }) {
  const toneClass = { blue: 'text-[#3878ec]', violet: 'text-[#7658f5]', mint: 'text-[#10a88b]' }[tone]
  const toneSurface = { blue: 'bg-[color-mix(in_srgb,#3878ec_10%,var(--panel))]', violet: 'bg-[color-mix(in_srgb,#7658f5_10%,var(--panel))]', mint: 'bg-[color-mix(in_srgb,#10a88b_10%,var(--panel))]' }[tone]
  return <section className={cn('relative flex h-[184px] w-[252px] flex-col overflow-hidden rounded-[13px] border bg-panel shadow-[0_16px_38px_-28px_rgba(23,43,77,0.65)] transition-[border-color,box-shadow,transform] duration-150', wide && 'w-[282px]', selected ? 'border-[var(--accent)] shadow-[0_18px_42px_-24px_rgba(48,83,163,0.55)]' : 'border-[var(--line-strong)]')}><header className="flex h-[48px] shrink-0 items-center gap-2.5 border-b border-[var(--line)] px-3.5"><span className={cn('flex size-7 shrink-0 items-center justify-center rounded-[7px]', toneSurface)}><Icon className={cn('size-[15px]', toneClass)} weight="bold" /></span><div className="min-w-0"><h2 className="truncate text-[10.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2><p className="mt-0.5 text-[7.5px] text-[var(--muted)]">数据关系节点</p></div><span className="ml-auto rounded-[5px] bg-[var(--surface-subtle)] px-1.5 py-1 text-[7.5px] font-medium text-[var(--muted-strong)]">{meta}</span></header><div className="min-h-0 flex-1 px-3.5 py-2.5">{children}</div>{source ? <footer className="mt-auto flex h-6 shrink-0 items-center border-t border-[var(--line)] bg-[var(--surface-subtle)]/55 px-3.5 text-[7.5px] text-[var(--muted)]">来源 · {source}</footer> : null}</section>
}

function TicketNode({ ticket, detail, selected }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null; selected: boolean }) {
  const description = ticket.remark || detail?.fields.find((field) => field.label.includes('描述'))?.value?.toString() || '暂无补充描述，可结合周边关系节点继续处理。'
  return <article className={cn('relative h-[196px] w-[274px] overflow-hidden rounded-[15px] border bg-panel shadow-[0_22px_54px_-27px_rgba(48,83,163,0.72)] transition-[border-color,box-shadow,transform]', selected ? 'border-[var(--accent)] shadow-[0_24px_58px_-24px_rgba(48,83,163,0.78)]' : 'border-[var(--accent-soft-line)]')}><div className="h-1 bg-[var(--accent)]" /><div className="p-4"><div className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full shadow-[0_0_0_3px_var(--panel)]', severityTone(ticket.severity))} /><SeverityBadge value={ticket.severity} /><span className="rounded-[5px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[7.5px] font-medium text-[var(--accent-ink)]">{ticket.status}</span><span className="ml-auto text-[8px] font-semibold tracking-[0.02em] text-[var(--muted)]">{ticket.id}</span></div><h2 className="mt-3 line-clamp-2 text-[12.5px] font-semibold leading-[18px] tracking-[-0.015em] text-[var(--ink)]">{ticket.title}</h2><p className="mt-2 line-clamp-2 text-[9px] leading-[15px] text-[var(--muted-strong)]">{description}</p><div className="absolute inset-x-4 bottom-3 flex items-center gap-2 border-t border-[var(--line)] pt-2 text-[7.5px] text-[var(--muted)]"><span className="truncate">创建于 {ticket.createdAt ?? '—'}</span><span>·</span><span className="truncate">{ticket.creator ?? '未知'}</span></div></div></article>
}

function FlowGraphCard({ nodes, currentNode, status, selected }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; status: string; selected: boolean }) {
  const visible = nodes.length ? nodes.slice(0, 4) : [{ id: 'current', name: status, status: 'active', handler: null, handledAt: null }]
  const activeIndex = Math.max(0, visible.findIndex((node) => node.id === currentNode?.id))
  return <GraphCard title="流程阻塞" icon={FlowArrow} meta={`${visible.length} 个阶段`} tone="blue" source="项目计划" selected={selected}><ol>{visible.map((node, index) => { const active = index === activeIndex; const done = index < activeIndex; return <li key={node.id} className="relative flex min-h-[22px] gap-2.5"><span className={cn('relative z-10 mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border bg-panel', active ? 'border-[var(--accent)] text-[var(--accent-ink)]' : done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-2.5" weight="bold" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} />}</span>{index < visible.length - 1 ? <span className="absolute left-[6px] top-3.5 h-[calc(100%-1px)] w-px bg-[var(--line-strong)]" /> : null}<div className="flex min-w-0 flex-1 items-start gap-1.5"><span className={cn('truncate text-[9px]', active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</span>{active ? <span className="ml-auto rounded-[4px] bg-[var(--accent-soft)] px-1 py-0.5 text-[7.5px] font-semibold text-[var(--accent-ink)]">进行中</span> : null}</div></li> })}</ol></GraphCard>
}

function GraphHandles() { return <><Handle id="target-top" type="target" position={Position.Top} /><Handle id="target-right" type="target" position={Position.Right} /><Handle id="target-bottom" type="target" position={Position.Bottom} /><Handle id="target-left" type="target" position={Position.Left} /><Handle id="source-top" type="source" position={Position.Top} /><Handle id="source-right" type="source" position={Position.Right} /><Handle id="source-bottom" type="source" position={Position.Bottom} /><Handle id="source-left" type="source" position={Position.Left} /></> }
function graphEdge(id: string, source: string, target: string, sourceHandle: string, targetHandle: string): Edge { return { id, source, target, sourceHandle, targetHandle, type: 'smoothstep', animated: false, markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: 'var(--accent)' }, style: { stroke: 'var(--accent)', strokeWidth: 1.35, opacity: 0.62 } } }
function GraphRow({ label, value, hollow }: { label: string; value: string; hollow?: boolean }) { return <div className="flex items-center gap-2 text-[9px]"><span className={cn('size-2 shrink-0 rounded-full', hollow ? 'border-2 border-[#8292b2]' : 'bg-[#8292b2]')} /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="shrink-0 text-[var(--muted)]">{value}</span></div> }
function EvidenceRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-2 text-[8.8px]"><FileText className="size-3.5 shrink-0 text-[var(--muted-strong)]" /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="max-w-[80px] truncate text-[var(--muted)]">{value}</span></div> }
function MetaRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) { return <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2 text-[8.8px]"><span className="flex items-center gap-1.5 text-[var(--muted)]"><Icon className="size-3.5" />{label}</span><span className="truncate text-right font-medium text-[var(--ink-soft)]" title={value}>{value}</span></div> }
function RelatedRow({ relation, severity }: { relation: DtsTicketDetail['relations'][number]; severity: string }) { return <a href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="grid grid-cols-[8px_minmax(0,1fr)_42px] items-center gap-2 rounded-[5px] text-[8.7px] text-[var(--ink-soft)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className={cn('size-2 rounded-full', severity === '严重' ? 'bg-[#ef4565]' : 'bg-[#f29d38]')} /><span className="truncate">{relation.externalId}</span><span className="rounded-[4px] bg-[var(--surface-subtle)] px-1 py-0.5 text-center text-[7.5px] text-[var(--muted)]">{severity}</span></a> }
function ActionRow({ index, title, owner }: { index: number; title: string; owner: string }) { return <div className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[8.5px] font-semibold text-[var(--accent-ink)]">{index}</span><div className="min-w-0"><p className="line-clamp-2 text-[9px] font-semibold leading-4 text-[var(--ink)]">{title}</p><p className="mt-0.5 truncate text-[8px] text-[var(--muted)]">{owner}</p></div></div> }
function EmptyCardCopy({ children }: { children: React.ReactNode }) { return <p className="text-[9px] leading-4 text-[var(--muted)]">{children}</p> }
function SeverityBadge({ value }: { value: DtsSeverity | null }) { return <span className={cn('rounded-[5px] px-2 py-0.5 text-[8.5px] font-medium', severityBadgeTone(value))}>{value ?? '一般'}</span> }
function severityTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[#d92d20]' : value === '严重' ? 'bg-[#ef4565]' : value === '一般' ? 'bg-[#e6982d]' : 'bg-[#6681f5]' }
function severityBadgeTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[color-mix(in_srgb,var(--err-ink)_16%,transparent)] text-[var(--err-ink)]' : value === '严重' ? 'bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] text-[var(--err-ink)]' : value === '一般' ? 'bg-[var(--warn-soft)] text-[var(--warn-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
function nextNodeTitle(nodes: DtsFlowNodeSummary[], current: DtsFlowNodeSummary | null): string { if (!nodes.length || !current) return '补充处理结论并推进流程'; const index = nodes.findIndex((node) => node.id === current.id); return nodes[index + 1]?.name ?? '完成当前节点并关闭工单' }
