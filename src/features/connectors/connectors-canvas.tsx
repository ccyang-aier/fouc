"use client"

/** 连接器目录：延续社区资源浏览器的开放式目录语言。 */

import { useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { Check, CheckCircle, MagnifyingGlass, PlugsConnected } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { CONNECTOR_CATEGORIES, initialConnectors, type Connector } from "./connectors-data"

const actionButton =
  "flex h-7 min-w-[66px] shrink-0 items-center justify-center rounded-[6px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 text-[10.5px] font-semibold text-[var(--accent-ink)] outline-none transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

function ConnectorMark({ connector }: { connector: Connector }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[var(--surface-subtle)] text-[10.5px] font-semibold text-[var(--ink-soft)] ring-1 ring-inset ring-[var(--line)]">
      {connector.glyph}
    </span>
  )
}

function ConnectorRow({ connector, onConnect, onDisconnect }: { connector: Connector; onConnect: () => void; onDisconnect: () => void }) {
  return (
    <article
      tabIndex={0}
      className="group grid min-w-[760px] grid-cols-[minmax(190px,1.05fr)_112px_minmax(260px,2.4fr)_150px_92px] items-center gap-4 border-b border-[var(--line)] px-3 py-2 outline-none transition-colors hover:bg-[var(--surface-subtle)] focus:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ConnectorMark connector={connector} />
        <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{connector.name}</p>
      </div>
      <span className="truncate text-[10.5px] text-[var(--muted-strong)]">{connector.category}</span>
      <p className="truncate text-[11px] leading-5 text-[var(--ink-soft)]">{connector.description}</p>
      <div className="flex items-center gap-2 whitespace-nowrap text-[9.5px] tabular-nums text-[var(--muted)]">
        <span className="font-medium text-[var(--ink-soft)]">v{connector.version}</span>
        <span aria-hidden className="text-[var(--line-strong)]">/</span>
        <span>{connector.updated}更新</span>
      </div>
      {connector.connected ? (
        <button
          type="button"
          aria-label={`断开 ${connector.name}`}
          onClick={onDisconnect}
          className="group/connected relative flex h-7 min-w-[72px] items-center justify-center overflow-hidden rounded-[6px] border border-[var(--line-strong)] bg-panel px-2 text-[10.5px] font-medium outline-none transition-colors hover:border-[color-mix(in_srgb,var(--err-ink)_36%,var(--line))] hover:bg-[color-mix(in_srgb,var(--err-ink)_5%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex items-center gap-1.5 text-[var(--muted-strong)] transition-opacity group-hover/connected:opacity-0 group-focus-visible/connected:opacity-0">
            <Check className="size-3" weight="bold" />已连接
          </span>
          <span className="absolute inset-0 flex items-center justify-center text-[var(--err-ink)] opacity-0 transition-opacity group-hover/connected:opacity-100 group-focus-visible/connected:opacity-100">断开</span>
        </button>
      ) : (
        <button type="button" onClick={onConnect} className={actionButton}>连接</button>
      )}
    </article>
  )
}

export function ConnectorsCanvas() {
  const [connectors, setConnectors] = useState(initialConnectors)
  const [category, setCategory] = useState<(typeof CONNECTOR_CATEGORIES)[number]>("全部")
  const [query, setQuery] = useState("")
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const connectedCount = connectors.filter((connector) => connector.connected).length

  function notify(message: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200)
  }

  function setConnected(id: string, connected: boolean) {
    const item = connectors.find((connector) => connector.id === id)
    if (!item || item.connected === connected) return
    setConnectors((list) => list.map((connector) => connector.id === id ? { ...connector, connected } : connector))
    notify(connected ? `${item.name} 已连接，可在任务与自动化中引用` : `${item.name} 已断开`)
  }

  const normalized = query.trim().toLocaleLowerCase("zh-CN")
  const visible = useMemo(
    () => connectors.filter((connector) =>
      (category === "全部" || connector.category === category) &&
      (!normalized || `${connector.name} ${connector.description} ${connector.category}`.toLocaleLowerCase("zh-CN").includes(normalized)),
    ),
    [connectors, category, normalized],
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([["全部", connectors.length]])
    for (const connector of connectors) counts.set(connector.category, (counts.get(connector.category) ?? 0) + 1)
    return counts
  }, [connectors])

  return (
    <section aria-label="连接器" className="relative flex h-full min-h-0 flex-col bg-panel">
      <header className="shrink-0 border-b border-[var(--line)] bg-panel px-6 pb-0 pt-5">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-bold tracking-[-0.025em] text-[var(--ink)]">连接器</h1>
            <p className="mt-1.5 max-w-[860px] text-[11px] leading-[18px] text-[var(--muted-strong)]">
              连接器是系统内置能力：连接后，外部服务的数据与事件作为上下文进入任务与自动化，凭据加密保存在本机，可随时断开。
            </p>
          </div>
          <span className="mt-0.5 flex h-7 shrink-0 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 text-[10px] font-medium text-[var(--muted-strong)]">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--ok-ink)]" />
            已连接 {connectedCount} / {connectors.length}
          </span>
        </div>

        <div className="mt-4 flex items-end gap-1 overflow-x-auto">
          {CONNECTOR_CATEGORIES.map((option) => {
            const active = category === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(option)}
                className={cn(
                  "relative flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-[11px] outline-none transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
                  active ? "font-semibold text-[var(--accent-ink)] after:bg-[var(--accent)]" : "text-[var(--muted-strong)] hover:text-[var(--ink)]",
                )}
              >
                {option}<span className="text-[9px] tabular-nums text-[var(--muted)]">{categoryCounts.get(option) ?? 0}</span>
              </button>
            )
          })}
          <label className="mb-1 ml-auto flex h-8 w-52 shrink-0 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] focus-within:bg-panel max-[980px]:w-40">
            <MagnifyingGlass className="size-3.5 shrink-0" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索连接器 / 描述" placeholder="搜索连接器 / 描述" className="min-w-0 flex-1 bg-transparent text-[10.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          </label>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 pb-16 pt-3">
        {visible.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <PlugsConnected className="size-6 text-[var(--muted)]" />
            <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">没有匹配的连接器</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("全部") }} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">清除筛选条件</button>
          </div>
        ) : (
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(190px,1.05fr)_112px_minmax(260px,2.4fr)_150px_92px] gap-4 border-y border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[9.5px] font-medium text-[var(--muted)]">
              <span>名称</span><span>分类</span><span>描述</span><span>版本 / 更新时间</span><span>操作</span>
            </div>
            {visible.map((connector, index) => (
              <motion.div key={connector.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.12) }}>
                <ConnectorRow connector={connector} onConnect={() => setConnected(connector.id, true)} onDisconnect={() => setConnected(connector.id, false)} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" className={cn("pointer-events-none absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 translate-y-2 items-center gap-2 rounded-[7px] border border-white/10 bg-[var(--ink)] px-3.5 py-2 text-[10px] font-medium text-white opacity-0 shadow-[0_8px_24px_rgba(28,33,42,0.16)] transition-[opacity,transform]", toast && "translate-y-0 opacity-100")}>
        <CheckCircle className="size-3.5" weight="fill" />{toast}
      </div>
    </section>
  )
}
