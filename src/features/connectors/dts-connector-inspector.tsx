import { useState } from 'react'
import { ClockCounterClockwise, LinkSimple, PaperPlaneTilt, ShieldCheck, Sparkle } from '@phosphor-icons/react'
import type { DtsTicketDetail, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = { ticket: DtsTicketDetail | null; summary: DtsTicketSummary | null }

export function DtsConnectorInspector({ ticket, summary }: Props) {
  const [tab, setTab] = useState<'detail' | 'assistant'>('detail')
  const selected = ticket ?? summary
  return (
    <aside aria-label="工单上下文" className="flex min-h-0 w-[282px] shrink-0 flex-col border-l border-[var(--line)] bg-panel max-[1260px]:hidden">
      <div className="flex h-[48px] shrink-0 items-end border-b border-[var(--line)] px-3"><TabButton active={tab === 'detail'} onClick={() => setTab('detail')}>问题详情</TabButton><TabButton active={tab === 'assistant'} onClick={() => setTab('assistant')}>AI 助手</TabButton></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1">
        {tab === 'detail' ? selected ? <>
          <InspectorSection title="问题摘要"><p className="text-[10px] font-medium leading-[17px] text-[var(--ink-soft)]">{selected.title}</p><p className="mt-2 line-clamp-4 text-[9.5px] leading-[16px] text-[var(--muted-strong)]">{selected.remark || '该问题正在 DTS 流程中处理，可结合中间概览查看影响范围、责任人与当前节点。'}</p></InspectorSection>
          <InspectorSection title="Fouc 分析" sparkle><p className="text-[9.5px] leading-[17px] text-[var(--ink-soft)]">当前处于“{selected.status}”阶段，{selected.currentHandler ? `由 ${selected.currentHandler} 负责处理` : '尚未明确当前处理人'}。建议优先核对影响范围与关键字段，再推进当前流程节点。</p><button type="button" className="mt-3 flex h-8 items-center gap-1.5 rounded-[7px] border border-[var(--line)] px-3 text-[9.5px] font-medium text-[var(--ink-soft)] hover:bg-[var(--surface-hover)]"><Sparkle className="size-3.5 text-[var(--accent-ink)]" />查看完整分析</button></InspectorSection>
          <InspectorSection title="关联"><RelationRow icon={LinkSimple} label="外部关联" value={ticket?.relations.length ?? 0} /><RelationRow icon={ShieldCheck} label="可用权限" value={ticket?.permissions.length ?? 0} /><RelationRow icon={ClockCounterClockwise} label="流程节点" value={ticket?.flowNodes.length ?? 0} /></InspectorSection>
        </> : <div className="flex h-48 items-center justify-center text-[9.5px] text-[var(--muted)]">选择工单后查看详情</div> : <div className="py-4"><div className="rounded-[10px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] p-3"><div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--accent-ink)]"><Sparkle className="size-4" weight="fill" />围绕当前工单提问</div><p className="mt-1.5 text-[9px] leading-4 text-[var(--muted-strong)]">Fouc 会基于当前工单的字段、流程与关联信息给出建议。</p></div></div>}
      </div>
      <form onSubmit={(event) => event.preventDefault()} className="shrink-0 border-t border-[var(--line)] p-3"><div className="flex min-h-[62px] items-end gap-2 rounded-[9px] border border-[var(--accent-soft-line)] bg-panel p-2.5 focus-within:border-[var(--accent)]"><textarea aria-label="向 Fouc 提问" placeholder="向 Fouc 提问，获取处理建议…" className="min-h-10 min-w-0 flex-1 resize-none bg-transparent text-[9.5px] leading-4 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" /><button type="submit" aria-label="发送" className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-[var(--accent)] text-white"><PaperPlaneTilt className="size-3.5" weight="fill" /></button></div></form>
    </aside>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn('relative h-full flex-1 text-[10.5px] font-medium text-[var(--muted-strong)] outline-none hover:text-[var(--ink)]', active && 'font-semibold text-[var(--ink)] after:absolute after:inset-x-4 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--accent)]')}>{children}</button> }
function InspectorSection({ title, sparkle, children }: { title: string; sparkle?: boolean; children: React.ReactNode }) { return <section className="border-b border-[var(--line)] py-4 last:border-0"><header className="mb-2.5 flex items-center gap-1.5"><h2 className="text-[10px] font-semibold text-[var(--ink)]">{title}</h2>{sparkle ? <Sparkle className="size-3.5 text-[#7658f5]" weight="fill" /> : null}<span className="h-px flex-1 bg-[var(--line)]" /></header>{children}</section> }
function RelationRow({ icon: Icon, label, value }: { icon: typeof LinkSimple; label: string; value: number }) { return <div className="flex items-center gap-2 rounded-[6px] px-1 py-2 text-[9.5px] text-[var(--ink-soft)]"><Icon className="size-3.5 text-[var(--accent-ink)]" /><span className="flex-1">{label}</span><span className="font-semibold tabular-nums text-[var(--ink)]">{value}</span><span className="text-[var(--muted)]">›</span></div> }
