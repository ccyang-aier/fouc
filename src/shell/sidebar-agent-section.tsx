"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CaretDown, Plus, Robot, X } from "@phosphor-icons/react"

import type { AgentInstallation, ProviderSpec } from "@fouc/shared"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProviderAvatar } from "@/features/settings/provider-meta"
import { backendFetch } from "@/lib/backend"
import { cn } from "@/lib/utils"

type SidebarAgent = {
  id: string
  name: string
  providerId: string | null
  builtIn?: boolean
}

const UC_AGENT: SidebarAgent = {
  id: "uc-agent",
  name: "UC Agent",
  providerId: null,
  builtIn: true,
}

export function SidebarAgentSection({
  compact = false,
  activeAgentId,
  onAgentSelect,
}: {
  compact?: boolean
  activeAgentId: string | null
  onAgentSelect: (agentId: string) => void
}) {
  const [open, setOpen] = useState(!compact)
  const [agents, setAgents] = useState<SidebarAgent[]>([UC_AGENT])
  const [providers, setProviders] = useState<ProviderSpec[]>([])
  const [installations, setInstallations] = useState<AgentInstallation[]>([])
  const [loading, setLoading] = useState(false)
  const [backendOnline, setBackendOnline] = useState(true)

  const loadAvailableAgents = useCallback(async () => {
    setLoading(true)
    try {
      const [nextProviders, nextInstallations] = await Promise.all([
        backendFetch<ProviderSpec[]>("/api/agents/providers"),
        backendFetch<AgentInstallation[]>("/api/agents/installations"),
      ])
      setProviders(nextProviders)
      setInstallations(nextInstallations)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadAvailableAgents(), 0)
    return () => clearTimeout(initialLoad)
  }, [loadAvailableAgents])

  const addableProviders = useMemo(() => {
    const addedProviderIds = new Set(agents.flatMap((agent) => agent.providerId ? [agent.providerId] : []))
    const readyProviderIds = new Set(
      installations
        .filter((installation) => installation.enabled && installation.status === "ready")
        .map((installation) => installation.providerId),
    )
    return providers.filter((provider) => readyProviderIds.has(provider.id) && !addedProviderIds.has(provider.id))
  }, [agents, installations, providers])

  function addAgent(provider: ProviderSpec) {
    const id = `local-${provider.id}`
    setAgents((current) => [...current, { id, name: provider.name, providerId: provider.id }])
    onAgentSelect(id)
    setOpen(true)
  }

  function removeAgent(agentId: string) {
    setAgents((current) => current.filter((agent) => agent.id !== agentId))
    if (activeAgentId === agentId) onAgentSelect(UC_AGENT.id)
  }

  return (
    <section className={compact ? "mt-0.5" : "mt-3.5"} aria-label="Agent 管理">
      <div className="sidebar-nav-row group/agents flex h-8 w-full items-center justify-between gap-2 rounded-[6px] px-1.5 text-[11.5px] text-[var(--muted-strong)]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[5px] text-left outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex size-4 shrink-0 items-center justify-center text-[var(--muted)]">
            <Robot className="size-3.5" weight="duotone" />
          </span>
          <span className="truncate leading-none">Agent 管理</span>
          <span className="text-[9px] tabular-nums text-[var(--muted)]">({agents.length})</span>
          <CaretDown aria-hidden className={cn("size-2.5 shrink-0 transition-transform duration-150", !open && "-rotate-90")} weight="fill" />
        </button>

        <DropdownMenu onOpenChange={(menuOpen) => { if (menuOpen) void loadAvailableAgents() }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="新建 Agent"
              title="新建 Agent"
              className="flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[var(--muted)] opacity-0 outline-none transition-opacity hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-hover/agents:opacity-100 group-focus-within/agents:opacity-100"
            >
              <Plus className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="w-52">
            <DropdownMenuLabel>添加本地 Agent</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {loading ? (
              <DropdownMenuItem disabled>正在查找已连接的 Agent…</DropdownMenuItem>
            ) : !backendOnline ? (
              <DropdownMenuItem disabled>本地 Agent 服务未连接</DropdownMenuItem>
            ) : addableProviders.length === 0 ? (
              <DropdownMenuItem disabled>没有更多可添加的 Agent</DropdownMenuItem>
            ) : (
              addableProviders.map((provider) => (
                <DropdownMenuItem key={provider.id} onSelect={() => addAgent(provider)}>
                  <ProviderAvatar providerId={provider.id} name={provider.name} className="size-4" />
                  <span className="truncate">{provider.name}</span>
                  <span className="ml-auto size-1.5 rounded-full bg-[var(--ok)]" title="已连接" />
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open ? (
        <div className="mt-0.5 space-y-1 pl-3.5">
          {agents.map((agent) => {
            const active = activeAgentId === agent.id
            return (
              <div key={agent.id} data-active={active} className="sidebar-nav-row group/agent relative flex h-[30px] items-center rounded-[6px] text-[10.5px] text-[var(--muted-strong)]">
                <button
                  type="button"
                  aria-label={agent.name}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onAgentSelect(agent.id)}
                  className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[6px] pl-2 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {agent.providerId ? (
                    <ProviderAvatar providerId={agent.providerId} name={agent.name} className="size-3.5" />
                  ) : (
                    <span className="flex size-3.5 shrink-0 items-center justify-center rounded-[4px] bg-[#6d5bd0] text-white">
                      <Robot className="size-2.5" weight="fill" />
                    </span>
                  )}
                  <span className="truncate">{agent.name}</span>
                  {agent.builtIn ? <span className="ml-auto shrink-0 text-[9px] text-[var(--muted)]">内置</span> : <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--ok)]" title="已连接" />}
                </button>
                {!agent.builtIn ? (
                  <button
                    type="button"
                    aria-label={`移除 ${agent.name}`}
                    title="从侧栏移除"
                    onClick={() => removeAgent(agent.id)}
                    className="absolute right-1 flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] opacity-0 outline-none transition-opacity hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] group-hover/agent:opacity-100 group-focus-within/agent:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
