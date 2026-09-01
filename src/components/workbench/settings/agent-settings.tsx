"use client"

/**
 * Agent 纳管：设置页核心分区 —— 目录内全部受支持 Provider 的全量列表
 * （不只本机已发现的），提供搜索、可用性筛选、测试连接与纳管编辑。
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowClockwise, CaretDown, MagnifyingGlass, Plus, SpinnerGap, WifiSlash } from "@phosphor-icons/react"

import type { AgentEvent, AgentInstallation, ProviderSpec } from "@fouc/shared"
import { backendFetch, subscribeBackendEvents } from "@/lib/backend"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { pickBestInstallation, ProviderRow, type ProviderStatusKey } from "./provider-row"
import { ProviderAvatar } from "./provider-meta"
import { PanelHeader } from "./general-settings"

type AvailabilityTab = "all" | "available" | "unavailable"

export function AgentSettings() {
  const [providers, setProviders] = useState<ProviderSpec[]>([])
  const [installations, setInstallations] = useState<AgentInstallation[]>([])
  const [loading, setLoading] = useState(true)
  const [backendOnline, setBackendOnline] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<AvailabilityTab>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testingIds, setTestingIds] = useState<ReadonlySet<string>>(new Set())
  const [probingIds, setProbingIds] = useState<ReadonlySet<string>>(new Set())
  const [registeringIds, setRegisteringIds] = useState<ReadonlySet<string>>(new Set())
  const [testHints, setTestHints] = useState<ReadonlyMap<string, string>>(new Map())

  const upsertInstallation = useCallback((installation: AgentInstallation) => {
    setInstallations((prev) => {
      const next = prev.filter((item) => item.id !== installation.id)
      return [...next, installation]
    })
  }, [])

  const reload = useCallback(async () => {
    try {
      const [p, i] = await Promise.all([
        backendFetch<ProviderSpec[]>("/api/agents/providers"),
        backendFetch<AgentInstallation[]>("/api/agents/installations"),
      ])
      setProviders(p)
      setInstallations(i)
      setBackendOnline(true)
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
        if (event.type === "installation.changed") upsertInstallation(event.installation)
      }
    }, setBackendOnline)
    return () => {
      clearTimeout(initialLoad)
      close()
    }
  }, [reload, upsertInstallation])

  // ─── 派生：Provider 状态与排序 ──────────────────────────────────

  const installationsByProvider = useMemo(() => {
    const map = new Map<string, AgentInstallation[]>()
    for (const installation of installations) {
      const list = map.get(installation.providerId) ?? []
      list.push(installation)
      map.set(installation.providerId, list)
    }
    return map
  }, [installations])

  const statusByProvider = useMemo(() => {
    const map = new Map<string, ProviderStatusKey>()
    for (const provider of providers) {
      const list = installationsByProvider.get(provider.id) ?? []
      const best = pickBestInstallation(list)
      map.set(provider.id, best ? (best.status as ProviderStatusKey) : "not_installed")
    }
    return map
  }, [providers, installationsByProvider])

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      const readyA = statusByProvider.get(a.id) === "ready" ? 0 : 1
      const readyB = statusByProvider.get(b.id) === "ready" ? 0 : 1
      if (readyA !== readyB) return readyA - readyB
      return a.name.localeCompare(b.name)
    })
  }, [providers, statusByProvider])

  const availableCount = useMemo(
    () => [...statusByProvider.values()].filter((status) => status === "ready").length,
    [statusByProvider]
  )

  const visibleProviders = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return sortedProviders.filter((provider) => {
      const status = statusByProvider.get(provider.id)
      if (tab === "available" && status !== "ready") return false
      if (tab === "unavailable" && status === "ready") return false
      if (normalized && !`${provider.name} ${provider.cliCommand}`.toLowerCase().includes(normalized)) return false
      return true
    })
  }, [sortedProviders, statusByProvider, tab, query])

  const unregisteredProviders = useMemo(
    () => sortedProviders.filter((provider) => statusByProvider.get(provider.id) === "not_installed"),
    [sortedProviders, statusByProvider]
  )

  // ─── 操作 ──────────────────────────────────────────────────────

  async function refreshAll() {
    setRefreshing(true)
    try {
      await backendFetch("/api/agents/refresh", { method: "POST" })
      await reload()
    } catch {
      /* 状态由 WS/在线标记体现 */
    } finally {
      setRefreshing(false)
    }
  }

  async function testProvider(providerId: string) {
    setTestingIds((prev) => new Set(prev).add(providerId))
    setTestHints((prev) => {
      const next = new Map(prev)
      next.delete(providerId)
      return next
    })
    try {
      const data = await backendFetch<{ installation: AgentInstallation | null }>(
        `/api/agents/providers/${providerId}/test`,
        { method: "POST" }
      )
      if (data.installation) {
        upsertInstallation(data.installation)
      } else {
        const provider = providers.find((item) => item.id === providerId)
        setTestHints((prev) =>
          new Map(prev).set(providerId, `未在 PATH 中找到「${provider?.cliCommand ?? providerId}」命令`)
        )
      }
    } catch (error) {
      setTestHints((prev) => new Map(prev).set(providerId, `测试失败：${errorText(error)}`))
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  async function healthCheck(installationId: string) {
    setProbingIds((prev) => new Set(prev).add(installationId))
    try {
      const updated = await backendFetch<AgentInstallation>(
        `/api/agents/installations/${installationId}/health-check`,
        { method: "POST" }
      )
      upsertInstallation(updated)
    } catch {
      /* 失败详情以 WS 推送与实例错误字段为准 */
    } finally {
      setProbingIds((prev) => {
        const next = new Set(prev)
        next.delete(installationId)
        return next
      })
    }
  }

  async function toggleEnabled(installation: AgentInstallation) {
    try {
      const updated = await backendFetch<AgentInstallation>(
        `/api/agents/installations/${installation.id}/enabled`,
        { method: "PATCH", body: JSON.stringify({ enabled: !installation.enabled }) }
      )
      upsertInstallation(updated)
    } catch {
      /* 忽略 */
    }
  }

  async function setDefault(installationId: string) {
    try {
      const updated = await backendFetch<AgentInstallation>(
        `/api/agents/installations/${installationId}/set-default`,
        { method: "POST" }
      )
      setInstallations((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : { ...item, isDefault: false }))
      )
    } catch {
      /* 忽略 */
    }
  }

  async function removeInstallation(installationId: string) {
    await backendFetch(`/api/agents/installations/${installationId}`, { method: "DELETE" }).catch(() => {})
    setInstallations((prev) => prev.filter((item) => item.id !== installationId))
  }

  async function registerPath(providerId: string, executablePath: string) {
    setRegisteringIds((prev) => new Set(prev).add(providerId))
    try {
      const installation = await backendFetch<AgentInstallation>("/api/agents/installations", {
        method: "POST",
        body: JSON.stringify({ providerId, executablePath }),
      })
      upsertInstallation(installation)
      setTestHints((prev) => {
        const next = new Map(prev)
        next.delete(providerId)
        return next
      })
    } catch (error) {
      setTestHints((prev) => new Map(prev).set(providerId, `登记失败：${errorText(error)}`))
    } finally {
      setRegisteringIds((prev) => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  /** 从「登记 Agent 路径」下拉定位到某个未登记产品：清筛选、展开并滚动 */
  function focusProvider(providerId: string) {
    setQuery("")
    setTab("all")
    setExpandedId(providerId)
    requestAnimationFrame(() => {
      document
        .getElementById(`provider-row-${providerId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  const tabs: Array<{ id: AvailabilityTab; label: string; count: number }> = [
    { id: "all", label: "全部", count: providers.length },
    { id: "available", label: "可用", count: availableCount },
    { id: "unavailable", label: "不可用", count: providers.length - availableCount },
  ]

  return (
    <div className="mx-auto w-full max-w-[960px] px-10 pb-14 pt-12 max-[1100px]:px-7 max-[900px]:pt-8">
      <PanelHeader
        title="Agent 纳管"
        description={`管理本机可用的 AI Agent —— ${installations.length} 个已登记实例 / ${providers.length} 种受支持产品。`}
      />

      {loading ? (
        <LoadingState />
      ) : !backendOnline ? (
        <OfflineState onRetry={() => void reload()} />
      ) : (
        <>
          {/* 工具栏 */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative">
              <MagnifyingGlass
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 Agent…"
                aria-label="搜索 Agent"
                className="h-8 w-[220px] rounded-[9px] border border-[#e3e5e8] bg-white pl-8 pr-3 text-[12px] outline-none transition-[border-color,box-shadow] placeholder:text-[#b6bcc4] focus:border-[var(--accent)]/55 focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                className="h-8 rounded-[9px] px-2.5 text-[11.5px]"
              >
                <ArrowClockwise className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
                刷新发现
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 rounded-[9px] px-2.5 text-[11.5px]">
                    <Plus className="size-3.5" weight="bold" aria-hidden />
                    登记 Agent 路径
                    <CaretDown className="size-3" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-0">
                  <ScrollArea className="max-h-[320px]" viewportClassName="p-1.5">
                    {unregisteredProviders.length === 0 ? (
                      <DropdownMenuItem disabled>全部受支持产品均已登记</DropdownMenuItem>
                    ) : (
                      unregisteredProviders.map((provider) => (
                        <DropdownMenuItem key={provider.id} onSelect={() => focusProvider(provider.id)}>
                          <ProviderAvatar providerId={provider.id} name={provider.name} className="size-5 rounded-md text-[9px]" />
                          <span className="truncate">{provider.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-[var(--muted)]">{provider.cliCommand}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 可用性 Tab */}
          <div role="tablist" aria-label="按可用性筛选" className="mt-4 flex items-center gap-5 border-b border-[#eceef1] px-1">
            {tabs.map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "relative flex h-8 items-center gap-1.5 text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    active ? "font-medium text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] leading-[16px]",
                      active ? "bg-[rgba(13,168,135,0.12)] text-[var(--accent-strong)]" : "bg-black/[0.05] text-[var(--muted-strong)]"
                    )}
                  >
                    {item.count}
                  </span>
                  {active && (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--ink)]" aria-hidden />
                  )}
                </button>
              )
            })}
          </div>

          {/* Provider 列表 */}
          <div className="mt-3 space-y-2">
            {visibleProviders.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-[#dcdfe4] bg-white px-6 py-10 text-center text-[12.5px] text-[var(--muted)]">
                没有匹配「{query}」的 Agent
              </p>
            ) : (
              visibleProviders.map((provider) => {
                const list = installationsByProvider.get(provider.id) ?? []
                return (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    installations={list}
                    statusKey={statusByProvider.get(provider.id) ?? "not_installed"}
                    expanded={expandedId === provider.id}
                    testing={testingIds.has(provider.id)}
                    testHint={testHints.get(provider.id) ?? null}
                    probingIds={probingIds}
                    registering={registeringIds.has(provider.id)}
                    onToggleExpand={() => setExpandedId((current) => (current === provider.id ? null : provider.id))}
                    onTest={() => void testProvider(provider.id)}
                    onHealthCheck={(id) => void healthCheck(id)}
                    onToggleEnabled={(installation) => void toggleEnabled(installation)}
                    onSetDefault={(id) => void setDefault(id)}
                    onRemove={(id) => void removeInstallation(id)}
                    onRegisterPath={(path) => void registerPath(provider.id, path)}
                  />
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── 辅助 ──────────────────────────────────────────────────────────

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function LoadingState() {
  return (
    <div className="mt-6 space-y-2" aria-label="加载中" aria-busy>
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="flex h-[58px] items-center gap-3 rounded-[12px] border border-[#f0f1f3] bg-white px-4"
        >
          <span className="size-9 animate-pulse rounded-[10px] bg-[#f0f1f3]" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-2.5 w-32 animate-pulse rounded-full bg-[#f0f1f3]" />
            <span className="block h-2 w-56 animate-pulse rounded-full bg-[#f5f6f7]" />
          </span>
        </div>
      ))}
      <p className="flex items-center justify-center gap-1.5 pt-2 text-[11.5px] text-[var(--muted)]">
        <SpinnerGap className="size-3.5 animate-spin" aria-hidden />
        正在加载 Agent 目录…
      </p>
    </div>
  )
}

function OfflineState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-[12px] border border-dashed border-[#e3d6d4] bg-white px-6 py-12 text-center">
      <WifiSlash className="mb-3 size-7 text-[#c4cad2]" aria-hidden />
      <p className="text-[13px] font-medium text-[#4b5563]">无法连接后端服务</p>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--muted)]">
        Agent 目录与纳管操作依赖本地 sidecar 服务（127.0.0.1）。请确认后端进程已启动后重试。
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <ArrowClockwise className="size-3.5" aria-hidden />
        重试连接
      </Button>
    </div>
  )
}
