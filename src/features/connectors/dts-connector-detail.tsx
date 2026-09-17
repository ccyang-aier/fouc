"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowsClockwise, CaretLeft, CheckCircle, DotsThree, SpinnerGap } from '@phosphor-icons/react'
import type { ConnectorDetailDto, DtsFilterDefinition, DtsFilterId, DtsTicketDetail, DtsTicketListResult, DtsTicketSummary } from '@fouc/shared'
import { cn } from '@/lib/utils'
import { clearDtsAuthProfile, connectorApi, openDtsAuthWindow } from './connector-api'
import { DtsConnectorInspector } from './dts-connector-inspector'
import { DtsTicketWorkspace } from './dts-ticket-workspace'

export function DtsConnectorDetail({ onBack, onConnectionChange }: { onBack: () => void; onConnectionChange: (connected: boolean) => void }) {
  const [detail, setDetail] = useState<ConnectorDetailDto | null>(null)
  const [filters, setFilters] = useState<DtsFilterDefinition[]>([])
  const [activeFilter, setActiveFilter] = useState<DtsFilterId>('myTodos')
  const [tickets, setTickets] = useState<DtsTicketListResult | null>(null)
  const [ticketDetail, setTicketDetail] = useState<DtsTicketDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const notify = useCallback((message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const loadTickets = useCallback(async (filter: DtsFilterId, page = 1, search = '') => {
    setLoading(true); setError(null)
    try { setTickets(await connectorApi.tickets({ filter, page, pageSize: 20, keyword: search.trim() || undefined })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'DTS 工单读取失败') }
    finally { setLoading(false) }
  }, [])

  const refreshDetail = useCallback(async () => {
    const next = await connectorApi.detail()
    setDetail(next)
    return next
  }, [])

  const loadConnectedData = useCallback(async () => {
    const [filterValues] = await Promise.all([connectorApi.filters(), loadTickets(activeFilter, 1)])
    setFilters(filterValues)
  }, [activeFilter, loadTickets])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void refreshDetail().then((value) => {
        if (!active) return
        if (value.instance.authState === 'valid') return loadConnectedData()
      }).catch((cause) => setError(cause instanceof Error ? cause.message : '连接器服务不可用')).finally(() => active && setLoading(false))
    }, 0)
    return () => { active = false; window.clearTimeout(timer); if (toastTimer.current) window.clearTimeout(toastTimer.current) }
  }, [refreshDetail, loadConnectedData])

  useEffect(() => {
    let disposed = false
    const unlisten: Array<() => void> = []
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      unlisten.push(await listen<{ instanceId?: string }>('connector://auth-completed', () => {
        void refreshDetail().then(loadConnectedData).then(() => { onConnectionChange(true); notify('DTS 已连接，身份与只读能力验证通过') }).finally(() => setBusy(false))
      }))
      const finishWithoutConnection = (message: string) => {
        if (disposed) return
        void refreshDetail().catch(() => undefined).finally(() => setBusy(false))
        notify(message)
      }
      unlisten.push(await listen<{ message?: string }>('connector://auth-failed', ({ payload }) => {
        finishWithoutConnection(payload.message ?? 'DTS 登录失败，请重试')
      }))
      unlisten.push(await listen('connector://auth-cancelled', () => {
        finishWithoutConnection('已取消 DTS 登录')
      }))
    }).catch(() => undefined)
    return () => { disposed = true; unlisten.forEach((stop) => stop()) }
  }, [loadConnectedData, notify, onConnectionChange, refreshDetail])

  async function connect() {
    setBusy(true); setError(null)
    try {
      const interaction = await connectorApi.connect()
      await openDtsAuthWindow(interaction)
      notify('已打开 DTS 官方登录窗口')
    } catch (cause) {
      setBusy(false)
      notify(cause instanceof Error ? cause.message : '无法打开 DTS 登录')
    }
  }

  async function heartbeat() {
    setBusy(true)
    try { await connectorApi.heartbeat(); await refreshDetail(); notify('连接正常，身份已重新确认') }
    catch (cause) { await refreshDetail().catch(() => undefined); notify(cause instanceof Error ? cause.message : '连接检测失败') }
    finally { setBusy(false) }
  }

  async function disconnect() {
    if (!window.confirm('断开 DTS 后会立即清除 sidecar 内存中的会话凭证。确定继续吗？')) return
    setBusy(true)
    try {
      await connectorApi.disconnect()
      let profileCleared = true
      try { await clearDtsAuthProfile() } catch { profileCleared = false }
      await refreshDetail(); setTickets(null); setFilters([]); setSelectedId(null); setTicketDetail(null); onConnectionChange(false)
      notify(profileCleared ? 'DTS 已断开，会话凭证已清除' : 'DTS 已断开；登录 Profile 清理失败，请重启 Fouc 后重试')
    }
    finally { setBusy(false) }
  }

  async function selectTicket(ticket: DtsTicketSummary) {
    setSelectedId(ticket.id); setTicketDetail(null); setDetailLoading(true)
    try { setTicketDetail(await connectorApi.ticket(ticket.id)) }
    catch (cause) { notify(cause instanceof Error ? cause.message : '工单详情读取失败') }
    finally { setDetailLoading(false) }
  }

  if (!detail) return <div className="flex h-full items-center justify-center gap-2 text-[10.5px] text-[var(--muted)]"><SpinnerGap className="size-4 animate-spin" />正在加载 DTS 连接器…</div>
  const connected = detail.instance.authState === 'valid'

  return (
    <section aria-label="DTS 连接器详情" className="relative flex h-full min-h-0 flex-col bg-panel">
      <header className="flex h-[42px] shrink-0 items-center border-b border-[var(--line)] px-[18px]">
        <button type="button" onClick={onBack} className="mr-2 flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="返回连接器列表"><CaretLeft className="size-3.5" weight="bold" /></button>
        <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]"><button type="button" onClick={onBack} className="hover:text-[var(--ink)]">连接器</button><span className="text-[var(--line-strong)]">/</span><strong className="font-medium text-[var(--muted-strong)]">DTS</strong></nav>
      </header>
      <div className="flex h-[76px] shrink-0 items-center border-b border-[var(--line)] px-[18px]">
        <span className="flex size-11 items-center justify-center rounded-[8px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[16px] font-bold tracking-[-0.08em] text-[var(--accent-ink)]">DTS</span>
        <div className="ml-3"><div className="flex items-center gap-2"><h1 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">DTS</h1>{connected ? <span className="flex items-center gap-1 text-[9.5px] font-semibold text-[var(--ok-ink)]"><CheckCircle className="size-3.5" weight="fill" />已连接</span> : null}<span className="rounded-[4px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[8.5px] font-semibold text-[var(--accent-ink)]">只读</span></div><p className="mt-1 text-[9.5px] text-[var(--muted)]">DTS 工单、流程、关联与权限 · 通过当前设备执行</p></div>
        <div className="ml-auto flex items-center gap-2"><button type="button" disabled={!connected || loading} onClick={() => void loadTickets(activeFilter, 1, keyword)} className="h-8 rounded-[6px] bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-white outline-none hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">查询工单</button><button type="button" disabled={!connected || busy} onClick={() => void heartbeat()} className="flex h-8 items-center gap-1.5 rounded-[6px] border border-[var(--line)] px-3 text-[9.5px] font-medium text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowsClockwise className={cn('size-3.5', busy && 'animate-spin')} />检测连接</button><button type="button" aria-label="更多操作" className="flex size-8 items-center justify-center rounded-[6px] border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"><DotsThree className="size-4" weight="bold" /></button></div>
      </div>
      <div className="flex h-[48px] shrink-0 items-center border-b border-[var(--line)] bg-[var(--surface-subtle)]/50 px-[18px] text-[9.5px]">
        <StatusCell label="连接状态" value={connected ? '已连接' : '未连接'} ok={connected} /><StatusCell label="最近心跳" value={formatHeartbeat(detail.instance.lastHeartbeatAt)} /><StatusCell label="数据范围" value="仅个人只读视图" />
      </div>
      <div className="flex min-h-0 flex-1">
        <DtsTicketWorkspace connected={connected} filters={filters} activeFilter={activeFilter} tickets={tickets} selectedId={selectedId} detail={ticketDetail} loading={loading} detailLoading={detailLoading} keyword={keyword} error={error}
          onFilterChange={(filter) => { setActiveFilter(filter); setSelectedId(null); setTicketDetail(null); void loadTickets(filter, 1, keyword) }} onKeywordChange={setKeyword} onSearch={() => void loadTickets(activeFilter, 1, keyword)} onSelect={(ticket) => void selectTicket(ticket)} onCloseDetail={() => { setSelectedId(null); setTicketDetail(null) }} onPageChange={(page) => void loadTickets(activeFilter, page, keyword)} onConnect={() => void connect()} />
        <DtsConnectorInspector detail={detail} busy={busy} onHeartbeat={() => void heartbeat()} onReconnect={() => void connect()} onDisconnect={() => void disconnect()} />
      </div>
      <div role="status" aria-live="polite" className={cn('pointer-events-none absolute bottom-5 left-1/2 z-50 flex -translate-x-1/2 translate-y-2 items-center gap-2 rounded-[7px] bg-[var(--ink)] px-3.5 py-2 text-[10px] font-medium text-white opacity-0 shadow-lg transition-[opacity,transform]', toast && 'translate-y-0 opacity-100')}><CheckCircle className="size-3.5" weight="fill" />{toast}</div>
    </section>
  )
}

function StatusCell({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return <div className="mr-8 flex min-w-[180px] items-center gap-3 border-r border-[var(--line)] pr-8 last:border-r-0"><span className="font-semibold text-[var(--ink-soft)]">{label}</span><span className={cn('flex items-center gap-1.5 text-[var(--muted-strong)]', ok && 'font-semibold text-[var(--ok-ink)]')}>{ok ? <span className="size-1.5 rounded-full bg-[var(--ok-ink)]" /> : null}{value}</span></div>
}

function formatHeartbeat(value: number | null): string {
  if (!value) return '尚未检测'
  const delta = Math.max(0, Date.now() - value)
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)
}
