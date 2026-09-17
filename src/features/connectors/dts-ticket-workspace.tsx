import { CaretDown, CaretRight, MagnifyingGlass, SpinnerGap, X } from '@phosphor-icons/react'
import type { DtsFilterDefinition, DtsFilterId, DtsTicketDetail, DtsTicketListResult, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'

const DEFAULT_FILTERS: DtsFilterDefinition[] = [
  { id: 'myTodos', name: '待处理', count: null }, { id: 'myCreate', name: '我创建', count: null },
  { id: 'myProcessed', name: '曾处理', count: null }, { id: 'myFollowed', name: '我关注', count: null },
  { id: 'ccToMe', name: '抄送我', count: null },
]

type Props = {
  connected: boolean
  activeFilter: DtsFilterId
  tickets: DtsTicketListResult | null
  selectedId: string | null
  detail: DtsTicketDetail | null
  loading: boolean
  detailLoading: boolean
  keyword: string
  error: string | null
  onFilterChange: (filter: DtsFilterId) => void
  onKeywordChange: (value: string) => void
  onSearch: () => void
  onSelect: (ticket: DtsTicketSummary) => void
  onCloseDetail: () => void
  onPageChange: (page: number) => void
  onConnect: () => void
}

export function DtsTicketWorkspace(props: Props) {
  const activeFilterName = DEFAULT_FILTERS.find((filter) => filter.id === props.activeFilter)?.name ?? '当前视图'
  const selectedSummary = props.tickets?.items.find((ticket) => ticket.id === props.selectedId) ?? null
  if (!props.connected) return <DisconnectedState onConnect={props.onConnect} />
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-[46px] shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
        <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-[6px] border border-[var(--line)]">
          {DEFAULT_FILTERS.map((filter) => <button key={filter.id} type="button" onClick={() => props.onFilterChange(filter.id)} className={cn('flex min-w-[76px] items-center justify-center gap-1 border-r border-[var(--line)] px-2.5 text-[9.5px] font-medium outline-none last:border-r-0 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]', props.activeFilter === filter.id ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]' : 'bg-panel text-[var(--ink-soft)]')}>
            {filter.name}
          </button>)}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); props.onSearch() }} className="ml-auto flex h-8 min-w-[180px] max-w-[330px] flex-1 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 focus-within:border-[var(--accent)]">
          <MagnifyingGlass className="size-3.5 text-[var(--muted)]" />
          <input aria-label="搜索 DTS 工单" value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)} placeholder="输入工单号或关键词" className="min-w-0 flex-1 bg-transparent text-[9.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
        </form>
        <button type="button" className="flex h-8 items-center gap-1 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[9.5px] text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">严重程度<CaretDown className="size-3" /></button>
        <button type="button" className="flex h-8 items-center gap-1 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[9.5px] text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">当前状态<CaretDown className="size-3" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto" aria-busy={props.loading}>
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[28px_142px_minmax(250px,1.6fr)_86px_132px_146px_132px] items-center border-b border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[9px] font-semibold text-[var(--muted-strong)]">
            <span /><span>工单号</span><span>简要描述</span><span>严重程度</span><span>当前状态</span><span>当前处理人</span><span>创建时间</span>
          </div>
          {props.loading ? <LoadingRows label={`正在加载“${activeFilterName}”工单…`} /> : props.error ? <div className="flex h-36 items-center justify-center text-[10px] text-[var(--err-ink)]">{props.error}</div> : !props.tickets?.items.length ? <div className="flex h-36 items-center justify-center text-[10px] text-[var(--muted)]">当前视图没有可显示的工单</div> : props.tickets.items.map((ticket) => (
            <button key={ticket.id} type="button" onClick={() => props.onSelect(ticket)} className={cn('grid w-full grid-cols-[28px_142px_minmax(250px,1.6fr)_86px_132px_146px_132px] items-center border-b border-[var(--line)] px-3 py-2.5 text-left text-[9.5px] outline-none hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]', props.selectedId === ticket.id && 'bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] shadow-[inset_2px_0_var(--accent)]') }>
              <CaretRight className={cn('size-3 text-[var(--muted)] transition-transform', props.selectedId === ticket.id && 'rotate-90 text-[var(--accent-ink)]')} weight="bold" />
              <span className="truncate font-semibold text-[var(--accent-ink)]">{ticket.id}</span>
              <span className="truncate pr-4 font-medium text-[var(--ink)]">{ticket.title}</span>
              <Severity value={ticket.severity} />
              <span className="truncate text-[var(--ink-soft)]">{ticket.status}</span>
              <span className="truncate text-[var(--ink-soft)]">{ticket.currentHandler ?? '—'}</span>
              <span className="truncate tabular-nums text-[var(--muted-strong)]">{ticket.createdAt ?? '—'}</span>
            </button>
          ))}
        </div>
      </div>
      {props.tickets && props.tickets.total > props.tickets.pageSize ? <Pagination result={props.tickets} onPageChange={props.onPageChange} /> : null}
      {props.selectedId ? <TicketDetailPanel ticket={props.detail} summary={selectedSummary} loading={props.detailLoading} onClose={props.onCloseDetail} /> : null}
    </div>
  )
}

function DisconnectedState({ onConnect }: { onConnect: () => void }) {
  return <div className="flex min-h-0 flex-1 items-center justify-center px-8"><div className="max-w-[440px] text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-[10px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[17px] font-bold tracking-[-0.08em] text-[var(--accent-ink)]">DTS</div><h2 className="mt-4 text-[15px] font-semibold text-[var(--ink)]">连接你的 DTS 账号</h2><p className="mt-2 text-[10.5px] leading-5 text-[var(--muted-strong)]">Fouc 将在独立窗口打开 DTS 官方 SSO 页面。账号密码只提交给 DTS；连接后仅开放个人范围内的只读工单能力。</p><button type="button" onClick={onConnect} className="mt-5 h-8 rounded-[6px] bg-[var(--accent)] px-4 text-[10.5px] font-semibold text-white outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">打开 DTS 登录</button><p className="mt-3 text-[9px] text-[var(--muted)]">需要公司网络或 VPN · 凭证不进入模型上下文</p></div></div>
}

function Severity({ value }: { value: string | null }) {
  const critical = value?.includes('严重') || value === '1'
  return <span className="flex items-center gap-1.5 text-[var(--ink-soft)]"><span className={cn('size-1.5 rounded-full', critical ? 'bg-[#ec3f66]' : 'bg-[#f49b38]')} />{value ?? '一般'}</span>
}

function LoadingRows({ label = '正在读取 DTS 工单…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex h-36 items-center justify-center gap-2 text-[10px] text-[var(--muted)]"><SpinnerGap className="size-4 animate-spin text-[var(--accent-ink)]" />{label}</div>
}

function Pagination({ result, onPageChange }: { result: DtsTicketListResult; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  return <div className="flex h-9 shrink-0 items-center justify-end gap-3 border-t border-[var(--line)] px-3 text-[9px] text-[var(--muted)]"><span>共 {result.total} 条</span><button disabled={result.page <= 1} onClick={() => onPageChange(result.page - 1)} className="disabled:opacity-30">上一页</button><span className="font-medium text-[var(--ink-soft)]">{result.page} / {pages}</span><button disabled={result.page >= pages} onClick={() => onPageChange(result.page + 1)} className="disabled:opacity-30">下一页</button></div>
}

function TicketDetailPanel({ ticket, summary, loading, onClose }: { ticket: DtsTicketDetail | null; summary: DtsTicketSummary | null; loading: boolean; onClose: () => void }) {
  const productPath = ticket?.productPath.length ? ticket.productPath : summary?.productPath ?? []
  return <section aria-label="工单详情" className="h-[286px] shrink-0 border-t border-[var(--line-strong)] bg-panel">
    <header className="flex h-10 items-center border-b border-[var(--line)] px-3"><div className="min-w-0"><p className="truncate text-[10.5px] font-semibold text-[var(--ink)]">{ticket ? `${ticket.id}　${ticket.title}` : '正在读取工单详情'}</p></div><button type="button" onClick={onClose} aria-label="关闭工单详情" className="ml-auto flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] hover:bg-[var(--surface-hover)]"><X className="size-3.5" /></button></header>
    {loading ? <LoadingRows /> : ticket ? <div className="grid h-[245px] grid-cols-[112px_minmax(0,1fr)]"><nav className="border-r border-[var(--line)] bg-[var(--surface-subtle)] py-1"><span className="block border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[9.5px] font-semibold text-[var(--accent-ink)]">基本信息</span><span className="block px-3 py-2 text-[9.5px] text-[var(--muted-strong)]">流程进展　{ticket.flowNodes.length}</span><span className="block px-3 py-2 text-[9.5px] text-[var(--muted-strong)]">相关关联　{ticket.relations.length}</span><span className="block px-3 py-2 text-[9.5px] text-[var(--muted-strong)]">权限　{ticket.permissions.length}</span></nav><div className="overflow-auto px-5 py-3"><div className="grid grid-cols-2 gap-x-10 gap-y-2.5"><DetailRow label="工单号" value={ticket.id} /><DetailRow label="当前状态" value={ticket.status} /><DetailRow label="简要描述" value={ticket.title} wide /><DetailRow label="严重程度" value={ticket.severity ?? '—'} /><DetailRow label="当前处理人" value={ticket.currentHandler ?? '—'} /><DetailRow label="创建人" value={ticket.creator ?? '—'} /><DetailRow label="创建时间" value={ticket.createdAt ?? '—'} /><DetailRow label="产品路径" value={productPath.join(' / ') || '—'} wide />{ticket.fields.slice(0, 8).map((field) => <DetailRow key={field.key} label={field.label} value={field.value == null ? '—' : String(field.value)} />)}</div>{ticket.flowNodes.length ? <div className="mt-4 border-t border-[var(--line)] pt-3"><p className="mb-2 text-[9px] font-semibold text-[var(--muted-strong)]">流程进展</p><div className="flex min-w-max items-start">{ticket.flowNodes.slice(0, 8).map((node, index) => <div key={node.id} className="flex items-start"><div className="w-24 text-center"><span className="mx-auto block size-2 rounded-full bg-[var(--ok-ink)] ring-4 ring-[color-mix(in_srgb,var(--ok-ink)_10%,transparent)]" /><p className="mt-2 truncate text-[8.5px] text-[var(--ink-soft)]">{node.name}</p></div>{index < Math.min(ticket.flowNodes.length, 8) - 1 ? <span className="mt-1 h-px w-6 bg-[var(--line-strong)]" /> : null}</div>)}</div></div> : null}</div></div> : <div className="flex h-32 items-center justify-center text-[10px] text-[var(--err-ink)]">工单详情读取失败</div>}
  </section>
}

function DetailRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return <div className={cn('grid grid-cols-[82px_minmax(0,1fr)] gap-2 text-[9px]', wide && 'col-span-2')}><span className="text-[var(--muted)]">{label}</span><span className="truncate text-[var(--ink-soft)]" title={value}>{value}</span></div>
}
