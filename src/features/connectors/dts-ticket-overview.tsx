import { useEffect, useRef, useState } from 'react'
import {
  ArrowSquareOut, CalendarBlank, Check, CornersOut, FileText, FlowArrow, Hand,
  LinkSimple, ListChecks, Minus, Plus, ShareNetwork, SpinnerGap, Stack, User, UsersThree,
} from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'
import { DtsTicketDetailView } from './dts-ticket-detail-view'

type Props = { detail: DtsTicketDetail | null; summary: DtsTicketSummary | null; loading: boolean }
type Offset = { x: number; y: number }

const MIN_ZOOM = 0.48
const MAX_ZOOM = 1.12
const ZOOM_STEP = 0.08

export function DtsTicketOverview({ detail, summary, loading }: Props) {
  const [view, setView] = useState<'graph' | 'detail'>('graph')
  const ticket = detail ?? summary
  if (!ticket) return <EmptyOverview />

  return (
    <main aria-label="工单工作区" className="flex min-h-0 min-w-[410px] flex-1 flex-col overflow-hidden bg-[var(--surface-subtle)]/35">
      <TicketHeader ticket={ticket} view={view} onViewChange={setView} />
      {loading ? <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-[10px] text-[var(--muted)]"><SpinnerGap className="size-4 animate-spin" />正在读取问题单…</div> : view === 'graph' ? <RelationshipCanvas ticket={ticket} detail={detail} /> : <DtsTicketDetailView ticket={ticket} detail={detail} />}
    </main>
  )
}

function TicketHeader({ ticket, view, onViewChange }: { ticket: DtsTicketSummary; view: 'graph' | 'detail'; onViewChange: (view: 'graph' | 'detail') => void }) {
  return (
    <header className="flex min-h-[64px] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-panel px-5">
      <span className={cn('size-2.5 shrink-0 rounded-full', severityTone(ticket.severity))} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="shrink-0 text-[10px] font-medium text-[var(--muted-strong)]">{ticket.id}</span><SeverityBadge value={ticket.severity} /><span className="rounded-[5px] bg-[var(--accent-soft)] px-2 py-0.5 text-[8.5px] text-[var(--accent-ink)]">{ticket.status}</span></div>
        <h1 className="mt-1 truncate text-[14px] font-semibold tracking-[-0.015em] text-[var(--ink)]">{ticket.title}</h1>
      </div>
      <div role="tablist" aria-label="问题单视图" className="flex h-8 shrink-0 items-center rounded-[8px] bg-[var(--surface-subtle)] p-0.5 ring-1 ring-inset ring-[var(--line)]">
        <ViewButton active={view === 'graph'} label="关系图" icon={ShareNetwork} onClick={() => onViewChange('graph')} />
        <ViewButton active={view === 'detail'} label="问题单详情" icon={FileText} onClick={() => onViewChange('detail')} />
      </div>
      {ticket.source.url ? <a href={ticket.source.url} target="_blank" rel="noreferrer" className="flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[9.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">在 DTS 中打开<ArrowSquareOut className="size-3.5" /></a> : null}
    </header>
  )
}

function ViewButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof FileText; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn('flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[8.5px] text-[var(--muted-strong)] outline-none transition-[background-color,color,box-shadow] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', active && 'bg-panel text-[var(--ink)] shadow-[0_1px_4px_rgba(24,38,66,0.12)]')}><Icon className="size-3.5" />{label}</button>
}

function RelationshipCanvas({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const [zoom, setZoom] = useState(0.72)
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

  function adjustZoom(delta: number) {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))))
  }

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

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  return (
    <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden">
      <CanvasControls zoom={zoom} panMode={panMode} onZoomOut={() => adjustZoom(-ZOOM_STEP)} onZoomIn={() => adjustZoom(ZOOM_STEP)} onFit={fitCanvas} onTogglePan={() => setPanMode((value) => !value)} />
      <div className={cn('absolute inset-0 pt-12', panMode && 'cursor-grab active:cursor-grabbing')} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <div className="absolute left-1/2 top-[calc(50%+18px)] h-[735px] w-[760px] origin-center transition-transform duration-150" style={{ transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
          <div className="relative h-full w-full">
            <GraphConnectors />
            <GraphCard className="left-0 top-4 h-[180px] w-[250px]" title="影响范围" icon={Stack} meta={`${ticket.productPath.length || 1} 个服务`} tone="violet" source="服务拓扑">
              <div className="space-y-2.5">{(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).slice(0, 3).map((item, index) => <GraphRow key={`${item}-${index}`} label={item} value={index === 0 ? '核心服务' : `${index + 1} 个版本`} />)}{ticket.productType && ticket.productPath[0] !== ticket.productType ? <GraphRow label={ticket.productType} value="可能受影响" hollow /> : null}</div>
            </GraphCard>

            <FlowGraphCard className="right-0 top-4 h-[198px] w-[250px]" nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} status={ticket.status} />

            <GraphCard className="left-0 top-[226px] h-[194px] w-[250px]" title="关键证据" icon={FileText} meta={`${detail?.fields.length ?? 0} 条`} tone="mint" source="工单系统">
              <div className="space-y-2">{detail?.fields.length ? detail.fields.slice(0, 4).map((field) => <EvidenceRow key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />) : <EmptyCardCopy>详情字段将在 DTS 返回数据后显示。</EmptyCardCopy>}</div>
            </GraphCard>

            <CenterTicketCard ticket={ticket} detail={detail} />

            <GraphCard className="right-0 top-[226px] h-[210px] w-[250px]" title="责任人与时间" icon={User} meta={`${detail?.handlers.length || (ticket.currentHandler ? 1 : 0)} 人`} tone="blue">
              <div className="space-y-3"><MetaRow icon={User} label="负责人" value={ticket.currentHandler ?? '待分配'} /><MetaRow icon={UsersThree} label="创建人" value={ticket.creator ?? '—'} /><MetaRow icon={CalendarBlank} label="创建时间" value={ticket.createdAt ?? '—'} /><MetaRow icon={FlowArrow} label="当前阶段" value={detail?.currentNode?.name ?? ticket.status} /></div>
            </GraphCard>

            <GraphCard className="bottom-4 left-[112px] h-[190px] w-[284px]" title="关联问题" icon={LinkSimple} meta={`${detail?.relations.length ?? 0} 个`} tone="blue" source="问题库">
              {detail?.relations.length ? <div className="space-y-2.5">{detail.relations.slice(0, 3).map((relation, index) => <RelatedRow key={`${relation.objectType}-${relation.externalId}`} relation={relation} severity={index === 0 ? '严重' : '一般'} />)}</div> : <EmptyCardCopy>当前工单没有外部关联对象。</EmptyCardCopy>}
            </GraphCard>

            <GraphCard className="bottom-4 right-0 h-[190px] w-[250px]" title="下一步行动" icon={ListChecks} meta="2 项" tone="mint" source="项目任务">
              <div className="space-y-3"><ActionRow index={1} title={detail?.currentNode?.name ?? '确认问题范围与复现条件'} owner={detail?.currentNode?.handler ?? ticket.currentHandler ?? '待分配'} /><ActionRow index={2} title={nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)} owner="完成后流转" /></div>
            </GraphCard>
          </div>
        </div>
      </div>
    </div>
  )
}

function CanvasControls({ zoom, panMode, onZoomOut, onZoomIn, onFit, onTogglePan }: { zoom: number; panMode: boolean; onZoomOut: () => void; onZoomIn: () => void; onFit: () => void; onTogglePan: () => void }) {
  return <div className="absolute right-4 top-3 z-30 flex h-8 items-stretch gap-2"><div className="flex overflow-hidden rounded-[7px] border border-[var(--line)] bg-panel shadow-[0_5px_18px_-14px_rgba(31,48,82,0.45)]"><ControlButton label="缩小" onClick={onZoomOut}><Minus className="size-3.5" /></ControlButton><span className="flex w-11 items-center justify-center border-x border-[var(--line)] text-[9px] font-semibold tabular-nums text-[var(--ink-soft)]">{Math.round(zoom * 100)}%</span><ControlButton label="放大" onClick={onZoomIn}><Plus className="size-3.5" /></ControlButton></div><button type="button" onClick={onFit} className="flex items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-panel px-2.5 text-[9px] font-medium text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><CornersOut className="size-3.5" />适应</button><button type="button" aria-pressed={panMode} onClick={onTogglePan} className={cn('flex items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-panel px-2.5 text-[9px] font-medium text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', panMode && 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]')}><Hand className="size-3.5" weight={panMode ? 'fill' : 'regular'} />拖动画布</button></div>
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) { return <button type="button" aria-label={label} onClick={onClick} className="flex w-8 items-center justify-center text-[var(--muted-strong)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]">{children}</button> }

function calculateFitZoom(width: number, height: number): number {
  return Math.min(0.92, Math.max(0.52, (width - 28) / 760), Math.max(0.52, (height - 68) / 735))
}

function GraphConnectors() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 760 735" fill="none">
      <g stroke="color-mix(in srgb, var(--accent) 62%, var(--line-strong))" strokeWidth="1.5">
        <path d="M340 328 C286 304 293 114 250 104" />
        <path d="M420 328 C474 304 468 114 510 104" />
        <path d="M314 350 C282 350 280 324 250 324" />
        <path d="M446 350 C478 350 480 330 510 330" />
        <path d="M355 416 C333 466 312 500 300 529" />
        <path d="M405 416 C449 462 475 498 510 548" />
      </g>
      <g fill="var(--accent)">
        <circle cx="340" cy="328" r="3" /><circle cx="250" cy="104" r="3" />
        <circle cx="420" cy="328" r="3" /><circle cx="510" cy="104" r="3" />
        <circle cx="314" cy="350" r="3" /><circle cx="250" cy="324" r="3" />
        <circle cx="446" cy="350" r="3" /><circle cx="510" cy="330" r="3" />
        <circle cx="355" cy="416" r="3" /><circle cx="300" cy="529" r="3" />
        <circle cx="405" cy="416" r="3" /><circle cx="510" cy="548" r="3" />
      </g>
    </svg>
  )
}

function GraphCard({ className, title, icon: Icon, meta, tone, source, children }: { className: string; title: string; icon: typeof Stack; meta: string; tone: 'blue' | 'violet' | 'mint'; source?: string; children: React.ReactNode }) {
  const toneClass = { blue: 'text-[#3878ec]', violet: 'text-[#7658f5]', mint: 'text-[#10a88b]' }[tone]
  return <section className={cn('absolute z-10 flex flex-col overflow-hidden rounded-[11px] border border-[var(--line-strong)] bg-panel shadow-[0_10px_28px_-23px_rgba(34,50,82,0.5)]', className)}><header className="flex h-[45px] shrink-0 items-center gap-2 border-b border-[var(--line)] px-4"><Icon className={cn('size-[17px]', toneClass)} weight="bold" /><h2 className="text-[11px] font-semibold text-[var(--ink)]">{title}</h2><span className="ml-auto text-[8.5px] text-[var(--muted)]">{meta}</span></header><div className="min-h-0 flex-1 px-4 py-3">{children}</div>{source ? <footer className="mt-auto h-7 shrink-0 border-t border-[var(--line)] px-4 pt-1.5 text-[8px] text-[var(--muted)]">来源：{source}</footer> : null}</section>
}

function CenterTicketCard({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  const description = ticket.remark || detail?.fields.find((field) => field.label.includes('描述'))?.value?.toString() || '暂无补充描述，可结合周边关系节点继续处理。'
  return <article className="absolute left-[274px] top-[270px] z-20 h-[176px] w-[212px] rounded-[12px] border border-[var(--accent-soft-line)] bg-panel p-4 shadow-[0_12px_30px_-20px_rgba(48,83,163,0.5)]"><div className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', severityTone(ticket.severity))} /><span className="rounded-[5px] bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] px-1.5 py-0.5 text-[8.5px] font-semibold text-[var(--err-ink)]">{ticket.severity ?? '一般'}</span><span className="ml-auto text-[8px] font-medium text-[var(--muted)]">{ticket.id}</span></div><h2 className="mt-2.5 line-clamp-2 text-[12px] font-semibold leading-[18px] text-[var(--ink)]">{ticket.title}</h2><p className="mt-1.5 line-clamp-2 text-[9px] leading-[15px] text-[var(--muted-strong)]">{description}</p><div className="absolute inset-x-4 bottom-3 flex items-center gap-2 border-t border-[var(--line)] pt-2 text-[7.5px] text-[var(--muted)]"><span className="truncate">创建于 {ticket.createdAt ?? '—'}</span><span>·</span><span className="truncate">{ticket.creator ?? '未知'}</span></div></article>
}

function FlowGraphCard({ className, nodes, currentNode, status }: { className: string; nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; status: string }) {
  const visible = nodes.length ? nodes.slice(0, 4) : [{ id: 'current', name: status, status: 'active', handler: null, handledAt: null }]
  const activeIndex = Math.max(0, visible.findIndex((node) => node.id === currentNode?.id))
  return <GraphCard className={className} title="流程阻塞" icon={FlowArrow} meta={`${visible.length} 个阶段`} tone="blue" source="项目计划"><ol>{visible.map((node, index) => { const active = index === activeIndex; const done = index < activeIndex; return <li key={node.id} className="relative flex min-h-[29px] gap-2.5"><span className={cn('relative z-10 mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border bg-panel', active ? 'border-[var(--accent)] text-[var(--accent-ink)]' : done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-2.5" weight="bold" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} />}</span>{index < visible.length - 1 ? <span className="absolute left-[6px] top-3.5 h-[calc(100%-1px)] w-px bg-[var(--line-strong)]" /> : null}<div className="flex min-w-0 flex-1 items-start gap-1.5"><span className={cn('truncate text-[9px]', active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</span>{active ? <span className="ml-auto rounded-[4px] bg-[var(--accent-soft)] px-1 py-0.5 text-[7.5px] font-semibold text-[var(--accent-ink)]">进行中</span> : null}</div></li> })}</ol></GraphCard>
}

function GraphRow({ label, value, hollow }: { label: string; value: string; hollow?: boolean }) { return <div className="flex items-center gap-2 text-[9px]"><span className={cn('size-2 shrink-0 rounded-full', hollow ? 'border-2 border-[#8292b2]' : 'bg-[#8292b2]')} /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="shrink-0 text-[var(--muted)]">{value}</span></div> }
function EvidenceRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-2 text-[8.8px]"><FileText className="size-3.5 shrink-0 text-[var(--muted-strong)]" /><span className="min-w-0 flex-1 truncate text-[var(--ink-soft)]">{label}</span><span className="max-w-[80px] truncate text-[var(--muted)]">{value}</span></div> }
function MetaRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) { return <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2 text-[8.8px]"><span className="flex items-center gap-1.5 text-[var(--muted)]"><Icon className="size-3.5" />{label}</span><span className="truncate text-right font-medium text-[var(--ink-soft)]" title={value}>{value}</span></div> }
function RelatedRow({ relation, severity }: { relation: DtsTicketDetail['relations'][number]; severity: string }) { return <a href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="grid grid-cols-[8px_minmax(0,1fr)_42px] items-center gap-2 rounded-[5px] text-[8.7px] text-[var(--ink-soft)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className={cn('size-2 rounded-full', severity === '严重' ? 'bg-[#ef4565]' : 'bg-[#f29d38]')} /><span className="truncate">{relation.externalId}</span><span className="rounded-[4px] bg-[var(--surface-subtle)] px-1 py-0.5 text-center text-[7.5px] text-[var(--muted)]">{severity}</span></a> }
function ActionRow({ index, title, owner }: { index: number; title: string; owner: string }) { return <div className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[8.5px] font-semibold text-[var(--accent-ink)]">{index}</span><div className="min-w-0"><p className="line-clamp-2 text-[9px] font-semibold leading-4 text-[var(--ink)]">{title}</p><p className="mt-0.5 truncate text-[8px] text-[var(--muted)]">{owner}</p></div></div> }
function EmptyCardCopy({ children }: { children: React.ReactNode }) { return <p className="text-[9px] leading-4 text-[var(--muted)]">{children}</p> }

function EmptyOverview() { return <main className="flex min-h-0 min-w-[410px] flex-1 items-center justify-center bg-[var(--surface-subtle)]/35"><div className="text-center"><FlowArrow className="mx-auto size-8 text-[var(--line-strong)]" /><p className="mt-3 text-[11px] font-medium text-[var(--ink-soft)]">选择一条工单查看关系图</p><p className="mt-1 text-[9.5px] text-[var(--muted)]">影响范围、流程、证据与行动会围绕工单展开</p></div></main> }
function SeverityBadge({ value }: { value: string | null }) { return <span className="rounded-[5px] bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] px-2 py-0.5 text-[8.5px] text-[var(--err-ink)]">{value ?? '一般'}</span> }
function severityTone(value: string | null): string { return value?.includes('严重') || value === '1' ? 'bg-[#ef4565]' : value?.includes('高') || value === '2' ? 'bg-[#f29d38]' : 'bg-[#8b9ab8]' }
function nextNodeTitle(nodes: DtsFlowNodeSummary[], current: DtsFlowNodeSummary | null): string { if (!nodes.length || !current) return '补充处理结论并推进流程'; const index = nodes.findIndex((node) => node.id === current.id); return nodes[index + 1]?.name ?? '完成当前节点并关闭工单' }
