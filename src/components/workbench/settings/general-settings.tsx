"use client"

/**
 * 通用设置：本机运行状态速览 —— 数据全部来自后端真实接口，无占位开关。
 */

import { useEffect, useState } from "react"
import { Plugs } from "@phosphor-icons/react"

import type { AgentInstallation, ProviderSpec } from "@fouc/shared"
import { backendFetch, getBackendEndpoint } from "@/lib/backend"
import { formatRelativeTime } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

export function GeneralSettings() {
  const [backendUrl, setBackendUrl] = useState<string>("—")
  const [online, setOnline] = useState(false)
  const [providers, setProviders] = useState<ProviderSpec[]>([])
  const [installations, setInstallations] = useState<AgentInstallation[]>([])

  useEffect(() => {
    let cancelled = false
    void getBackendEndpoint().then((endpoint) => {
      if (!cancelled) setBackendUrl(endpoint.baseUrl)
    })
    void (async () => {
      try {
        const [p, i] = await Promise.all([
          backendFetch<ProviderSpec[]>("/api/agents/providers"),
          backendFetch<AgentInstallation[]>("/api/agents/installations"),
        ])
        if (!cancelled) {
          setProviders(p)
          setInstallations(i)
          setOnline(true)
        }
      } catch {
        if (!cancelled) setOnline(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const lastProbeAt = installations.reduce<number | null>((latest, item) => {
    return item.lastProbeAt && (!latest || item.lastProbeAt > latest) ? item.lastProbeAt : latest
  }, null)

  return (
    <div className="mx-auto w-full max-w-[760px] px-8 py-7 max-[1100px]:px-6">
      <PanelHeader title="通用" description="Fouc 本地服务与 Agent 纳管的整体状态。" />
      <section className="mt-5 overflow-hidden rounded-[12px] border border-[#eceef1] bg-white shadow-[0_1px_2px_rgba(23,25,27,0.04)]">
        <header className="flex items-center gap-2 border-b border-[#f2f3f5] px-5 py-3.5">
          <Plugs className="size-[15px] text-[#929aa3]" weight="fill" aria-hidden />
          <h2 className="text-[13px] font-medium">运行状态</h2>
        </header>
        <dl className="px-5 py-2">
          <StatusRow label="后端服务">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                online ? "text-[#1f8a5f]" : "text-[#a06b12]"
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", online ? "bg-[#18b988]" : "bg-[#e6a64f] animate-pulse")}
                aria-hidden
              />
              {online ? "在线" : "连接中…"}
            </span>
          </StatusRow>
          <StatusRow label="服务地址">
            <span className="font-mono text-[11.5px] text-[#4b5563]">{backendUrl}</span>
          </StatusRow>
          <StatusRow label="受支持产品">
            <span className="font-medium">{providers.length} 种</span>
          </StatusRow>
          <StatusRow label="已纳管实例">
            <span className="font-medium">{installations.length} 个</span>
          </StatusRow>
          <StatusRow label="最近一次探测" last>
            <span>{formatRelativeTime(lastProbeAt)}</span>
          </StatusRow>
        </dl>
      </section>
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-[var(--muted)]">
        后端为本地 sidecar 进程，仅绑定 127.0.0.1；Agent 的发现、探测与会话均在本地完成。
      </p>
    </div>
  )
}

function StatusRow({ label, last, children }: { label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2.5 text-[12px]",
        !last && "border-b border-[#f6f7f8]"
      )}
    >
      <dt className="shrink-0 text-[var(--muted-strong)]">{label}</dt>
      <dd className="min-w-0 truncate text-[var(--ink)]">{children}</dd>
    </div>
  )
}

export function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-0.5 text-[12px] text-[var(--muted)]">{description}</p>
    </header>
  )
}
