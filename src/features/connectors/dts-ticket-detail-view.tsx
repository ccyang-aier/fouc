import { useRef, useState } from 'react'
import { ArrowSquareOut, Check } from '@phosphor-icons/react'
import type { DtsFlowNodeSummary, DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = { ticket: DtsTicketSummary; detail: DtsTicketDetail | null }
type SectionId = 'basic' | 'flow' | 'relations' | 'permissions'
type Definition = { label: string; value: string; wide?: boolean }

export function DtsTicketDetailView({ ticket, detail }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('basic')
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({ basic: null, flow: null, relations: null, permissions: null })
  const productPath = ticket.productPath.join(' / ') || ticket.productType || '—'
  const definitions: Definition[] = [
    { label: '工单号', value: ticket.id },
    { label: '当前状态', value: ticket.status },
    { label: '简要描述', value: ticket.title, wide: true },
    { label: '严重程度', value: ticket.severity ?? '—' },
    { label: '当前处理人', value: ticket.currentHandler ?? '—' },
    { label: '创建人', value: ticket.creator ?? '—' },
    { label: '创建时间', value: ticket.createdAt ?? '—' },
    { label: '产品路径', value: productPath, wide: true },
    ...(detail?.fields.slice(0, 8).map((field) => ({ label: field.label, value: field.value == null ? '—' : String(field.value) })) ?? []),
  ]

  function goTo(section: SectionId) {
    setActiveSection(section)
    sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div aria-label="问题单详情视图" className="flex min-h-0 flex-1 bg-panel">
      <nav aria-label="问题单详情章节" className="w-[132px] shrink-0 border-r border-[var(--line)] bg-[var(--surface-subtle)]/60 py-2">
        <SectionNav active={activeSection === 'basic'} label="基本信息" onClick={() => goTo('basic')} />
        <SectionNav active={activeSection === 'flow'} label="流程进展" count={detail?.flowNodes.length ?? 0} onClick={() => goTo('flow')} />
        <SectionNav active={activeSection === 'relations'} label="相关关联" count={detail?.relations.length ?? 0} onClick={() => goTo('relations')} />
        <SectionNav active={activeSection === 'permissions'} label="权限" count={detail?.permissions.length ?? 0} onClick={() => goTo('permissions')} />
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-6 pb-8">
        <header className="flex min-h-12 items-center border-b border-[var(--line-strong)] py-2.5">
          <p className="min-w-0 truncate text-[11px] text-[var(--ink)]"><span className="mr-3 font-medium">{ticket.id}</span>{ticket.title}</p>
        </header>

        <section ref={(node) => { sectionRefs.current.basic = node }} className="scroll-mt-2 pt-4">
          <SectionTitle>基本信息</SectionTitle>
          <div className="grid grid-cols-2 border-t border-[var(--line)] max-[1040px]:grid-cols-1">
            {definitions.map((item) => <DefinitionRow key={`${item.label}-${item.value}`} {...item} />)}
          </div>
          {ticket.remark ? <div className="grid grid-cols-[92px_minmax(0,1fr)] border-b border-[var(--line)] py-2.5 text-[9.5px]"><span className="text-[var(--muted)]">问题描述</span><p className="max-w-[760px] whitespace-pre-line leading-[17px] text-[var(--ink-soft)]">{ticket.remark}</p></div> : null}
        </section>

        <section ref={(node) => { sectionRefs.current.flow = node }} className="scroll-mt-2 pt-5">
          <SectionTitle count={detail?.flowNodes.length ?? 0}>流程进展</SectionTitle>
          <WorkflowTimeline nodes={detail?.flowNodes ?? []} currentNode={detail?.currentNode ?? null} fallbackStatus={ticket.status} />
        </section>

        <section ref={(node) => { sectionRefs.current.relations = node }} className="scroll-mt-2 pt-5">
          <SectionTitle count={detail?.relations.length ?? 0}>相关关联</SectionTitle>
          {detail?.relations.length ? (
            <div className="overflow-x-auto border-y border-[var(--line)]">
              <table className="w-full min-w-[620px] border-collapse text-left text-[9px]">
                <thead><tr className="bg-[var(--surface-subtle)] text-[var(--muted-strong)]"><TableHead>类型</TableHead><TableHead>名称</TableHead><TableHead>来源</TableHead><TableHead>关系说明</TableHead><TableHead>权限</TableHead><TableHead><span className="sr-only">操作</span></TableHead></tr></thead>
                <tbody>{detail.relations.map((relation) => <tr key={`${relation.objectType}-${relation.externalId}`} className="border-t border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]/55"><TableCell>{relation.objectType}</TableCell><TableCell className="font-medium text-[var(--accent-ink)]">{relation.externalId}</TableCell><TableCell>DTS</TableCell><TableCell>直接关联</TableCell><TableCell>{detail.permissions.includes('relation:read') ? '可查看' : '只读'}</TableCell><TableCell>{relation.url ? <a href={relation.url} target="_blank" rel="noreferrer" aria-label={`打开关联对象 ${relation.externalId}`} className="inline-flex size-6 items-center justify-center text-[var(--muted)] outline-none hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowSquareOut className="size-3.5" /></a> : '—'}</TableCell></tr>)}</tbody>
              </table>
            </div>
          ) : <EmptyLine>暂无关联对象</EmptyLine>}
        </section>

        <section ref={(node) => { sectionRefs.current.permissions = node }} className="scroll-mt-2 pt-5">
          <SectionTitle count={detail?.permissions.length ?? 0}>权限</SectionTitle>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] border-y border-[var(--line)] py-3 text-[9.5px]"><span className="text-[var(--muted)]">当前权限</span><span className="text-[var(--ink-soft)]">{detail?.permissions.join(' · ') || 'ticket:read'}</span></div>
        </section>
      </div>
    </div>
  )
}

function SectionNav({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return <button type="button" aria-current={active ? 'page' : undefined} onClick={onClick} className={cn('relative flex h-9 w-full items-center px-4 text-left text-[9.5px] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]', active ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-ink)] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--accent)]' : 'text-[var(--muted-strong)]')}><span className="min-w-0 flex-1 truncate">{label}</span>{count == null ? null : <span className="ml-2 tabular-nums text-[var(--muted)]">{count}</span>}</button>
}

function SectionTitle({ count, children }: { count?: number; children: React.ReactNode }) {
  return <h2 className="mb-2.5 flex items-center gap-2 text-[10px] font-medium text-[var(--ink)]">{children}{count == null ? null : <span className="font-normal tabular-nums text-[var(--muted)]">{count}</span>}</h2>
}

function DefinitionRow({ label, value, wide }: Definition) {
  return <div className={cn('grid min-h-9 grid-cols-[92px_minmax(0,1fr)] items-center border-b border-[var(--line)] py-2 pr-6 text-[9.5px] odd:border-r odd:pr-8 even:pl-8 max-[1040px]:border-r-0 max-[1040px]:px-0', wide && 'col-span-2 border-r-0 px-0 max-[1040px]:col-span-1')}><span className="text-[var(--muted)]">{label}</span><span className="min-w-0 truncate text-[var(--ink-soft)]" title={value}>{value}</span></div>
}

function WorkflowTimeline({ nodes, currentNode, fallbackStatus }: { nodes: DtsFlowNodeSummary[]; currentNode: DtsFlowNodeSummary | null; fallbackStatus: string }) {
  const visible = nodes.length ? nodes.slice(0, 8) : [{ id: 'current', name: fallbackStatus, status: 'active', handler: null, handledAt: null }]
  const activeIndex = currentNode ? visible.findIndex((node) => node.id === currentNode.id) : Math.max(0, visible.findIndex((node) => node.status === 'active'))
  return <ol className="flex min-w-[620px] items-start border-y border-[var(--line)] py-4">{visible.map((node, index) => {
    const done = node.status === 'done' || index < activeIndex
    const active = index === activeIndex
    return <li key={node.id} className="flex min-w-0 flex-1 items-start"><div className="w-[104px] shrink-0 text-center"><span className={cn('mx-auto flex size-4 items-center justify-center rounded-full border bg-panel', done ? 'border-[var(--ok-ink)] bg-[var(--ok-ink)] text-white' : active ? 'border-[var(--accent)] text-[var(--accent-ink)] ring-2 ring-[var(--accent-soft)]' : 'border-[var(--line-strong)] text-[var(--muted)]')}>{done ? <Check className="size-2.5" weight="bold" /> : <span className={cn('size-1 rounded-full', active ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} />}</span><p className={cn('mt-2 truncate text-[8.8px]', active ? 'font-medium text-[var(--accent-ink)]' : done ? 'text-[var(--ok-ink)]' : 'text-[var(--ink-soft)]')}>{node.name}</p><p className="mt-0.5 truncate text-[8px] text-[var(--muted)]">{node.handler ?? (active ? '待处理' : '待分配')}</p></div>{index < visible.length - 1 ? <span className={cn('mt-[7px] h-px min-w-6 flex-1', index < activeIndex ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]')} /> : null}</li>
  })}</ol>
}

function TableHead({ children }: { children: React.ReactNode }) { return <th className="h-8 px-3 font-medium">{children}</th> }
function TableCell({ className, children }: { className?: string; children: React.ReactNode }) { return <td className={cn('h-9 px-3', className)}>{children}</td> }
function EmptyLine({ children }: { children: React.ReactNode }) { return <p className="border-y border-[var(--line)] py-5 text-center text-[9px] text-[var(--muted)]">{children}</p> }
