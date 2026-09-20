import { ArrowSquareOut, Check } from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }
type Definition = { label: string; value: string }

export function DtsTicketDetailView({ ticket, detail }: Props) {
  const field = (keyword: string) => detail?.fields.find((item) => item.label.includes(keyword))?.value?.toString() ?? '—'
  const productPath = ticket.productPath.join(' / ') || ticket.productType || '—'
  const leftDefinitions: Definition[] = [
    { label: '工单号', value: ticket.id },
    { label: '当前状态', value: ticket.status },
    { label: '当前处理人', value: ticket.currentHandler ?? '—' },
    { label: '创建人', value: ticket.creator ?? '—' },
    { label: '创建时间', value: ticket.createdAt ?? '—' },
  ]
  const rightDefinitions: Definition[] = [
    { label: '产品路径', value: productPath },
    { label: '故障集群', value: field('集群') },
    { label: '影响范围', value: field('影响') },
    { label: 'Trace 样本', value: field('Trace') },
    { label: '最近变更', value: field('变更') },
  ]

  return (
    <div aria-label="问题单详情视图" className="min-h-0 flex-1 overflow-y-auto bg-panel px-5 pb-8">
      <SectionBand title="基本信息">
        <p className="max-w-[720px] text-[10px] leading-[18px] text-[var(--ink-soft)]">{ticket.remark || ticket.title}</p>
        <div className="mt-4 grid grid-cols-4 border-y border-[var(--line)] py-3.5">
          <KeyFact label="严重程度" value={ticket.severity ?? '—'} />
          <KeyFact label="问题类型" value={ticket.productType ?? '—'} />
          <KeyFact label="影响范围" value={field('影响')} />
          <KeyFact label="当前节点" value={detail?.currentNode?.name ?? ticket.status} last />
        </div>
        <div className="grid grid-cols-2 divide-x divide-[var(--line)] max-[1040px]:grid-cols-1 max-[1040px]:divide-x-0">
          <DefinitionList values={leftDefinitions} className="pr-6 max-[1040px]:pr-0" />
          <DefinitionList values={rightDefinitions} className="pl-6 max-[1040px]:pl-0" />
        </div>
      </SectionBand>

      <SectionBand title="流程进展" count={detail?.flowNodes.length ?? 0}>
        <WorkflowTimeline nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} fallbackStatus={ticket.status} />
      </SectionBand>

      <SectionBand title="相关关联" count={detail?.relations.length ?? 0}>
        {detail?.relations.length ? (
          <div className="overflow-x-auto border border-[var(--line)]">
            <table className="w-full min-w-[600px] border-collapse text-left text-[9px]">
              <thead><tr className="bg-[var(--surface-subtle)] text-[var(--muted-strong)]"><TableHead>类型</TableHead><TableHead>名称</TableHead><TableHead>来源</TableHead><TableHead>关系说明</TableHead><TableHead>权限</TableHead><TableHead><span className="sr-only">操作</span></TableHead></tr></thead>
              <tbody>{detail.relations.map((relation) => <tr key={`${relation.objectType}-${relation.externalId}`} className="border-t border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]/55"><TableCell>{relation.objectType}</TableCell><TableCell className="font-medium text-[var(--accent-ink)]">{relation.externalId}</TableCell><TableCell>DTS</TableCell><TableCell>直接关联</TableCell><TableCell>{detail.permissions.includes('relation:read') ? '可查看' : '只读'}</TableCell><TableCell>{relation.url ? <a href={relation.url} target="_blank" rel="noreferrer" aria-label={`打开关联对象 ${relation.externalId}`} className="inline-flex size-6 items-center justify-center text-[var(--muted)] outline-none hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowSquareOut className="size-3.5" /></a> : '—'}</TableCell></tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyLine>暂无关联对象</EmptyLine>}
      </SectionBand>

      <SectionBand title="权限" count={detail?.permissions.length ?? 0} last>
        <div className="flex min-h-9 items-center gap-4 text-[9.5px]"><span className="text-[var(--muted)]">当前权限</span><span className="text-[var(--ink-soft)]">{detail?.permissions.join(' · ') || 'ticket:read'}</span></div>
      </SectionBand>
    </div>
  )
}

function SectionBand({ title, count, last, children }: { title: string; count?: number; last?: boolean; children: React.ReactNode }) {
  return <section className={cn('grid grid-cols-[96px_minmax(0,1fr)] border-b border-[var(--line-strong)]', last && 'border-b-0')}><header className="border-r border-[var(--line)] py-5 pr-4"><h2 className="text-[10.5px] font-medium text-[var(--ink)]">{title}{count == null ? null : <span className="ml-2 font-normal tabular-nums text-[var(--muted)]">{count}</span>}</h2></header><div className="min-w-0 py-5 pl-5">{children}</div></section>
}

function KeyFact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <div className={cn('min-w-0 border-r border-[var(--line)] px-4 first:pl-0', last && 'border-r-0')}><p className="text-[8.5px] text-[var(--muted)]">{label}</p><p className="mt-1.5 truncate text-[10px] text-[var(--ink)]" title={value}>{value}</p></div>
}

function DefinitionList({ values, className }: { values: Definition[]; className?: string }) {
  return <dl className={cn(className)}>{values.map((item) => <div key={`${item.label}-${item.value}`} className="grid min-h-9 grid-cols-[82px_minmax(0,1fr)] items-center border-b border-[var(--line)] text-[9.5px] last:border-b-0"><dt className="text-[var(--muted)]">{item.label}</dt><dd className="min-w-0 truncate text-[var(--ink-soft)]" title={item.value}>{item.value}</dd></div>)}</dl>
}

function WorkflowTimeline({ nodes, currentNode, fallbackStatus }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; fallbackStatus: string }) {
  const visible = nodes.length ? nodes.slice(0, 8) : [{ id: 'current', name: fallbackStatus, status: 'active', handler: null, handledAt: null }]
  const activeIndex = currentNode ? visible.findIndex((node) => node.id === currentNode.id) : Math.max(0, visible.findIndex((node) => node.status === 'active'))
  return <ol className="flex min-w-[600px] items-start py-2">{visible.map((node, index) => {
    const done = node.status === 'done' || index < activeIndex
    const active = index === activeIndex
    return <li key={node.id} className="flex min-w-0 flex-1 items-start"><div className="w-[104px] shrink-0 text-center"><span className={cn('mx-auto flex size-5 items-center justify-center rounded-full border bg-panel text-[8px]', done ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : active ? 'border-[var(--accent)] text-[var(--accent-ink)]' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-3" weight="bold" /> : index + 1}</span><p className={cn('mt-2 truncate text-[9px]', active ? 'font-medium text-[var(--accent-ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</p><p className="mt-1 truncate text-[8px] text-[var(--muted)]">{node.handler ?? (active ? '待处理' : '待分配')}</p></div>{index < visible.length - 1 ? <span className={cn('mt-[9px] h-px min-w-5 flex-1', index < activeIndex ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} /> : null}</li>
  })}</ol>
}

function TableHead({ children }: { children: React.ReactNode }) { return <th className="h-8 px-3 font-medium">{children}</th> }
function TableCell({ className, children }: { className?: string; children: React.ReactNode }) { return <td className={cn('h-9 px-3', className)}>{children}</td> }
function EmptyLine({ children }: { children: React.ReactNode }) { return <p className="border-y border-[var(--line)] py-5 text-center text-[9px] text-[var(--muted)]">{children}</p> }
