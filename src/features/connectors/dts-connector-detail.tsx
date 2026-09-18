"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowsClockwise, CaretDown, CaretLeft, CheckCircle, DotsThree, SpinnerGap } from '@phosphor-icons/react'
import type { ConnectorDetailDto, DtsFilterId, DtsTicketDetail, DtsTicketListResult, DtsTicketSummary } from '@fouc/shared'
import { AppAlert, type AppAlertMessage, type AppAlertTone } from '@/components/app-alert'
import { cn } from '@/lib/utils'
import { clearDtsAuthProfile, connectorApi, openDtsAuthWindow } from './connector-api'
import { DtsConnectorInspector } from './dts-connector-inspector'
import { DtsTicketWorkspace } from './dts-ticket-workspace'

export function DtsConnectorDetail({ onBack, onConnectionChange }: { onBack: () => void; onConnectionChange: (connected: boolean) => void }) {
  const [detail, setDetail] = useState<ConnectorDetailDto | null>(null)
  const [activeFilter, setActiveFilter] = useState<DtsFilterId>('myTodos')
  const [tickets, setTickets] = useState<DtsTicketListResult | null>(null)
  const [ticketDetail, setTicketDetail] = useState<DtsTicketDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [authPending, setAuthPending] = useState(false)
  const [connectionLoading, setConnectionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alert, setAlert] = useState<AppAlertMessage | null>(null)
  const alertId = useRef(0)
  const ticketRequestId = useRef(0)
  const finalizingConnection = useRef(false)
  const connectionAnnounced = useRef(false)
  const authStartedAt = useRef(0)

  const notify = useCallback((tone: AppAlertTone, title: string, description?: string) => {
    setAlert({ id: ++alertId.current, tone, title, description })
  }, [])
  const dismissAlert = useCallback(() => setAlert(null), [])
  const announceConnection = useCallback(() => {
    if (connectionAnnounced.current) return
    connectionAnnounced.current = true
    notify('success', 'DTS 登录成功', '正在同步待处理工单，完成后即可开始使用')
  }, [notify])

  const loadTicketDetail = useCallback(async (ticket: DtsTicketSummary) => {
    setSelectedId(ticket.id); setTicketDetail(null); setDetailLoading(true)
    try { setTicketDetail(await connectorApi.ticket(ticket.id)) }
    catch (cause) { notify('error', '工单详情读取失败', cause instanceof Error ? cause.message : undefined) }
    finally { setDetailLoading(false) }
  }, [notify])

  const loadTickets = useCallback(async (filter: DtsFilterId, page = 1, search = '') => {
    const requestId = ++ticketRequestId.current
    setLoading(true); setError(null)
    try {
      const result = await connectorApi.tickets({ filter, page, pageSize: 20, keyword: search.trim() || undefined })
      if (requestId === ticketRequestId.current) {
        setTickets(result)
        const first = result.items[0]
        if (first) void loadTicketDetail(first)
        else { setSelectedId(null); setTicketDetail(null) }
      }
    } catch (cause) {
      if (requestId === ticketRequestId.current) setError(cause instanceof Error ? cause.message : 'DTS 工单读取失败')
    } finally {
      if (requestId === ticketRequestId.current) setLoading(false)
    }
  }, [loadTicketDetail])

  const refreshDetail = useCallback(async () => {
    const next = await connectorApi.detail()
    setDetail(next)
    return next
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void refreshDetail().then((value) => {
        if (!active) return
        if (value.instance.authState === 'valid') {
          setActiveFilter('myTodos')
          void loadTickets('myTodos', 1)
        } else {
          setLoading(false)
        }
      }).catch((cause) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : '连接器服务不可用')
        setLoading(false)
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [refreshDetail, loadTickets])

  const finishConnection = useCallback(async (next: ConnectorDetailDto) => {
    if (finalizingConnection.current) return
    finalizingConnection.current = true
    setConnectionLoading(true)
    setDetail(next)
    setActiveFilter('myTodos')
    setTickets(null)
    setSelectedId(null)
    setTicketDetail(null)
    setAuthPending(false)
    setBusy(false)
    onConnectionChange(true)
    announceConnection()
    try {
      await loadTickets('myTodos', 1)
    } finally {
      setConnectionLoading(false)
      finalizingConnection.current = false
    }
  }, [announceConnection, loadTickets, onConnectionChange])

  useEffect(() => {
    let disposed = false
    const unlisten: Array<() => void> = []

    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const completed = await listen<{ providerId?: string }>('connector://auth-completed', () => {
        if (disposed) return
        // 原生层在关闭登录窗口前发送该事件。此处必须先同步给出反馈，不能等待详情接口。
        setConnectionLoading(true)
        announceConnection()
        void connectorApi.detail().then((next) => {
          if (!disposed && next.instance.authState === 'valid') void finishConnection(next)
        }).catch(() => {
          // 轮询仍会接管短暂的 sidecar 不可用或事件早于状态落盘的情况。
        })
      })
      if (disposed) completed(); else unlisten.push(completed)

      const failed = await listen<{ providerId?: string; message?: string }>('connector://auth-failed', (event) => {
        if (disposed) return
        setConnectionLoading(false)
        setAuthPending(false)
        setBusy(false)
        notify('error', 'DTS 登录失败', event.payload.message ?? '请检查网络环境后重试')
      })
      if (disposed) failed(); else unlisten.push(failed)

      const cancelled = await listen<{ providerId?: string }>('connector://auth-cancelled', () => {
        if (disposed) return
        setConnectionLoading(false)
        setAuthPending(false)
        setBusy(false)
        notify('info', '已取消 DTS 登录')
      })
      if (disposed) cancelled(); else unlisten.push(cancelled)
    }).catch(() => undefined)

    return () => {
      disposed = true
      unlisten.forEach((stop) => stop())
    }
  }, [announceConnection, finishConnection, notify])

  useEffect(() => {
    if (!authPending) return
    let active = true
    let checking = false
    const check = async () => {
      if (!active || checking) return
      checking = true
      try {
        const next = await connectorApi.detail()
        if (!active) return
        if (next.instance.authState === 'valid') {
          void finishConnection(next)
        } else if (next.instance.authState !== 'connecting' && Date.now() - authStartedAt.current >= 3_000) {
          setDetail(next)
          notify('error', 'DTS 登录未完成', next.instance.lastErrorMessage ?? '请重新打开登录窗口后重试')
          setAuthPending(false)
          setBusy(false)
        }
      } catch {
        // sidecar 的瞬时重启或短暂不可用不应丢失一次仍在进行的官方登录。
      } finally {
        checking = false
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 250)
    return () => { active = false; window.clearInterval(timer) }
  }, [authPending, finishConnection, notify])

  async function connect() {
    connectionAnnounced.current = false
    setBusy(true); setConnectionLoading(false); setError(null)
    try {
      const interaction = await connectorApi.connect()
      authStartedAt.current = Date.now()
      setAuthPending(true)
      await openDtsAuthWindow(interaction)
      notify('info', 'DTS 登录窗口已打开', '请在官方 SSO 页面完成身份验证')
    } catch (cause) {
      setAuthPending(false); setBusy(false)
      notify('error', '无法打开 DTS 登录', cause instanceof Error ? cause.message : undefined)
    }
  }

  async function heartbeat() {
    setBusy(true)
    try { await connectorApi.heartbeat(); await refreshDetail(); notify('success', 'DTS 连接正常', '身份与会话状态已重新确认') }
    catch (cause) { await refreshDetail().catch(() => undefined); notify('error', 'DTS 连接检测失败', cause instanceof Error ? cause.message : undefined) }
    finally { setBusy(false) }
  }

  async function disconnect() {
    if (!window.confirm('断开 DTS 后会立即清除 sidecar 内存中的会话凭证。确定继续吗？')) return
    setAuthPending(false); setConnectionLoading(false); setBusy(true)
    try {
      ticketRequestId.current += 1
      await connectorApi.disconnect()
      let profileCleared = true
      try { await clearDtsAuthProfile() } catch { profileCleared = false }
      await refreshDetail(); setTickets(null); setLoading(false); setSelectedId(null); setTicketDetail(null); onConnectionChange(false)
      if (profileCleared) notify('success', 'DTS 已断开', '本地会话凭证已清除')
      else notify('warning', 'DTS 已断开', '登录 Profile 清理失败，请重启 Fouc 后重试')
    }
    finally { setBusy(false) }
  }

  if (!detail) return <div className="flex h-full items-center justify-center gap-2 text-[10.5px] text-[var(--muted)]"><SpinnerGap className="size-4 animate-spin" />正在加载 DTS 连接器…</div>
  if (connectionLoading) {
    return (
      <section aria-label="DTS 连接器连接处理中" className="relative flex h-full min-h-0 flex-col bg-panel">
        <ConnectionLoading />
        <AppAlert alert={alert} onClose={dismissAlert} />
      </section>
    )
  }
  const connected = detail.instance.authState === 'valid'

  return (
    <section aria-label="DTS 连接器详情" className="relative flex h-full min-h-0 flex-col bg-panel">
      <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[var(--line)] px-4">
        <button type="button" onClick={onBack} className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="返回连接器列表"><CaretLeft className="size-3.5" weight="bold" /></button>
        <Image src="/connector-logos/dts.svg" alt="" width={32} height={32} className="size-8 rounded-[8px]" />
        <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]">DTS 问题工作台</h1>{connected ? <span className="flex items-center gap-1 text-[8.5px] font-semibold text-[var(--ok-ink)]"><CheckCircle className="size-3" weight="fill" />已连接</span> : null}{connected && loading ? <span role="status" className="flex items-center gap-1 text-[8.5px] text-[var(--muted)]"><SpinnerGap className="size-3 animate-spin" />同步中</span> : null}</div><p className="mt-0.5 text-[8.5px] text-[var(--muted)]">工单 · 流程 · 关联 · 权限</p></div>
        <div className="ml-3 flex h-8 items-center gap-1.5 rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 text-[9px] text-[var(--ink-soft)] max-[900px]:hidden"><span className="size-1.5 rounded-full bg-[var(--ok-ink)]" />生产环境<CaretDown className="size-3 text-[var(--muted)]" /></div>
        <div className="ml-auto flex items-center gap-2"><span className="rounded-[5px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-2 py-1 text-[8.5px] font-semibold text-[var(--accent-ink)] max-[820px]:hidden">个人只读视图</span><button type="button" disabled={!connected || loading} onClick={() => void loadTickets(activeFilter, 1, keyword)} aria-label="刷新工单" className="flex size-8 items-center justify-center rounded-[7px] border border-[var(--line)] text-[var(--muted-strong)] outline-none hover:bg-[var(--surface-hover)] disabled:opacity-40"><ArrowsClockwise className={cn('size-3.5', loading && 'animate-spin')} /></button><button type="button" aria-label="更多操作" className="flex size-8 items-center justify-center rounded-[7px] border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-hover)]"><DotsThree className="size-4" weight="bold" /></button></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <DtsTicketWorkspace connected={connected} activeFilter={activeFilter} tickets={tickets} selectedId={selectedId} detail={ticketDetail} loading={loading} detailLoading={detailLoading} keyword={keyword} error={error}
          onFilterChange={(filter) => { setActiveFilter(filter); setSelectedId(null); setTicketDetail(null); void loadTickets(filter, 1, keyword) }} onKeywordChange={setKeyword} onSearch={() => void loadTickets(activeFilter, 1, keyword)} onSelect={(ticket) => void loadTicketDetail(ticket)} onPageChange={(page) => void loadTickets(activeFilter, page, keyword)} onConnect={() => void connect()} />
        <DtsConnectorInspector detail={detail} ticket={ticketDetail} summary={tickets?.items.find((ticket) => ticket.id === selectedId) ?? null} busy={busy} onHeartbeat={() => void heartbeat()} onReconnect={() => void connect()} onDisconnect={() => void disconnect()} />
      </div>
      <AppAlert alert={alert} onClose={dismissAlert} />
    </section>
  )
}

function ConnectionLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-0 flex-1 items-center justify-center bg-panel">
      <div className="flex w-[340px] flex-col items-center rounded-[14px] border border-[var(--line)] bg-[var(--elevated)] px-8 py-7 text-center shadow-[0_18px_50px_rgba(24,30,42,0.12)]">
        <span className="flex size-11 items-center justify-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
          <SpinnerGap className="size-5 animate-spin" weight="bold" aria-hidden />
        </span>
        <h2 className="mt-4 text-[13px] font-semibold text-[var(--ink)]">正在完成 DTS 连接</h2>
        <p className="mt-1.5 text-[9.5px] leading-4 text-[var(--muted-strong)]">身份验证已完成，正在同步连接状态和待处理工单…</p>
      </div>
    </div>
  )
}
