"use client"

/**
 * 连接器界面：系统内置能力的管理页 ——
 * 顶栏标题 + 连接概况；内容区为说明行 + 分类筛选 + 搜索 +
 * 白卡栅格；连接即时生效，已连接胶囊悬停翻为「断开」。
 */

import { useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { Check, CheckCircle, MagnifyingGlass, PlugsConnected } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { CONNECTOR_CATEGORIES, initialConnectors, type Connector } from "./connectors-data"

const cardShell =
  "relative flex flex-col rounded-[8px] bg-panel p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)]"

const neutralBadge =
  "flex size-10 shrink-0 items-center justify-center rounded-[7px] bg-[var(--surface-hover)] text-[13px] font-semibold text-[var(--ink-soft)]"

const actionPill =
  "flex h-7 shrink-0 items-center rounded-[7px] bg-accent-soft px-3 text-[11px] font-semibold text-accent-ink outline-none transition-[background-color,color] duration-200 hover:bg-[var(--accent)] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:bg-[var(--accent)] focus-visible:text-white"

const connectedPill =
  "group/conn relative flex h-7 shrink-0 items-center overflow-hidden rounded-[7px] border border-[var(--line-strong)] px-2.5 text-[10.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"

function ConnectorCard({ connector, onConnect, onDisconnect }: { connector: Connector; onConnect: () => void; onDisconnect: () => void }) {
  return (
    <article className={cardShell}>
      <div className="flex items-start gap-3">
        <span className={neutralBadge}>{connector.glyph}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.015em] text-[var(--ink)]">{connector.name}</p>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{connector.category}</p>
        </div>
        {connector.connected ? (
          <button
            type="button"
            aria-label={`断开 ${connector.name}`}
            onClick={onDisconnect}
            className={connectedPill}
          >
            <span className="flex items-center gap-1 text-[var(--muted-strong)] transition-opacity duration-150 group-hover/conn:opacity-0">
              <Check className="size-3" weight="bold" />
              已连接
            </span>
            <span className="absolute inset-0 flex items-center justify-center text-[var(--err-ink)] opacity-0 transition-opacity duration-150 group-hover/conn:opacity-100">
              断开
            </span>
          </button>
        ) : (
          <button type="button" onClick={onConnect} className={actionPill}>
            连接
          </button>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-[11.5px] leading-[18px] text-[var(--ink-soft)]">{connector.description}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-3 text-[10px] text-[var(--muted)]">
        <span className="font-medium text-[var(--ink-soft)]">v{connector.version}</span>
        <span aria-hidden className="text-[var(--line-strong)]">·</span>
        <span>{connector.updated}更新</span>
      </div>
    </article>
  )
}

export function ConnectorsCanvas() {
  const [connectors, setConnectors] = useState(initialConnectors)
  const [category, setCategory] = useState<(typeof CONNECTOR_CATEGORIES)[number]>("全部")
  const [query, setQuery] = useState("")
  const [toast, setToast] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const connectedCount = connectors.filter((connector) => connector.connected).length

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function setConnected(id: string, connected: boolean) {
    const item = connectors.find((connector) => connector.id === id)
    if (!item || item.connected === connected) return
    setConnectors((list) => list.map((connector) => (connector.id === id ? { ...connector, connected } : connector)))
    notify(connected ? `${item.name} 已连接，可在任务与自动化中引用` : `${item.name} 已断开`)
  }

  const normalized = query.trim().toLocaleLowerCase("zh-CN")

  const visible = useMemo(
    () =>
      connectors.filter(
        (connector) =>
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
      {/* 顶栏：标题 + 连接概况 */}
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--line)] bg-panel px-4">
        <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">连接器</p>
        <span className="ml-auto flex h-6 items-center gap-1.5 rounded-[7px] bg-[var(--hover-fill)] px-2 text-[10.5px] font-medium text-[var(--muted-strong)]">
          <span aria-hidden className="size-1.5 rounded-full bg-[#18b988]" />
          已连接 {connectedCount} / {connectors.length}
        </span>
      </div>

      {/* 内容区：白底留白 + 发丝线卡片，与社区目录同一套排版语言 */}
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-panel">
        <div className="w-full px-5 pb-16 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-panel text-[var(--ink-soft)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <PlugsConnected className="size-[18px]" weight="bold" />
            </span>
            <p className="min-w-0 text-[11.5px] leading-[18px] text-[var(--muted-strong)]">
              连接器是系统内置能力：连接后，外部服务的数据与事件作为上下文进入任务与自动化，凭据加密保存在本机，可随时断开。
            </p>
          </div>

          {/* 筛选行：无底色文字 pill + 极简搜索 */}
          <div className="mt-5 flex items-center gap-0.5">
            {CONNECTOR_CATEGORIES.map((option) => {
              const active = category === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(option)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    active
                      ? "font-semibold text-[var(--accent-ink)]"
                      : "text-[var(--muted-strong)] hover:text-[var(--ink)]",
                  )}
                >
                  {option}
                  <span className="text-[9.5px] tabular-nums text-[var(--muted)]">{categoryCounts.get(option) ?? 0}</span>
                </button>
              )
            })}

            <label className="group ml-auto flex h-7 w-44 items-center gap-1.5 rounded-[8px] border border-transparent bg-[var(--hover-fill)] px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] focus-within:bg-panel max-[1200px]:w-36">
              <MagnifyingGlass className="size-3.5 shrink-0" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="搜索连接器 / 描述"
                placeholder="搜索连接器 / 描述"
                className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          </div>

          {/* 卡片栅格 */}
          {visible.length === 0 ? (
            <p className="pb-4 pt-24 text-center text-[11.5px] text-[var(--muted)]">
              没有匹配「{query}」的连接器 · 试试其他关键词
            </p>
          ) : (
            <div className="mt-5 grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {visible.map((connector, index) => (
                <motion.div
                  key={connector.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.16), ease: [0.32, 0.72, 0, 1] }}
                >
                  <ConnectorCard
                    connector={connector}
                    onConnect={() => setConnected(connector.id, true)}
                    onDisconnect={() => setConnected(connector.id, false)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 translate-y-2 items-center gap-2 rounded-[8px] border border-[var(--line-strong)] bg-[var(--ink)] px-3.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-[0_8px_24px_rgba(28,33,42,0.16)] transition-[opacity,transform]",
          toast && "translate-y-0 opacity-100",
        )}
      >
        <CheckCircle className="size-3.5" weight="fill" />
        {toast}
      </div>
    </section>
  )
}
