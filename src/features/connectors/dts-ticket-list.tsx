import { useEffect, useRef, useState } from 'react'
import { CaretDown, CaretLeft, CaretRight, ChatCircleDots, Clock, Funnel, LinkSimple, MagnifyingGlass, SidebarSimple, SpinnerGap, User, X } from '@phosphor-icons/react'
import type { DtsFilterId, DtsSeverity, DtsTicketListResult, DtsTicketSummary } from '@fouc/shared'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const PRIMARY_FILTERS: ReadonlyArray<{ id: DtsFilterId; label: string }> = [
  { id: 'myTodos', label: '待处理' },
  { id: 'myCreate', label: '我创建' },
  { id: 'myProcessed', label: '曾处理' },
  { id: 'myFollowed', label: '关注' },
]

const MORE_FILTERS: ReadonlyArray<{ id: DtsFilterId; label: string }> = [
  { id: 'myOverdue', label: '已逾期' },
  { id: 'ccToMe', label: '抄送给我' },
  { id: 'unclosed', label: '未关闭' },
  { id: 'closed', label: '已关闭' },
  { id: 'cancel', label: '已取消' },
]

type Props = {
  activeFilter: DtsFilterId
  tickets: DtsTicketListResult | null
  selectedId: string | null
  loading: boolean
  keyword: string
  error: string | null
  onFilterChange: (filter: DtsFilterId) => void
  onKeywordChange: (value: string) => void
  onSearch: () => void
  onSelect: (ticket: DtsTicketSummary) => void
  onPageChange: (page: number) => void
  onCollapse: () => void
}

export function DtsTicketList(props: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const activeView = [...PRIMARY_FILTERS, ...MORE_FILTERS].find((filter) => filter.id === props.activeFilter)

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  return (
    <aside aria-label="DTS 工单列表" className="flex min-h-0 w-[316px] shrink-0 flex-col border-r border-[var(--line)] bg-panel transition-[width] duration-200 max-[1180px]:w-[284px]">
      <div className="flex h-[48px] shrink-0 items-center gap-1 border-b border-[var(--line-strong)] px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="切换工单视图" className="flex h-8 min-w-0 items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-panel px-2.5 text-[10px] text-[var(--ink-soft)] outline-none hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <span className="truncate">{activeView?.label ?? '待处理'}</span>
              {props.activeFilter === 'myTodos' && props.tickets ? <span className="text-[8px] tabular-nums text-[var(--muted)]">{props.tickets.total}</span> : null}
              <CaretDown className="size-3 shrink-0 text-[var(--muted)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            {PRIMARY_FILTERS.map((filter) => <DropdownMenuCheckboxItem key={filter.id} checked={props.activeFilter === filter.id} onCheckedChange={() => props.onFilterChange(filter.id)}>{filter.label}</DropdownMenuCheckboxItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" aria-label={searchOpen ? '关闭工单搜索' : '搜索工单'} aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)} className={cn('flex size-8 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', searchOpen && 'bg-[var(--surface-hover)] text-[var(--ink)]')}><MagnifyingGlass className="size-3.5" /></button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="筛选工单" className={cn('flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', MORE_FILTERS.some((filter) => filter.id === props.activeFilter) && 'bg-[var(--accent-soft)] text-[var(--accent-ink)]')}><Funnel className="size-3.5" weight={MORE_FILTERS.some((filter) => filter.id === props.activeFilter) ? 'fill' : 'regular'} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {MORE_FILTERS.map((filter) => <DropdownMenuCheckboxItem key={filter.id} checked={props.activeFilter === filter.id} onCheckedChange={() => props.onFilterChange(filter.id)}>{filter.label}</DropdownMenuCheckboxItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" aria-label="收起工单侧栏" aria-expanded="true" onClick={props.onCollapse} className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><SidebarSimple className="size-3.5" weight="regular" /></button>
        </div>
      </div>
      {searchOpen ? <form onSubmit={(event) => { event.preventDefault(); props.onSearch() }} className="flex h-[48px] shrink-0 items-center gap-2 border-b border-[var(--line)] px-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 focus-within:border-[var(--accent)]">
          <MagnifyingGlass className="size-3.5 shrink-0 text-[var(--muted)]" />
          <input ref={searchInputRef} aria-label="搜索 DTS 工单" value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }} placeholder="搜索标题或工单号" className="min-w-0 flex-1 bg-transparent text-[9.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          <button type="button" aria-label="关闭工单搜索" onClick={() => setSearchOpen(false)} className="flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"><X className="size-3" /></button>
        </div>
      </form> : null}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2" aria-busy={props.loading}>
        {props.loading ? <ListMessage icon={<SpinnerGap className="size-4 animate-spin" />} label="正在同步工单…" /> : props.error ? <ListMessage label={props.error} error /> : !props.tickets?.items.length ? <ListMessage label="当前视图暂无工单" /> : props.tickets.items.map((ticket) => (
          <button key={ticket.id} type="button" aria-pressed={props.selectedId === ticket.id} onClick={() => props.onSelect(ticket)} className={cn('group block w-full rounded-[10px] border bg-panel px-3 py-2.5 text-left outline-none transition-[border-color,box-shadow,background-color] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20 hover:shadow-[0_7px_20px_-14px_rgba(42,101,220,0.45)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', props.selectedId === ticket.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]/35 shadow-[0_7px_20px_-14px_rgba(42,101,220,0.52)]' : 'border-[var(--line)]')}>
            <div className="flex items-center gap-1.5">
              <span className={cn('size-1.5 shrink-0 rounded-full', severityDot(ticket.severity))} />
              <span className="min-w-0 flex-1 truncate text-[9px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{ticket.id}</span>
              <span className={cn('shrink-0 rounded-[5px] px-1.5 py-0.5 text-[8px] font-semibold', severityBadge(ticket.severity))}>{ticket.severity ?? '一般'}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[10.5px] font-semibold leading-[15px] tracking-[-0.012em] text-[var(--ink)]">{ticket.title}</p>
            {ticket.remark ? <p className="mt-1 line-clamp-2 text-[8.5px] leading-[13px] text-[var(--muted-strong)]">{ticket.remark}</p> : null}
            <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-dashed border-[var(--line-strong)]/70 pt-2 text-[8px] text-[var(--muted)]">
              <span className="flex min-w-0 items-center gap-1"><User className="size-3 shrink-0" weight="regular" /><span className="truncate">{ticket.currentHandler ?? ticket.creator ?? '未分配'}</span></span>
              <span className="flex shrink-0 items-center gap-1 tabular-nums"><Clock className="size-3" />{shortDate(ticket.createdAt)}</span>
              {ticket.commentCount != null ? <span className="ml-auto flex shrink-0 items-center gap-1 text-[var(--muted-strong)]" aria-label={`${ticket.commentCount} 条评论`}><ChatCircleDots className="size-3" />{ticket.commentCount}</span> : null}
            </div>
            <div className="mt-1.5 grid min-w-0 grid-cols-[minmax(58px,auto)_minmax(0,1fr)] items-center gap-2 text-[8px]">
              <span className={cn('w-fit max-w-full truncate rounded-[5px] px-1.5 py-0.5 font-medium', statusTone(ticket.status))}>{ticket.status}</span>
              {ticket.relatedCount != null ? <span className="flex min-w-0 items-center justify-center gap-1 rounded-[5px] bg-[var(--accent-soft)] px-1.5 py-0.5 font-medium text-[var(--accent-ink)]"><LinkSimple className="size-2.5 shrink-0" /><span className="truncate">与 {ticket.relatedCount} 个问题相关</span></span> : <span />}
            </div>
          </button>
        ))}
      </div>
      {props.tickets && props.tickets.total > props.tickets.pageSize ? <Pagination result={props.tickets} onPageChange={props.onPageChange} /> : null}
    </aside>
  )
}

function ListMessage({ icon, label, error }: { icon?: React.ReactNode; label: string; error?: boolean }) {
  return <div className={cn('flex h-40 items-center justify-center gap-2 px-5 text-center text-[9.5px] text-[var(--muted)]', error && 'text-[var(--err-ink)]')}>{icon}{label}</div>
}

function Pagination({ result, onPageChange }: { result: DtsTicketListResult; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  return <div className="flex h-10 shrink-0 items-center justify-center gap-3 border-t border-[var(--line)] text-[9px] text-[var(--muted)]"><button aria-label="上一页" disabled={result.page <= 1} onClick={() => onPageChange(result.page - 1)} className="flex size-6 items-center justify-center rounded-[5px] hover:bg-[var(--surface-hover)] disabled:opacity-25"><CaretLeft className="size-3" /></button><span className="rounded-[5px] bg-[var(--accent-soft)] px-2 py-1 font-semibold tabular-nums text-[var(--accent-ink)]">{result.page}</span><span>/ {pages}</span><button aria-label="下一页" disabled={result.page >= pages} onClick={() => onPageChange(result.page + 1)} className="flex size-6 items-center justify-center rounded-[5px] hover:bg-[var(--surface-hover)] disabled:opacity-25"><CaretRight className="size-3" /></button></div>
}

function severityDot(value: DtsSeverity | null): string {
  if (value === '致命') return 'bg-[#d92d20] shadow-[0_0_0_3px_rgba(217,45,32,0.10)]'
  if (value === '严重') return 'bg-[#ef4565]'
  if (value === '一般') return 'bg-[#e6982d]'
  return 'bg-[#6681f5]'
}

function severityBadge(value: DtsSeverity | null): string {
  if (value === '致命') return 'bg-[color-mix(in_srgb,var(--err-ink)_16%,var(--panel))] text-[var(--err-ink)] ring-1 ring-inset ring-[var(--err-ink)]/15'
  if (value === '严重') return 'bg-[color-mix(in_srgb,var(--err-ink)_10%,var(--panel))] text-[var(--err-ink)] ring-1 ring-inset ring-[var(--err-ink)]/10'
  if (value === '一般') return 'bg-[var(--warn-soft)] text-[var(--warn-ink)] ring-1 ring-inset ring-[var(--warn-ink)]/10'
  return 'bg-[var(--accent-soft)] text-[var(--accent-ink)] ring-1 ring-inset ring-[var(--accent)]/10'
}

function statusTone(value: string): string {
  if (value.includes('完成') || value.includes('关闭')) return 'bg-[color-mix(in_srgb,var(--ok-ink)_10%,var(--panel))] text-[var(--ok-ink)]'
  if (value.includes('处理') || value.includes('验证')) return 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
  return 'bg-[var(--warn-soft)] text-[var(--warn-ink)]'
}

function shortDate(value: string | null): string {
  if (!value) return '—'
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/)
  return match ? match[3] ?? `${match[1]}-${match[2]}` : value.slice(0, 10)
}
