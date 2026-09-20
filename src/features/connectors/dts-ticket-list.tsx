import { useEffect, useRef, useState } from 'react'
import { CaretDown, CaretLeft, CaretRight, Funnel, MagnifyingGlass, SpinnerGap, X } from '@phosphor-icons/react'
import type { DtsFilterId, DtsTicketListResult, DtsTicketSummary } from '@fouc/shared'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
}

export function DtsTicketList(props: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const activeView = [...PRIMARY_FILTERS, ...MORE_FILTERS].find((filter) => filter.id === props.activeFilter)

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  return (
    <aside aria-label="DTS 工单列表" className="flex min-h-0 w-[276px] shrink-0 flex-col border-r border-[var(--line)] bg-panel max-[1050px]:w-[244px]">
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
            <DropdownMenuLabel>工单视图</DropdownMenuLabel>
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
            <DropdownMenuLabel>更多视图</DropdownMenuLabel>
            {MORE_FILTERS.map((filter) => <DropdownMenuCheckboxItem key={filter.id} checked={props.activeFilter === filter.id} onCheckedChange={() => props.onFilterChange(filter.id)}>{filter.label}</DropdownMenuCheckboxItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      {searchOpen ? <form onSubmit={(event) => { event.preventDefault(); props.onSearch() }} className="flex h-[48px] shrink-0 items-center gap-2 border-b border-[var(--line)] px-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 focus-within:border-[var(--accent)]">
          <MagnifyingGlass className="size-3.5 shrink-0 text-[var(--muted)]" />
          <input ref={searchInputRef} aria-label="搜索 DTS 工单" value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }} placeholder="搜索标题或工单号" className="min-w-0 flex-1 bg-transparent text-[9.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          <button type="button" aria-label="关闭工单搜索" onClick={() => setSearchOpen(false)} className="flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"><X className="size-3" /></button>
        </div>
      </form> : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2" aria-busy={props.loading}>
        {props.loading ? <ListMessage icon={<SpinnerGap className="size-4 animate-spin" />} label="正在同步工单…" /> : props.error ? <ListMessage label={props.error} error /> : !props.tickets?.items.length ? <ListMessage label="当前视图暂无工单" /> : props.tickets.items.map((ticket) => (
          <button key={ticket.id} type="button" aria-pressed={props.selectedId === ticket.id} onClick={() => props.onSelect(ticket)} className={cn('group block w-full border-b border-[var(--line)] px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]', props.selectedId === ticket.id && 'bg-[var(--accent-soft)]')}>
            <div className="flex items-center gap-1.5"><span className={cn('size-1.5 shrink-0 rounded-full', severityTone(ticket.severity))} /><span className="min-w-0 flex-1 truncate text-[9.5px] font-medium text-[var(--ink)]">{ticket.id}</span><span className="shrink-0 text-[8px] tabular-nums text-[var(--muted)]">{shortDate(ticket.createdAt)}</span></div>
            <p className="mt-1 truncate pl-3 text-[9px] leading-[14px] text-[var(--ink-soft)]">{ticket.title}</p>
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

function severityTone(value: string | null): string {
  if (value?.includes('严重') || value === '1') return 'bg-[#ef4565] shadow-[0_0_0_3px_rgba(239,69,101,0.10)]'
  if (value?.includes('高') || value === '2') return 'bg-[#f29d38]'
  return 'bg-[#8b9ab8]'
}

function shortDate(value: string | null): string {
  if (!value) return '—'
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/)
  return match ? match[3] ?? `${match[1]}-${match[2]}` : value.slice(0, 10)
}
