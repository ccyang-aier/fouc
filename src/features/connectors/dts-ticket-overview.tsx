import {
  ArrowSquareOut, CalendarBlank, CheckCircle, Clock, FileText, FlowArrow, LinkSimple,
  ListChecks, SpinnerGap, Stack, User, UsersThree, WarningCircle,
} from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = { detail: DtsTicketDetail | null; summary: DtsTicketSummary | null; loading: boolean }

export function DtsTicketOverview({ detail, summary, loading }: Props) {
  const ticket = detail ?? summary
  if (!ticket) return <EmptyOverview />

  return (
    <main aria-label="工单关系概览" className="flex min-h-0 min-w-[410px] flex-1 flex-col overflow-hidden">
      <header className="flex min-h-[64px] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-panel px-5">
        <span className={cn('size-2.5 shrink-0 rounded-full', severityTone(ticket.severity))} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="shrink-0 text-[10px] font-semibold text-[var(--muted-strong)]">{ticket.id}</span><SeverityBadge value={ticket.severity} /><span className="rounded-[5px] bg-[var(--accent-soft)] px-2 py-0.5 text-[8.5px] font-semibold text-[var(--accent-ink)]">{ticket.status}</span></div>
          <h1 className="mt-1 truncate text-[14px] font-semibold tracking-[-0.015em] text-[var(--ink)]">{ticket.title}</h1>
        </div>
        {ticket.source.url ? <a href={ticket.source.url} target="_blank" rel="noreferrer" className="flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[9.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">在 DTS 中打开<ArrowSquareOut className="size-3.5" /></a> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 max-[1180px]:p-4">
        {loading ? <div className="flex h-full items-center justify-center gap-2 text-[10px] text-[var(--muted)]"><SpinnerGap className="size-4 animate-spin" />正在构建工单概览…</div> : (
          <div className="mx-auto grid w-full max-w-[900px] grid-cols-2 gap-3 max-[1180px]:grid-cols-1">
            <IssueCard ticket={ticket} detail={detail} />
            <InfoCard title="影响范围" icon={Stack} meta={`${ticket.productPath.length || 1} 个层级`} tone="violet">
              <div className="space-y-2.5">
                {(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类产品']).map((item, index) => <DataLine key={`${item}-${index}`} label={index === 0 ? '所属产品' : `范围 ${index + 1}`} value={item} />)}
                {ticket.productType && ticket.productPath[0] !== ticket.productType ? <DataLine label="问题类型" value={ticket.productType} /> : null}
              </div>
            </InfoCard>
            <FlowCard nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} status={ticket.status} />
            <InfoCard title="关键信息" icon={FileText} meta={`${detail?.fields.length ?? 0} 项`} tone="mint">
              <div className="space-y-2.5">
                {detail?.fields.length ? detail.fields.slice(0, 4).map((field) => <DataLine key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />) : <p className="text-[9.5px] leading-4 text-[var(--muted)]">详情字段将在 DTS 返回数据后显示。</p>}
              </div>
            </InfoCard>
            <InfoCard title="责任人与时间" icon={User} meta={`${detail?.handlers.length || (ticket.currentHandler ? 1 : 0)} 人`} tone="blue">
              <div className="space-y-2.5"><DataLine icon={User} label="当前处理人" value={ticket.currentHandler ?? '待分配'} /><DataLine icon={UsersThree} label="创建人" value={ticket.creator ?? '—'} /><DataLine icon={CalendarBlank} label="创建时间" value={ticket.createdAt ?? '—'} /></div>
            </InfoCard>
            <InfoCard title="关联信息" icon={LinkSimple} meta={`${detail?.relations.length ?? 0} 项`} tone="blue">
              {detail?.relations.length ? <div className="space-y-2">{detail.relations.slice(0, 4).map((relation) => <a key={`${relation.objectType}-${relation.externalId}`} href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-2 rounded-[6px] px-1 py-1 text-[9.5px] text-[var(--ink-soft)] hover:bg-[var(--surface-hover)]"><LinkSimple className="size-3.5 text-[var(--accent-ink)]" /><span className="min-w-0 flex-1 truncate">{relation.objectType} · {relation.externalId}</span><ArrowSquareOut className="size-3 text-[var(--muted)]" /></a>)}</div> : <p className="text-[9.5px] leading-4 text-[var(--muted)]">当前工单没有外部关联对象。</p>}
            </InfoCard>
            <InfoCard title="下一步行动" icon={ListChecks} meta={detail?.currentNode ? '当前节点' : '待确认'} tone="mint" wide>
              <div className="grid grid-cols-2 gap-3 max-[1180px]:grid-cols-1"><ActionItem index={1} title={detail?.currentNode?.name ?? '确认问题范围与复现条件'} owner={detail?.currentNode?.handler ?? ticket.currentHandler ?? '待分配'} /><ActionItem index={2} title={nextNodeTitle(detail?.flowNodes ?? [], detail?.currentNode ?? null)} owner="完成后流转下一节点" /></div>
            </InfoCard>
          </div>
        )}
      </div>
    </main>
  )
}

function IssueCard({ ticket, detail }: { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }) {
  return <article className="col-span-2 rounded-[12px] border border-[var(--accent-soft-line)] bg-panel p-4 shadow-[0_8px_26px_-20px_rgba(39,73,150,0.4)] max-[1180px]:col-span-1"><div className="flex items-center gap-2"><WarningCircle className="size-4 text-[var(--err-ink)]" weight="fill" /><span className="text-[9px] font-semibold text-[var(--err-ink)]">{ticket.severity ?? '一般'}</span><span className="ml-auto text-[8.5px] font-medium text-[var(--muted)]">{ticket.id}</span></div><h2 className="mt-2 text-[15px] font-semibold leading-6 text-[var(--ink)]">{ticket.title}</h2><p className="mt-1.5 line-clamp-3 text-[10px] leading-[17px] text-[var(--muted-strong)]">{ticket.remark || detail?.fields.find((field) => field.label.includes('描述'))?.value?.toString() || '暂无补充描述，可结合影响范围与流程进展继续处理。'}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-[8.5px] text-[var(--muted)]"><span>创建于 {ticket.createdAt ?? '—'}</span><span>·</span><span>{ticket.creator ?? '未知创建人'}</span><span>·</span><span>{detail?.permissions.length ?? 0} 项权限</span></div></article>
}

function InfoCard({ title, icon: Icon, meta, tone, wide, children }: { title: string; icon: typeof Stack; meta: string; tone: 'blue' | 'violet' | 'mint'; wide?: boolean; children: React.ReactNode }) {
  const toneClass = { blue: 'text-[#3878ec]', violet: 'text-[#7658f5]', mint: 'text-[#10a88b]' }[tone]
  return <section className={cn('rounded-[12px] border border-[var(--line)] bg-panel p-4 shadow-[0_9px_28px_-25px_rgba(32,46,75,0.42)]', wide && 'col-span-2 max-[1180px]:col-span-1')}><header className="mb-3 flex items-center gap-2 border-b border-[var(--line)] pb-3"><Icon className={cn('size-4', toneClass)} weight="bold" /><h2 className="text-[11px] font-semibold text-[var(--ink)]">{title}</h2><span className="ml-auto text-[8.5px] text-[var(--muted)]">{meta}</span></header>{children}</section>
}

function FlowCard({ nodes, currentNode, status }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; status: string }) {
  const visible = nodes.length ? nodes.slice(0, 5) : [{ id: 'current', name: status, status: 'active', handler: null, handledAt: null }]
  return <InfoCard title="流程进展" icon={FlowArrow} meta={`${visible.length} 个节点`} tone="blue"><ol className="space-y-0">{visible.map((node, index) => { const active = node.id === currentNode?.id || (!currentNode && index === visible.length - 1); const done = !active && index < Math.max(visible.findIndex((item) => item.id === currentNode?.id), visible.length - 1); return <li key={node.id} className="relative flex min-h-9 gap-3"><span className={cn('relative z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-panel', active ? 'border-[var(--accent)] text-[var(--accent-ink)]' : done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <CheckCircle className="size-3" weight="fill" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} />}</span>{index < visible.length - 1 ? <span className="absolute left-[7px] top-4 h-[calc(100%-2px)] w-px bg-[var(--line)]" /> : null}<div className="min-w-0 flex-1 pb-2"><div className="flex items-center gap-2"><span className={cn('truncate text-[9.5px]', active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</span>{active ? <span className="rounded-[4px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[8px] font-semibold text-[var(--accent-ink)]">进行中</span> : null}</div>{node.handler || node.handledAt ? <p className="mt-0.5 truncate text-[8px] text-[var(--muted)]">{node.handler ?? '—'} {node.handledAt ?? ''}</p> : null}</div></li> })}</ol></InfoCard>
}

function DataLine({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof User }) {
  return <div className="grid grid-cols-[86px_minmax(0,1fr)] items-start gap-2 text-[9.5px]"><span className="flex items-center gap-1.5 text-[var(--muted)]">{Icon ? <Icon className="size-3" /> : <span className="size-1.5 rounded-full bg-[var(--line-strong)]" />}{label}</span><span className="truncate text-right font-medium text-[var(--ink-soft)]" title={value}>{value}</span></div>
}

function ActionItem({ index, title, owner }: { index: number; title: string; owner: string }) {
  return <div className="flex gap-3 rounded-[8px] bg-[var(--surface-subtle)] p-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[9px] font-semibold text-[var(--accent-ink)]">{index}</span><div className="min-w-0"><p className="truncate text-[9.5px] font-semibold text-[var(--ink)]">{title}</p><p className="mt-1 flex items-center gap-1 text-[8.5px] text-[var(--muted)]"><Clock className="size-3" />{owner}</p></div></div>
}

function EmptyOverview() {
  return <main className="flex min-h-0 min-w-[410px] flex-1 items-center justify-center bg-[var(--surface-subtle)]/45"><div className="text-center"><FlowArrow className="mx-auto size-8 text-[var(--line-strong)]" /><p className="mt-3 text-[11px] font-medium text-[var(--ink-soft)]">选择一条工单查看关系概览</p><p className="mt-1 text-[9.5px] text-[var(--muted)]">影响范围、流程进展和下一步行动会集中展示在这里</p></div></main>
}

function SeverityBadge({ value }: { value: string | null }) {
  return <span className="rounded-[5px] bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] px-2 py-0.5 text-[8.5px] font-semibold text-[var(--err-ink)]">{value ?? '一般'}</span>
}

function severityTone(value: string | null): string { return value?.includes('严重') || value === '1' ? 'bg-[#ef4565]' : value?.includes('高') || value === '2' ? 'bg-[#f29d38]' : 'bg-[#8b9ab8]' }

function nextNodeTitle(nodes: DtsFlowNodeSummary[], current: DtsFlowNodeSummary | null): string {
  if (!nodes.length || !current) return '补充处理结论并推进流程'
  const index = nodes.findIndex((node) => node.id === current.id)
  return nodes[index + 1]?.name ?? '完成当前节点并关闭工单'
}
