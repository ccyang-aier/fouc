import { useEffect, useRef, useState } from 'react'
import { CalendarBlank, Check, CornersOut, FileText, FlowArrow, Hand, LinkSimple, ListChecks, Minus, Plus, ShareNetwork, Stack, User, UsersThree } from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsSeverity, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Offset = { x: number; y: number }
const STAGE_WIDTH = 760
const STAGE_HEIGHT = 650
const MIN_ZOOM = 0.48
const MAX_ZOOM = 1.18

export function DtsRelationshipGraph({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const [zoom, setZoom] = useState(0.8)
  const [panMode, setPanMode] = useState(false)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null)

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

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!panMode) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({ x: drag.origin.x + event.clientX - drag.startX, y: drag.origin.y + event.clientY - drag.startY })
  }

  return <div ref={canvasRef} aria-label="DTS 工单关系图谱" className="relative min-h-0 flex-1 overflow-hidden bg-[var(--surface-subtle)]/65">
    <GraphSummary />
    <CanvasControls zoom={zoom} panMode={panMode} onZoomOut={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.08))} onZoomIn={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.08))} onFit={fitCanvas} onTogglePan={() => setPanMode((value) => !value)} />
    <div className={cn('absolute inset-0 pt-12', panMode && 'cursor-grab active:cursor-grabbing')} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
      <div className="absolute left-1/2 top-[calc(50%+16px)] origin-center transition-transform duration-150" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
        <GraphConnectors />
        <GraphCard className="left-0 top-7 h-[180px] w-[230px]" title="影响范围" icon={Stack} meta={`${ticket.productPath.length || 1} 个服务`} tone="violet" source="服务拓扑"><div className="space-y-2.5">{(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).slice(0, 3).map((item, index) => <GraphRow key={`${item}-${index}`} label={item} value={index === 0 ? '核心服务' : `${index + 1} 个版本`} />)}{ticket.productType && ticket.productPath[0] !== ticket.productType ? <GraphRow label={ticket.productType} value="可能受影响" hollow /> : null}</div></GraphCard>
        <FlowGraphCard className="right-0 top-7 h-[180px] w-[230px]" nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} status={ticket.status} />
        <GraphCard className="left-0 top-[240px] h-[188px] w-[230px]" title="关键证据" icon={FileText} meta={`${detail?.fields.length ?? 0} 条`} tone="mint" source="工单系统"><div className="space-y-2">{detail?.fields.length ? detail.fields.slice(0, 4).map((field) => <EvidenceRow key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />) : <EmptyCardCopy>详情字段将在 DTS 返回数据后显示。</EmptyCardCopy>}</div></GraphCard>
        <CenterTicketCard ticket={ticket} detail={detail} />
        <GraphCard className="right-0 top-[240px] h-[188px] w-[230px]" title="责任人与时间" icon={User} meta={`${detail?.handlers.length || (ticket.currentHandler ? 1 : 0)} 人`} tone="blue"><div className="space-y-3"><MetaRow icon={User} label="负责人" value={ticket.currentHandler ?? '待分配'} /><MetaRow icon={UsersThree} label="创建人" value={ticket.creator ?? '—'} /><MetaRow icon={CalendarBlank} label="创建时间" value={ticket.createdAt ?? '—'} /><MetaRow icon={FlowArrow} label="当前阶段" value={detail?.currentNode?.name ?? ticket.status} /></div></GraphCard>
        <GraphCard className="bottom-4 left-[95px] h-[174px] w-[260px]" title="关联问题" icon={LinkSimple} meta={`${detail?.relations.length ?? 0} 个`} tone="blue" source="问题库">{detail?.relations.length ? <div className="space-y-2.5">{detail.relations.slice(0, 3).map((relation, index) => <RelatedRow key={`${relation.objectType}-${relation.externalId}`} relation={relation} severity={index === 0 ? '严重' : '一般'} />)}</div> : <EmptyCardCopy>当前工单没有外部关联对象。</EmptyCardCopy>}</GraphCard>
        <GraphCard className="bottom-4 right-0 h-[174px] w-[230px]" title="下一步行动" icon={ListChecks} meta="2 项" tone="mint" source="项目任务"><div className="space-y-3"><ActionRow index={1} title={detail?.currentNode?.name ?? '确认问题范围与复现条件'} owner={detail?.currentNode?.handler ?? ticket.currentHandler ?? '待分配'} /><ActionRow index={2} title={nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)} owner="完成后流转" /></div></GraphCard>
      </div>
    </div>
  </div>
}

function GraphSummary() { return <div className="pointer-events-none absolute left-4 top-3 z-30 flex h-8 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-panel px-2.5 shadow-[0_7px_20px_-16px_rgba(31,48,82,0.5)]"><ShareNetwork className="size-3.5 text-[var(--accent-ink)]" weight="bold" /><span className="text-[8.5px] font-medium text-[var(--ink-soft)]">关系网络</span><span className="h-3 w-px bg-[var(--line)]" /><span className="text-[8px] text-[var(--muted)]">7 个节点 · 6 条关系</span></div> }

function CanvasControls({ zoom, panMode, onZoomOut, onZoomIn, onFit, onTogglePan }: { zoom: number; panMode: boolean; onZoomOut: () => void; onZoomIn: () => void; onFit: () => void; onTogglePan: () => void }) {
  return <div className="absolute right-4 top-3 z-30 flex h-8 items-stretch gap-2"><div className="flex overflow-hidden rounded-[8px] border border-[var(--line)] bg-panel shadow-[0_7px_20px_-16px_rgba(31,48,82,0.5)]"><ControlButton label="缩小" onClick={onZoomOut}><Minus className="size-3.5" /></ControlButton><span className="flex w-11 items-center justify-center border-x border-[var(--line)] text-[8.5px] font-semibold tabular-nums text-[var(--ink-soft)]">{Math.round(zoom * 100)}%</span><ControlButton label="放大" onClick={onZoomIn}><Plus className="size-3.5" /></ControlButton></div><button type="button" onClick={onFit} className="flex items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-panel px-2.5 text-[8.5px] font-medium text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><CornersOut className="size-3.5" />适应</button><button type="button" aria-pressed={panMode} onClick={onTogglePan} className={cn('flex items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-panel px-2.5 text-[8.5px] font-medium text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', panMode && 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]')}><Hand className="size-3.5" weight={panMode ? 'fill' : 'regular'} />拖动画布</button></div>
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} onClick={onClick} className="flex w-8 items-center justify-center text-[var(--muted-strong)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">{children}</button> }
function calculateFitZoom(width: number, height: number): number { return Math.min(0.94, Math.max(MIN_ZOOM, (width - 30) / STAGE_WIDTH), Math.max(MIN_ZOOM, (height - 76) / STAGE_HEIGHT)) }

function GraphConnectors() {
  return <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 760 650" fill="none"><g stroke="var(--accent)" strokeOpacity="0.48" strokeWidth="1.5"><path d="M255 270 H242 Q230 270 230 258 V116" /><path d="M505 270 H518 Q530 270 530 258 V116" /><path d="M255 322 H230" /><path d="M505 322 H530" /><path d="M320 410 V452 Q320 462 310 462 H225 V476" /><path d="M440 410 V452 Q440 462 450 462 H645 V476" /></g><g fill="var(--panel)" stroke="var(--accent)" strokeWidth="1.5"><circle cx="255" cy="270" r="3" /><circle cx="230" cy="116" r="3" /><circle cx="505" cy="270" r="3" /><circle cx="530" cy="116" r="3" /><circle cx="255" cy="322" r="3" /><circle cx="230" cy="322" r="3" /><circle cx="505" cy="322" r="3" /><circle cx="530" cy="322" r="3" /><circle cx="320" cy="410" r="3" /><circle cx="225" cy="476" r="3" /><circle cx="440" cy="410" r="3" /><circle cx="645" cy="476" r="3" /></g></svg>
}

function GraphCard({ className, title, icon: Icon, meta, tone, source, children }: { className: string; title: string; icon: typeof Stack; meta: string; tone: 'blue' | 'violet' | 'mint'; source?: string; children: React.ReactNode }) {
  const toneClass = { blue: 'text-[#3878ec] bg-[var(--accent-soft)]', violet: 'text-[#7658f5] bg-[color-mix(in_srgb,#7658f5_9%,var(--panel))]', mint: 'text-[#10a88b] bg-[color-mix(in_srgb,#10a88b_9%,var(--panel))]' }[tone]
  return <section className={cn('absolute z-10 flex flex-col overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-panel shadow-[0_14px_34px_-26px_rgba(34,50,82,0.58)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--accent-soft-line)] hover:shadow-[0_18px_38px_-24px_rgba(48,83,163,0.35)]', className)}><header className="flex h-[44px] shrink-0 items-center gap-2.5 border-b border-[var(--line)] px-3.5"><span className={cn('flex size-6 items-center justify-center rounded-[6px]', toneClass)}><Icon className="size-3.5" weight="bold" /></span><h2 className="text-[10.5px] font-semibold text-[var(--ink)]">{title}</h2><span className="ml-auto rounded-[5px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[7.5px] font-medium text-[var(--muted)]">{meta}</span></header><div className="min-h-0 flex-1 px-3.5 py-3">{children}</div>{source ? <footer className="mt-auto flex h-6 shrink-0 items-center border-t border-[var(--line)] bg-[var(--surface-subtle)]/45 px-3.5 text-[7.5px] text-[var(--muted)]">来源 · {source}</footer> : null}</section>
}

function CenterTicketCard({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const description = ticket.remark || detail?.fields.find((field) => field.label.includes('描述'))?.value?.toString() || '暂无补充描述，可结合周边关系节点继续处理。'
  return <article className="absolute left-[255px] top-[216px] z-20 h-[194px] w-[250px] overflow-hidden rounded-[14px] border border-[var(--accent)] bg-panel shadow-[0_22px_50px_-25px_rgba(48,83,163,0.62)]"><div className="h-1 bg-[var(--accent)]" /><div className="p-4"><div className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', severityTone(ticket.severity))} /><SeverityBadge value={ticket.severity} /><span className="rounded-[5px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[7.5px] text-[var(--accent-ink)]">{ticket.status}</span><span className="ml-auto text-[8px] font-semibold text-[var(--muted)]">{ticket.id}</span></div><h2 className="mt-3 line-clamp-2 text-[13px] font-semibold leading-[19px] tracking-[-0.015em] text-[var(--ink)]">{ticket.title}</h2><p className="mt-2 line-clamp-2 text-[9px] leading-[15px] text-[var(--muted-strong)]">{description}</p><div className="absolute inset-x-4 bottom-3 flex items-center gap-2 border-t border-[var(--line)] pt-2 text-[7.5px] text-[var(--muted)]"><span className="truncate">创建于 {ticket.createdAt ?? '—'}</span><span>·</span><span className="truncate">{ticket.creator ?? '未知'}</span></div></div></article>
}

function FlowGraphCard({ className, nodes, currentNode, status }: { className: string; nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; status: string }) {
  const visible = nodes.length ? nodes.slice(0, 4) : [{ id: 'current', name: status, status: 'active', handler: null, handledAt: null }]
  const activeIndex = Math.max(0, visible.findIndex((node) => node.id === currentNode?.id))
  return <GraphCard className={className} title="流程阻塞" icon={FlowArrow} meta={`${visible.length} 个阶段`} tone="blue" source="项目计划"><ol>{visible.map((node, index) => { const active = index === activeIndex; const done = index < activeIndex; return <li key={node.id} className="relative flex min-h-[23px] gap-2.5"><span className={cn('relative z-10 mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border bg-panel', active ? 'border-[var(--accent)] text-[var(--accent-ink)]' : done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-2.5" weight="bold" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} />}</span>{index < visible.length - 1 ? <span className="absolute left-[6px] top-3.5 h-[calc(100%-1px)] w-px bg-[var(--line-strong)]" /> : null}<div className="flex min-w-0 flex-1 items-start gap-1.5"><span className={cn('truncate text-[9px]', active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</span>{active ? <span className="ml-auto rounded-[4px] bg-[var(--accent-soft)] px-1 py-0.5 text-[7.5px] font-semibold text-[var(--accent-ink)]">进行中</span> : null}</div></li> })}</ol></GraphCard>
}

function GraphRow({ label, value, hollow }: { label: string; value: string; hollow?: boolean }) { return <div className="flex items-center gap-2 text-[9px]"><span className={cn('size-2 shrink-0 rounded-full', hollow ? 'border-2 border-[#8292b2]' : 'bg-[#8292b2]')} /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="shrink-0 text-[var(--muted)]">{value}</span></div> }
function EvidenceRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-2 text-[8.8px]"><FileText className="size-3.5 shrink-0 text-[var(--muted-strong)]" /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="max-w-[92px] truncate text-[var(--muted)]">{value}</span></div> }
function MetaRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) { return <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2 text-[8.8px]"><span className="flex items-center gap-1.5 text-[var(--muted)]"><Icon className="size-3.5" />{label}</span><span className="truncate text-right font-medium text-[var(--ink-soft)]" title={value}>{value}</span></div> }
function RelatedRow({ relation, severity }: { relation: DtsTicketDetail['relations'][number]; severity: string }) { return <a href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="grid grid-cols-[8px_minmax(0,1fr)_42px] items-center gap-2 rounded-[5px] text-[8.7px] text-[var(--ink-soft)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className={cn('size-2 rounded-full', severity === '严重' ? 'bg-[#ef4565]' : 'bg-[#f29d38]')} /><span className="truncate">{relation.externalId}</span><span className="rounded-[4px] bg-[var(--surface-subtle)] px-1 py-0.5 text-center text-[7.5px] text-[var(--muted)]">{severity}</span></a> }
function ActionRow({ index, title, owner }: { index: number; title: string; owner: string }) { return <div className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[8.5px] font-semibold text-[var(--accent-ink)]">{index}</span><div className="min-w-0"><p className="line-clamp-2 text-[9px] font-semibold leading-4 text-[var(--ink)]">{title}</p><p className="mt-0.5 truncate text-[8px] text-[var(--muted)]">{owner}</p></div></div> }
function EmptyCardCopy({ children }: { children: React.ReactNode }) { return <p className="text-[9px] leading-4 text-[var(--muted)]">{children}</p> }
function SeverityBadge({ value }: { value: DtsSeverity | null }) { return <span className={cn('rounded-[5px] px-2 py-0.5 text-[8.5px] font-medium', severityBadgeTone(value))}>{value ?? '一般'}</span> }
function severityTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[#d92d20]' : value === '严重' ? 'bg-[#ef4565]' : value === '一般' ? 'bg-[#e6982d]' : 'bg-[#6681f5]' }
function severityBadgeTone(value: DtsSeverity | null): string { return value === '致命' ? 'bg-[color-mix(in_srgb,var(--err-ink)_16%,transparent)] text-[var(--err-ink)]' : value === '严重' ? 'bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] text-[var(--err-ink)]' : value === '一般' ? 'bg-[var(--warn-soft)] text-[var(--warn-ink)]' : 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
function nextNodeTitle(nodes: DtsFlowNodeSummary[], current: DtsFlowNodeSummary | null): string { if (!nodes.length || !current) return '补充处理结论并推进流程'; const index = nodes.findIndex((node) => node.id === current.id); return nodes[index + 1]?.name ?? '完成当前节点并关闭工单' }
