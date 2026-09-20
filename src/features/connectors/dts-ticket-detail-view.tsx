import { ArrowSquareOut, Check } from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }
type Definition = { label: string; value: string }

export function DtsTicketDetailView({ ticket, detail }: Props) {
  const cluster = detail?.fields.find((field) => field.label.includes('集群'))
  const impact = detail?.fields.find((field) => field.label.includes('影响'))
  const productPath = ticket.productPath.join(' / ') || ticket.productType || '—'
  const primary: Definition[] = [
    { label: '问题单 ID', value: ticket.id },
    { label: '问题类型', value: ticket.productType ?? '—' },
    { label: '严重程度', value: ticket.severity ?? '一般' },
    { label: '所属产品', value: productPath },
  ]
  const ownership: Definition[] = [
    { label: '当前状态', value: ticket.status },
    { label: '当前处理人', value: ticket.currentHandler ?? '待分配' },
    { label: '创建人', value: ticket.creator ?? '—' },
    { label: '创建时间', value: ticket.createdAt ?? '—' },
  ]

  return (
    <div aria-label="问题单详情视图" className="min-h-0 flex-1 overflow-y-auto bg-panel">
      <div className="mx-auto w-full max-w-[940px] px-6 pb-8">
        <dl className="grid min-h-[72px] grid-cols-6 items-center border-b border-[var(--line)] max-[1100px]:grid-cols-3">
          <RailValue label="当前处理人" value={ticket.currentHandler ?? '待分配'} />
          <RailValue label="创建人" value={ticket.creator ?? '—'} />
          <RailValue label="创建时间" value={ticket.createdAt ?? '—'} />
          <RailValue label={cluster?.label ?? '所属产品'} value={cluster?.value == null ? (ticket.productType ?? '—') : String(cluster.value)} />
          <RailValue label={impact?.label ?? '产品路径'} value={impact?.value == null ? productPath : String(impact.value)} />
          <RailValue label="当前流程节点" value={detail?.currentNode?.name ?? ticket.status} last />
        </dl>

        <DetailSection title="问题描述">
          <p className="max-w-[820px] whitespace-pre-line text-[10.5px] leading-[19px] text-[var(--ink-soft)]">{ticket.remark ?? '暂无问题描述。'}</p>
        </DetailSection>

        <DetailSection title="基本信息">
          <div className="grid grid-cols-2 divide-x divide-[var(--line)] max-[980px]:grid-cols-1 max-[980px]:divide-x-0 max-[980px]:divide-y">
            <DefinitionList values={primary} className="pr-8 max-[980px]:pb-4 max-[980px]:pr-0" />
            <DefinitionList values={ownership} className="pl-8 max-[980px]:pt-4 max-[980px]:pl-0" />
          </div>
        </DetailSection>

        <DetailSection title="关键字段">
          {detail?.fields.length ? (
            <div className="grid grid-cols-2 divide-x divide-[var(--line)] max-[980px]:grid-cols-1 max-[980px]:divide-x-0">
              <DefinitionList values={detail.fields.filter((_, index) => index % 2 === 0).map((field) => ({ label: field.label, value: field.value == null ? '—' : String(field.value) }))} className="pr-8 max-[980px]:pr-0" />
              <DefinitionList values={detail.fields.filter((_, index) => index % 2 === 1).map((field) => ({ label: field.label, value: field.value == null ? '—' : String(field.value) }))} className="pl-8 max-[980px]:pl-0" />
            </div>
          ) : <EmptyLine>暂无扩展字段</EmptyLine>}
        </DetailSection>

        <DetailSection title="处理流程">
          <WorkflowTimeline nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} fallbackStatus={ticket.status} />
        </DetailSection>

        <DetailSection title="关联对象">
          {detail?.relations.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-[9px]">
                <thead><tr className="border-y border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]"><TableHead>对象类型</TableHead><TableHead>对象标识</TableHead><TableHead>来源</TableHead><TableHead>关系</TableHead><TableHead>权限</TableHead><TableHead><span className="sr-only">操作</span></TableHead></tr></thead>
                <tbody>{detail.relations.map((relation) => <tr key={`${relation.objectType}-${relation.externalId}`} className="border-b border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]/55"><TableCell>{relation.objectType}</TableCell><TableCell className="font-medium text-[var(--ink)]">{relation.externalId}</TableCell><TableCell>DTS</TableCell><TableCell>直接关联</TableCell><TableCell>{detail.permissions.includes('relation:read') ? '可查看' : '只读'}</TableCell><TableCell>{relation.url ? <a href={relation.url} target="_blank" rel="noreferrer" aria-label={`打开关联对象 ${relation.externalId}`} className="inline-flex size-6 items-center justify-center text-[var(--muted)] outline-none hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowSquareOut className="size-3.5" /></a> : '—'}</TableCell></tr>)}</tbody>
              </table>
            </div>
          ) : <EmptyLine>暂无关联对象</EmptyLine>}
          <div className="mt-3 flex items-start gap-4 text-[8.5px]"><span className="w-20 shrink-0 text-[var(--muted)]">当前权限</span><span className="text-[var(--ink-soft)]">{detail?.permissions.join(' · ') || 'ticket:read'}</span></div>
        </DetailSection>
      </div>
    </div>
  )
}

function RailValue({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <div className={cn('min-w-0 border-r border-[var(--line)] px-4 first:pl-0 max-[1100px]:border-b max-[1100px]:py-3', last && 'border-r-0')}><dt className="text-[8px] text-[var(--muted)]">{label}</dt><dd className="mt-1 truncate text-[9.5px] font-medium text-[var(--ink-soft)]" title={value}>{value}</dd></div>
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="pt-5"><header className="mb-3 flex h-7 items-center gap-3 border-b border-[var(--line)] pb-3"><span className="h-5 w-[3px] shrink-0 bg-[var(--accent)]" /><h2 className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2></header>{children}</section>
}

function DefinitionList({ values, className }: { values: Definition[]; className?: string }) {
  return <dl className={cn('space-y-2', className)}>{values.map((item) => <div key={`${item.label}-${item.value}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 text-[9.5px]"><dt className="text-[var(--muted)]">{item.label}</dt><dd className="min-w-0 truncate text-[var(--ink-soft)]" title={item.value}>{item.value}</dd></div>)}</dl>
}

function WorkflowTimeline({ nodes, currentNode, fallbackStatus }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; fallbackStatus: string }) {
  const visible = nodes.length ? nodes.slice(0, 6) : [{ id: 'current', name: fallbackStatus, status: 'active', handler: null, handledAt: null }]
  const activeIndex = currentNode ? visible.findIndex((node) => node.id === currentNode.id) : Math.max(0, visible.findIndex((node) => node.status === 'active'))
  return <ol className="flex min-w-[620px] items-start overflow-x-auto pb-2">{visible.map((node, index) => {
    const done = node.status === 'done' || index < activeIndex
    const active = index === activeIndex
    return <li key={node.id} className="flex min-w-0 flex-1 items-start"><div className="w-[104px] shrink-0 text-center"><span className={cn('mx-auto flex size-5 items-center justify-center rounded-full border bg-panel', done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : active ? 'border-[var(--accent)] text-[var(--accent-ink)] ring-2 ring-[var(--accent-soft)]' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-3" weight="bold" /> : <span className={cn('size-1.5 rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} />}</span><p className={cn('mt-2 truncate text-[9px]', active ? 'font-medium text-[var(--accent-ink)]' : done ? 'text-[var(--ok-ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</p><p className="mt-0.5 truncate text-[8px] text-[var(--muted)]">{node.handler ?? (active ? '待处理' : '待分配')}</p></div>{index < visible.length - 1 ? <span className={cn('mt-[9px] h-px min-w-6 flex-1', index < activeIndex ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} /> : null}</li>
  })}</ol>
}

function TableHead({ children }: { children: React.ReactNode }) { return <th className="h-8 px-3 font-medium">{children}</th> }
function TableCell({ className, children }: { className?: string; children: React.ReactNode }) { return <td className={cn('h-9 px-3', className)}>{children}</td> }
function EmptyLine({ children }: { children: React.ReactNode }) { return <p className="border-y border-[var(--line)] py-5 text-center text-[9px] text-[var(--muted)]">{children}</p> }
