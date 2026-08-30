"use client"

/**
 * Agent 资产页：Provider 分组的安装实例列表、健康状态与能力清单、
 * 发现/探测操作，以及选中 Agent 的会话控制台（端到端闭环入口）。
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowClockwise,
  ChatCircleDots,
  CheckCircle,
  DownloadSimple,
  FirstAid,
  Flag,
  Pause,
  Play,
  ShieldWarning,
  SignOut,
  SpinnerGap,
  StopCircle,
  TrashSimple,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react"

import type { AgentEvent, AgentInstallation, ProviderSpec } from "@fouc/shared"
import { backendFetch, subscribeBackendEvents } from "@/lib/backend"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SessionConsole } from "./session-console"

// ─── 状态徽章 ──────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  ready: { label: "就绪", className: "bg-[#e8f6ef] text-[#1f8a5f] border-[#bfe5d3]", icon: CheckCircle },
  needs_auth: { label: "需要登录", className: "bg-[#fdf3e2] text-[#a06b12] border-[#f0dcae]", icon: ShieldWarning },
  needs_runtime: { label: "缺运行时", className: "bg-[#fdf3e2] text-[#a06b12] border-[#f0dcae]", icon: DownloadSimple },
  incompatible: { label: "不兼容", className: "bg-[#fdecec] text-[#b3413c] border-[#f2c7c4]", icon: XCircle },
  unhealthy: { label: "异常", className: "bg-[#fdecec] text-[#b3413c] border-[#f2c7c4]", icon: WarningCircle },
  disabled: { label: "已停用", className: "bg-[#f1f2f4] text-[#6b7280] border-[#dcdfe4]", icon: Pause },
  missing: { label: "路径丢失", className: "bg-[#f1f2f4] text-[#6b7280] border-[#dcdfe4]", icon: SignOut },
  unchecked: { label: "待探测", className: "bg-[#eef3fb] text-[#3f6db5] border-[#cddcf2]", icon: SpinnerGap },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.unchecked
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.className
      )}
    >
      <Icon size={12} weight="bold" aria-hidden />
      {meta.label}
    </span>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────────

export function AgentsCanvas() {
  const [providers, setProviders] = useState<ProviderSpec[]>([])
  const [installations, setInstallations] = useState<AgentInstallation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [p, i] = await Promise.all([
        backendFetch<ProviderSpec[]>("/api/agents/providers"),
        backendFetch<AgentInstallation[]>("/api/agents/installations"),
      ])
      setProviders(p)
      setInstallations(i)
      setBackendOnline(true)
      setSelectedId((current) => current ?? i.find((x) => x.status === "ready")?.id ?? i[0]?.id ?? null)
    } catch {
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 延后一帧发起首次加载，避免在 effect 体内同步触发级联 setState
    const initialLoad = setTimeout(() => void reload(), 0)
    const close = subscribeBackendEvents((envelope) => {
      if (envelope.topic === "agents.installationChanged") {
        const event = envelope.payload as AgentEvent
        if (event.type === "installation.changed") {
          setInstallations((prev) => {
            const next = prev.filter((x) => x.id !== event.installation.id)
            return [...next, event.installation].sort((a, b) => a.providerId.localeCompare(b.providerId))
          })
        }
      }
    }, setBackendOnline)
    return () => {
      clearTimeout(initialLoad)
      close()
    }
  }, [reload])

  const grouped = useMemo(() => {
    const map = new Map<string, AgentInstallation[]>()
    for (const installation of installations) {
      const list = map.get(installation.providerId) ?? []
      list.push(installation)
      map.set(installation.providerId, list)
    }
    return map
  }, [installations])

  const providerName = useCallback(
    (id: string) => providers.find((p) => p.id === id)?.name ?? id,
    [providers]
  )

  async function refreshAll() {
    setRefreshing(true)
    try {
      await backendFetch("/api/agents/refresh", { method: "POST" })
      await reload()
    } finally {
      setRefreshing(false)
    }
  }

  async function healthCheck(id: string) {
    await backendFetch(`/api/agents/installations/${id}/health-check`, { method: "POST" }).catch(() => {})
  }

  async function toggleEnabled(installation: AgentInstallation) {
    await backendFetch(`/api/agents/installations/${installation.id}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !installation.enabled }),
    }).catch(() => {})
  }

  async function setDefault(id: string) {
    await backendFetch(`/api/agents/installations/${id}/set-default`, { method: "POST" }).catch(() => {})
  }

  async function removeInstallation(id: string) {
    await backendFetch(`/api/agents/installations/${id}`, { method: "DELETE" }).catch(() => {})
    setInstallations((prev) => prev.filter((x) => x.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const selected = installations.find((x) => x.id === selectedId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Agent 资产">
      {/* 页头 */}
      <header className="flex items-center justify-between border-b border-[#eceef1] px-8 py-5">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Agent 资产</h1>
          <p className="mt-0.5 text-[12.5px] text-[#8a919b]">
            本机 Agent 的发现、健康与能力清单 —— {installations.length} 个已登记实例 / {providers.length} 种受支持产品
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              backendOnline
                ? "border-[#bfe5d3] bg-[#e8f6ef] text-[#1f8a5f]"
                : "border-[#f2c7c4] bg-[#fdecec] text-[#b3413c]"
            )}
            role="status"
          >
            <span className={cn("size-1.5 rounded-full", backendOnline ? "bg-[#1f8a5f]" : "bg-[#b3413c] animate-pulse")} />
            {backendOnline ? "后端在线" : "后端连接中…"}
          </span>
          <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={refreshing}>
            <ArrowClockwise className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
            刷新发现
          </Button>
        </div>
      </header>

      {/* 主体：左列表 + 右详情/控制台 */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(380px,1fr)_minmax(360px,1.1fr)] max-[1100px]:grid-cols-1">
        <section className="min-h-0 overflow-y-auto px-6 py-5" aria-label="已发现 Agent">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-[13px] text-[#8a919b]">
              <SpinnerGap className="mr-2 size-4 animate-spin" aria-hidden />
              正在发现本机 Agent…
            </div>
          ) : installations.length === 0 ? (
            <EmptyState onRefresh={() => void refreshAll()} />
          ) : (
            <div className="space-y-5">
              {[...grouped.entries()].map(([providerId, list]) => (
                <div key={providerId}>
                  <div className="mb-1.5 flex items-center gap-2 px-1">
                    <span className="text-[12px] font-semibold text-[#4b5563]">{providerName(providerId)}</span>
                    <span className="text-[11px] text-[#a2a9b3]">{list.length > 1 ? `${list.length} 个实例` : ""}</span>
                  </div>
                  <div className="space-y-1.5">
                    {list.map((installation) => (
                      <InstallationRow
                        key={installation.id}
                        installation={installation}
                        providerName={providerName(providerId)}
                        selected={installation.id === selectedId}
                        expanded={installation.id === expandedId}
                        onSelect={() => setSelectedId(installation.id)}
                        onToggleExpand={() => setExpandedId((cur) => (cur === installation.id ? null : installation.id))}
                        onHealthCheck={() => void healthCheck(installation.id)}
                        onToggleEnabled={() => void toggleEnabled(installation)}
                        onSetDefault={() => void setDefault(installation.id)}
                        onRemove={() => void removeInstallation(installation.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="min-h-0 overflow-y-auto border-l border-[#eceef1] bg-[#fbfbfc]" aria-label="会话控制台">
          {selected ? (
            <SessionConsole installation={selected} providerName={providerName(selected.providerId)} />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-[13px] text-[#8a919b]">
              选择左侧一个 Agent 查看能力详情并启动会话控制台
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ─── 安装实例行 ────────────────────────────────────────────────────

function InstallationRow(props: {
  installation: AgentInstallation
  providerName: string
  selected: boolean
  expanded: boolean
  onSelect: () => void
  onToggleExpand: () => void
  onHealthCheck: () => void
  onToggleEnabled: () => void
  onSetDefault: () => void
  onRemove: () => void
}) {
  const { installation } = props
  const manifest = installation.capabilityManifest

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        props.selected ? "border-[#9b80dc]/50 bg-[#f7f4fd]" : "border-[#eceef1] bg-white hover:border-[#dcdfe4]"
      )}
    >
      <button
        type="button"
        onClick={props.onSelect}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-label={`${props.providerName} 安装详情`}
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f1ecfa] text-[13px] font-semibold text-[#6c5bb3]">
          {props.providerName.slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium">{props.providerName}</span>
            {installation.isDefault && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#eef3fb] px-1.5 py-px text-[10.5px] font-medium text-[#3f6db5]">
                <Flag size={10} aria-hidden />
                默认
              </span>
            )}
            <StatusBadge status={installation.status} />
            {manifest && (
              <span className="rounded-full border border-[#dcdfe4] px-1.5 py-px text-[10.5px] font-medium text-[#6b7280]">
                {manifest.adapterLevel}
              </span>
            )}
          </span>
          <span className="mt-1 block truncate text-[11.5px] text-[#8a919b]" title={installation.executablePath}>
            {installation.version ? `v${installation.version} · ` : ""}
            {installation.executablePath}
          </span>
          {installation.lastErrorMessage && (
            <span className="mt-1 block text-[11px] text-[#b3413c]" role="alert">
              {installation.lastErrorCode}: {installation.lastErrorMessage}
            </span>
          )}
        </span>
      </button>

      <div className="flex items-center gap-1 border-t border-[#f2f3f5] px-3 py-1.5">
        <RowAction label="健康检查" onClick={props.onHealthCheck}>
          <FirstAid className="size-3.5" aria-hidden />
        </RowAction>
        <RowAction label={installation.enabled ? "停用" : "启用"} onClick={props.onToggleEnabled}>
          {installation.enabled ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </RowAction>
        <RowAction label="设为默认" onClick={props.onSetDefault}>
          <Flag className="size-3.5" aria-hidden />
        </RowAction>
        <RowAction label="解除纳管" onClick={props.onRemove} danger>
          <TrashSimple className="size-3.5" aria-hidden />
        </RowAction>
        <button
          type="button"
          onClick={props.onToggleExpand}
          className="ml-auto rounded-md px-2 py-1 text-[11.5px] text-[#6b7280] hover:bg-[#f1f2f4]"
          aria-expanded={props.expanded}
        >
          {props.expanded ? "收起能力" : "能力清单"}
        </button>
      </div>

      {props.expanded && manifest && <CapabilityPanel manifest={manifest} />}
      {props.expanded && !manifest && (
        <p className="border-t border-[#f2f3f5] px-4 py-3 text-[12px] text-[#8a919b]">
          尚无能力清单 —— 完成一次健康检查后生成。
        </p>
      )}
    </div>
  )
}

function RowAction(props: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        props.danger ? "text-[#b3413c] hover:bg-[#fdecec]" : "text-[#6b7280] hover:bg-[#f1f2f4]"
      )}
    >
      {props.children}
    </button>
  )
}

// ─── 能力清单面板 ──────────────────────────────────────────────────

function CapabilityPanel({ manifest }: { manifest: NonNullable<AgentInstallation["capabilityManifest"]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[#f2f3f5] px-4 py-3 text-[11.5px]">
      <Capability label="协议" value={`ACP v${manifest.protocol.version}`} />
      <Capability label="Agent 身份" value={manifest.agentName ?? "—"} />
      <Capability label="会话恢复" value={manifest.session.resume ? "支持" : "不支持"} />
      <Capability label="会话分叉" value={manifest.session.fork ? "支持" : "不支持"} />
      <Capability label="图片输入" value={manifest.input.image ? "支持" : "不支持"} />
      <Capability
        label="MCP"
        value={["stdio", "http", "sse"].filter((k) => manifest.extensions.mcp[k as "stdio"]).join(" / ") || "未声明"}
      />
      <Capability label="可用模型" value={`${manifest.controls.models.length} 个`} />
      <Capability label="权限模式" value={`${manifest.controls.modes.length} 个`} />
      {manifest.controls.modes.length > 0 && (
        <div className="col-span-2 flex flex-wrap gap-1">
          {manifest.controls.modes.slice(0, 8).map((mode) => (
            <span key={mode.id} className="rounded border border-[#eceef1] bg-white px-1.5 py-0.5 text-[10.5px] text-[#6b7280]">
              {mode.name}
            </span>
          ))}
        </div>
      )}
      {manifest.controls.models.slice(0, 6).map((model) => (
        <div key={model.id} className="flex items-center gap-1.5">
          <dt className="text-[#8a919b]">模型</dt>
          <dd className="truncate font-mono text-[10.5px] text-[#4b5563]">{model.id}</dd>
        </div>
      ))}
    </dl>
  )
}

function Capability({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="shrink-0 text-[#8a919b]">{label}</dt>
      <dd className="truncate font-medium text-[#4b5563]">{value}</dd>
    </div>
  )
}

// ─── 空状态 ────────────────────────────────────────────────────────

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#dcdfe4] px-6 py-12 text-center">
      <ChatCircleDots className="mb-3 size-8 text-[#c4cad2]" aria-hidden />
      <p className="text-[13px] font-medium text-[#4b5563]">未发现本机 Agent</p>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[#8a919b]">
        Fouc 支持 Claude Code、Codex、OpenCode、Qwen Code、Goose 等 16 种 CLI Agent 的自动纳管。
        安装任意一种后点击刷新，或稍候启动探测自动登记。
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
        <ArrowClockwise className="size-3.5" aria-hidden />
        重新扫描
      </Button>
    </div>
  )
}

export { StopCircle }
