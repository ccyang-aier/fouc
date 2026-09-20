import { CalendarBlank, Check, ClockCounterClockwise, FileText, FlowArrow, LinkSimple, ShieldCheck, Stack, User, UsersThree } from '@phosphor-icons/react'
import type { DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }

export function DtsTicketDetailView({ ticket, detail }: Props) {
  return (
    <div aria-label="问题单详情视图" className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-subtle)]/55">
      <div className="mx-auto grid w-full max-w-[900px] grid-cols-2 gap-4 p-5 max-[1100px]:grid-cols-1">
        <section className="col-span-full rounded-[12px] border border-[var(--line)] bg-panel p-5 shadow-[0_12px_32px_-28px_rgba(28,44,74,0.38)]">
          <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--muted-strong)]"><FileText className="size-4 text-[var(--accent-ink)]" />问题描述</div>
          <p className="mt-3 text-[11px] leading-5 text-[var(--ink-soft)]">{ticket.remark ?? '暂无问题描述。'}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-[8.5px] text-[var(--muted)]">
            <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1">{ticket.productType ?? '未分类'}</span>
            <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1">{detail?.flowState ?? ticket.status}</span>
            <span className="ml-auto">来源：DTS 问题单</span>
          </div>
        </section>

        <DetailCard title="基本信息" icon={User}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <DetailValue label="当前处理人" value={ticket.currentHandler ?? '待分配'} icon={User} />
            <DetailValue label="创建人" value={ticket.creator ?? '—'} icon={UsersThree} />
            <DetailValue label="创建时间" value={ticket.createdAt ?? '—'} icon={CalendarBlank} />
            <DetailValue label="当前节点" value={detail?.currentNode?.name ?? ticket.status} icon={FlowArrow} />
          </dl>
        </DetailCard>

        <DetailCard title="产品范围" icon={Stack}>
          <div className="flex flex-wrap gap-2">
            {(ticket.productPath.length ? ticket.productPath : [ticket.productType ?? '未归类']).map((item, index) => (
              <span key={`${item}-${index}`} className="flex items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[9px] text-[var(--ink-soft)]">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" />{item}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[8.5px] leading-4 text-[var(--muted)]">产品路径按 DTS 中登记的服务归属展示，用于快速判断影响边界。</p>
        </DetailCard>

        <DetailCard title="关键字段" icon={FileText} className="col-span-full">
          {detail?.fields.length ? <dl className="grid grid-cols-2 gap-x-8 gap-y-0 max-[1100px]:grid-cols-1">{detail.fields.map((field) => <div key={field.key} className="flex min-h-10 items-center gap-4 border-b border-[var(--line)] last:border-0"><dt className="w-24 shrink-0 text-[8.5px] text-[var(--muted)]">{field.label}</dt><dd className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--ink-soft)]" title={field.value == null ? '—' : String(field.value)}>{field.value == null ? '—' : String(field.value)}</dd></div>)}</dl> : <EmptyCopy>暂无扩展字段。</EmptyCopy>}
        </DetailCard>

        <DetailCard title="处理流程" icon={FlowArrow} className="col-span-full">
          {detail?.flowNodes.length ? <ol className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2">{detail.flowNodes.map((node, index) => {
            const active = node.id === detail.currentNode?.id
            const done = node.status === 'done'
            return <li key={node.id} className={cn('relative rounded-[9px] border p-3', active ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface-subtle)]')}><div className="flex items-center gap-2"><span className={cn('flex size-5 items-center justify-center rounded-full text-[8px]', done ? 'bg-[var(--ok-ink)] text-white' : active ? 'bg-[var(--accent)] text-white' : 'bg-panel text-[var(--muted)] ring-1 ring-inset ring-[var(--line)]')}>{done ? <Check className="size-3" weight="bold" /> : index + 1}</span><span className="truncate text-[9.5px] font-medium text-[var(--ink)]">{node.name}</span></div><p className="mt-2 truncate pl-7 text-[8px] text-[var(--muted)]">{node.handler ?? '待分配'}{node.handledAt ? ` · ${node.handledAt}` : ''}</p></li>
          })}</ol> : <EmptyCopy>暂无流程节点。</EmptyCopy>}
        </DetailCard>

        <DetailCard title="参与人与权限" icon={ShieldCheck}>
          <div className="space-y-3">
            <InfoLine icon={UsersThree} label="参与人" value={detail?.handlers.join('、') || ticket.currentHandler || '—'} />
            <InfoLine icon={ShieldCheck} label="权限" value={detail?.permissions.join('、') || '只读'} />
          </div>
        </DetailCard>

        <DetailCard title="关联对象" icon={LinkSimple}>
          {detail?.relations.length ? <div className="space-y-2">{detail.relations.map((relation) => <a key={`${relation.objectType}-${relation.externalId}`} href={relation.url ?? undefined} target={relation.url ? '_blank' : undefined} rel="noreferrer" className="flex h-8 items-center gap-2 rounded-[7px] px-2 text-[9px] text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><LinkSimple className="size-3.5 text-[var(--accent-ink)]" /><span className="min-w-0 flex-1 truncate">{relation.externalId}</span><span className="text-[8px] text-[var(--muted)]">{relation.objectType}</span></a>)}</div> : <EmptyCopy>暂无关联对象。</EmptyCopy>}
        </DetailCard>
      </div>
    </div>
  )
}

function DetailCard({ title, icon: Icon, className, children }: { title: string; icon: typeof FileText; className?: string; children: React.ReactNode }) {
  return <section className={cn('rounded-[12px] border border-[var(--line)] bg-panel p-4 shadow-[0_10px_28px_-26px_rgba(28,44,74,0.34)]', className)}><header className="mb-3 flex items-center gap-2 border-b border-[var(--line)] pb-3"><span className="flex size-7 items-center justify-center rounded-[7px] bg-[var(--accent-soft)] text-[var(--accent-ink)]"><Icon className="size-3.5" /></span><h2 className="text-[10.5px] font-medium text-[var(--ink)]">{title}</h2></header>{children}</section>
}

function DetailValue({ label, value, icon: Icon }: { label: string; value: string; icon: typeof User }) {
  return <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[8px] text-[var(--muted)]"><Icon className="size-3" />{label}</dt><dd className="mt-1 truncate text-[9.5px] text-[var(--ink-soft)]" title={value}>{value}</dd></div>
}

function InfoLine({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return <div className="grid grid-cols-[74px_minmax(0,1fr)] items-start gap-3 text-[9px]"><span className="flex items-center gap-1.5 text-[var(--muted)]"><Icon className="size-3.5" />{label}</span><span className="break-words text-[var(--ink-soft)]">{value}</span></div>
}

function EmptyCopy({ children }: { children: React.ReactNode }) {
  return <div className="flex h-16 items-center justify-center gap-2 text-[9px] text-[var(--muted)]"><ClockCounterClockwise className="size-3.5" />{children}</div>
}
