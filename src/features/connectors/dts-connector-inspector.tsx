import { ArrowsClockwise, CheckCircle, Desktop, Heartbeat, Key, ShieldCheck, SignOut, WarningCircle } from '@phosphor-icons/react'
import type { ConnectorDetailDto } from '@fouc/shared'
import { cn } from '@/lib/utils'

type Props = {
  detail: ConnectorDetailDto
  busy: boolean
  onHeartbeat: () => void
  onReconnect: () => void
  onDisconnect: () => void
}

export function DtsConnectorInspector({ detail, busy, onHeartbeat, onReconnect, onDisconnect }: Props) {
  const { instance } = detail
  const connected = instance.authState === 'valid'
  return (
    <aside aria-label="连接器信息" className="min-h-0 w-[268px] shrink-0 overflow-y-auto border-l border-[var(--line)] bg-[var(--surface-subtle)]/35">
      <div className="flex h-11 items-center justify-between border-b border-[var(--line)] px-4">
        <h2 className="text-[11.5px] font-semibold text-[var(--ink)]">连接器信息</h2>
        <span className="text-[9px] text-[var(--muted)]">v{detail.provider.version}</span>
      </div>
      <InspectorSection title="连接状态" icon={ShieldCheck}>
        <div className={cn('flex items-start gap-2', connected ? 'text-[var(--ok-ink)]' : 'text-[var(--warn-ink)]')}>
          {connected ? <CheckCircle className="mt-0.5 size-4" weight="fill" /> : <WarningCircle className="mt-0.5 size-4" weight="fill" />}
          <div><p className="text-[11px] font-semibold">{connected ? '已连接' : authLabel(instance.authState)}</p><p className="mt-0.5 text-[9.5px] font-normal text-[var(--muted)]">{instance.lastErrorMessage ?? (connected ? '身份已确认，服务可用' : '需要完成 DTS 官方登录')}</p></div>
        </div>
      </InspectorSection>
      <InspectorSection title="当前设备" icon={Desktop}>
        <DataRow label="执行位置" value="本机 sidecar" />
        <DataRow label="设备标识" value={instance.executionTargetId} mono />
        <DataRow label="运行状态" value={instance.executionState === 'online' ? '在线' : '离线'} />
      </InspectorSection>
      <InspectorSection title="凭证与会话" icon={Key}>
        <DataRow label="认证账号" value={instance.identity?.account ?? instance.identity?.displayName ?? '未认证'} />
        <DataRow label="权限范围" value="只读（个人视图）" />
        <DataRow label="会话状态" value={connected ? '内存会话有效' : '无可用会话'} />
        <p className="mt-2 border-l-2 border-[var(--line-strong)] pl-2 text-[9px] leading-4 text-[var(--muted)]">Cookie 不进入数据库、日志或模型上下文；sidecar 退出后需从受管 SSO 会话重新建立。</p>
      </InspectorSection>
      <InspectorSection title="最近心跳" icon={Heartbeat}>
        <DataRow label="最后一次" value={formatTime(instance.lastHeartbeatAt)} />
        <DataRow label="响应耗时" value={instance.lastHeartbeatDurationMs == null ? '—' : `${instance.lastHeartbeatDurationMs} ms`} />
        <DataRow label="健康状态" value={healthLabel(instance.healthState)} />
        <button type="button" disabled={busy || !connected} onClick={onHeartbeat} className="mt-3 flex h-7 w-full items-center justify-center gap-1.5 rounded-[5px] border border-[var(--line)] bg-panel text-[9.5px] font-medium text-[var(--ink-soft)] outline-none hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <ArrowsClockwise className={cn('size-3', busy && 'animate-spin')} />检测连接
        </button>
      </InspectorSection>
      <div className="space-y-2 border-t border-[var(--line)] p-4">
        <button type="button" disabled={busy} onClick={onReconnect} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-ink)] outline-none hover:border-[var(--accent)] disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowsClockwise className="size-3.5" />{connected ? '重新连接' : '连接 DTS'}</button>
        {connected ? <button type="button" disabled={busy} onClick={onDisconnect} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] border border-[color-mix(in_srgb,var(--err-ink)_24%,var(--line))] bg-panel text-[10px] font-medium text-[var(--err-ink)] outline-none hover:bg-[color-mix(in_srgb,var(--err-ink)_5%,var(--panel))] disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><SignOut className="size-3.5" />断开连接</button> : null}
      </div>
    </aside>
  )
}

function InspectorSection({ title, icon: Icon, children }: { title: string; icon: typeof ShieldCheck; children: React.ReactNode }) {
  return <section className="border-b border-[var(--line)] px-4 py-3.5"><div className="mb-3 flex items-center gap-1.5 text-[9.5px] font-semibold text-[var(--muted-strong)]"><Icon className="size-3.5 text-[var(--accent-ink)]" />{title}</div><div className="space-y-2">{children}</div></section>
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[66px_minmax(0,1fr)] gap-2 text-[9.5px]"><span className="text-[var(--muted)]">{label}</span><span className={cn('truncate text-right text-[var(--ink-soft)]', mono && 'font-mono text-[8.5px]')}>{value}</span></div>
}

function formatTime(value: number | null): string {
  return value ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value) : '尚未检测'
}

function authLabel(value: string): string {
  return ({ unconfigured: '未连接', connecting: '等待登录', needs_user_action: '需要重新登录', expired: '会话已过期', error: '连接异常' } as Record<string, string>)[value] ?? '未连接'
}

function healthLabel(value: string): string {
  return ({ healthy: '正常', degraded: '需要关注', unreachable: '无法访问', unknown: '尚未检测' } as Record<string, string>)[value] ?? value
}
