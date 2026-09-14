"use client"

/**
 * 社区画布：紧凑控制栏（左视图切换 / 右作用域操作）+ 分类筛选条 + 卡片栅格 + 分页。
 * 点击卡片进入详情页；获取 / 连接 / 安装即时落到本地状态并给出轻提示。
 */

import { useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowsDownUp, ArrowClockwise, CaretDown, CheckCircle, MagnifyingGlass, PlugsConnected, Plus, Robot, Sparkle } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { CommunityAgentCard, CommunityConnectorCard, CommunitySkillCard } from "./community-cards"
import { CommunityDetailPage, type RelatedItem } from "./community-detail"
import { CommunityPagination } from "./community-pagination"
import {
  buildCommunityDetail,
  CATEGORIES,
  initialCommunityAgents,
  initialCommunityConnectors,
  initialCommunitySkills,
  PAGE_SIZE,
  type CommunityTab,
} from "./community-data"

const TABS: Array<{ id: CommunityTab; label: string; icon: typeof Robot }> = [
  { id: "agents", label: "Agents", icon: Robot },
  { id: "skills", label: "Skills", icon: Sparkle },
  { id: "connectors", label: "连接器", icon: PlugsConnected },
]

type SortKey = "popular" | "rating" | "name"

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "popular", label: "热门安装" },
  { id: "rating", label: "最高评分" },
  { id: "name", label: "名称" },
]

export function CommunityCanvas() {
  const [tab, setTab] = useState<CommunityTab>("agents")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("全部")
  const [sort, setSort] = useState<SortKey>("popular")
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [agents, setAgents] = useState(initialCommunityAgents)
  const [connectors, setConnectors] = useState(initialCommunityConnectors)
  const [skills, setSkills] = useState(initialCommunitySkills)
  const [toast, setToast] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function switchTab(next: CommunityTab) {
    setTab(next)
    setQuery("")
    setCategory("全部")
    setPage(1)
    setDetailId(null)
  }

  function installAgent(id: string) {
    const item = agents.find((agent) => agent.id === id)
    if (!item || item.installed) return
    setAgents((list) => list.map((agent) => (agent.id === id ? { ...agent, installed: true } : agent)))
    notify(`${item.name} 已添加到你的 Agent 列表`)
  }

  function connectConnector(id: string) {
    const item = connectors.find((connector) => connector.id === id)
    if (!item || item.connected) return
    setConnectors((list) => list.map((connector) => (connector.id === id ? { ...connector, connected: true } : connector)))
    notify(`${item.name} 已连接`)
  }

  function installSkill(id: string) {
    const item = skills.find((skill) => skill.id === id)
    if (!item || item.installed) return
    setSkills((list) => list.map((skill) => (skill.id === id ? { ...skill, installed: true } : skill)))
    notify(`${item.name} 已安装，可在任务中引用`)
  }

  const normalized = query.trim().toLocaleLowerCase("zh-CN")

  const visibleAgents = useMemo(() => {
    const list = agents.filter((agent) =>
      (category === "全部" || agent.category === category) &&
      (!normalized || `${agent.name} ${agent.tagline} ${agent.author}`.toLocaleLowerCase("zh-CN").includes(normalized)),
    )
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    if (sort === "rating") return [...list].sort((a, b) => b.rating - a.rating)
    return [...list].sort((a, b) => b.installs - a.installs)
  }, [agents, category, normalized, sort])

  const visibleConnectors = useMemo(
    () =>
      connectors
        .filter((connector) =>
          (category === "全部" || connector.category === category) &&
          (!normalized || `${connector.name} ${connector.description} ${connector.publisher}`.toLocaleLowerCase("zh-CN").includes(normalized)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [connectors, category, normalized],
  )

  const visibleSkills = useMemo(() => {
    const list = skills.filter((skill) =>
      (category === "全部" || skill.category === category) &&
      (!normalized || `${skill.name} ${skill.summary} ${skill.author} ${skill.compat.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalized)),
    )
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    return [...list].sort((a, b) => b.installs - a.installs)
  }, [skills, category, normalized, sort])

  const total = tab === "agents" ? visibleAgents.length : tab === "connectors" ? visibleConnectors.length : visibleSkills.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageSlice = { from: (safePage - 1) * PAGE_SIZE, to: safePage * PAGE_SIZE }
  const pageItemsLength = Math.max(0, Math.min(total, pageSlice.to) - pageSlice.from)

  const categoryCounts = useMemo(() => {
    const source: Array<{ category: string }> = tab === "agents" ? agents : tab === "connectors" ? connectors : skills
    const counts = new Map<string, number>([["全部", source.length]])
    for (const item of source) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    return counts
  }, [tab, agents, connectors, skills])

  // 详情：跨 Tab 的条目查找 + 派生数据与相关推荐
  const detail = useMemo(() => {
    if (!detailId) return null
    if (tab === "agents") {
      const item = agents.find((agent) => agent.id === detailId)
      if (!item) return null
      return {
        model: buildCommunityDetail("agents", item),
        done: item.installed,
        onAction: () => installAgent(item.id),
        related: agents
          .filter((other) => other.id !== item.id && other.category === item.category)
          .slice(0, 3)
          .map<RelatedItem>((other) => ({ id: other.id, name: other.name, glyph: other.glyph, tone: other.tone, meta: `★ ${other.rating} · ${other.author}`, done: other.installed })),
      }
    }
    if (tab === "connectors") {
      const item = connectors.find((connector) => connector.id === detailId)
      if (!item) return null
      return {
        model: buildCommunityDetail("connectors", item),
        done: item.connected,
        onAction: () => connectConnector(item.id),
        related: connectors
          .filter((other) => other.id !== item.id && other.category === item.category)
          .slice(0, 3)
          .map<RelatedItem>((other) => ({ id: other.id, name: other.name, glyph: other.glyph, tone: other.tone, meta: other.publisher, done: other.connected })),
      }
    }
    const item = skills.find((skill) => skill.id === detailId)
    if (!item) return null
    return {
      model: buildCommunityDetail("skills", item),
      done: item.installed,
      onAction: () => installSkill(item.id),
      related: skills
        .filter((other) => other.id !== item.id && other.category === item.category)
        .slice(0, 3)
        .map<RelatedItem>((other) => ({ id: other.id, name: other.name, glyph: other.name.slice(0, 1), tone: other.tone, meta: `v${other.version} · ${other.author}`, done: other.installed })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, tab, agents, connectors, skills])

  function changePage(next: number) {
    setPage(next)
    gridRef.current?.scrollTo({ top: 0 })
  }

  const searchPlaceholder = tab === "agents" ? "搜索 Agent / 作者" : tab === "connectors" ? "搜索连接器 / 发布者" : "搜索技能 / 作者"

  return (
    <section aria-label="社区" className="relative flex h-full min-h-0 bg-panel">
      <AnimatePresence initial={false} mode="wait">
        {detail ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="min-h-0 flex-1"
          >
            <CommunityDetailPage
              detail={detail.model}
              done={detail.done}
              related={detail.related}
              onBack={() => setDetailId(null)}
              onAction={detail.onAction}
              onOpenRelated={(id) => setDetailId(id)}
              onShare={() => notify("详情链接已复制")}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="flex min-w-0 flex-1 flex-col"
          >
            {/* 顶部控制栏：视图切换 + 作用域操作 */}
            <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-panel px-4">
              <div role="tablist" aria-label="社区分区" className="flex h-8 items-center gap-0.5 rounded-[10px] bg-[var(--surface-subtle)] p-0.5">
                {TABS.map((item) => {
                  const selected = tab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => switchTab(item.id)}
                      className={cn(
                        "flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-medium outline-none transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        selected
                          ? "bg-panel text-[var(--ink)] shadow-[0_1px_3px_rgba(28,33,42,0.10),0_0_0_1px_var(--line)]"
                          : "text-[var(--muted-strong)] hover:text-[var(--ink)]",
                      )}
                    >
                      <item.icon className={cn("size-[14px]", selected ? "text-accent-ink" : "text-[var(--muted-strong)]")} weight="fill" />
                      {item.label}
                    </button>
                  )
                })}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="刷新目录"
                  onClick={() => notify("目录已是最新")}
                  className="flex size-8 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <ArrowClockwise className="size-4" />
                </button>
                {tab !== "connectors" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="排序"
                        className={cn(
                          "flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[10.5px] font-medium outline-none transition-colors hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                          sort === "popular" ? "text-[var(--muted-strong)]" : "text-[var(--ink)]",
                        )}
                      >
                        <ArrowsDownUp className="size-4" />
                        {SORT_OPTIONS.find((option) => option.id === sort)?.label}
                        <CaretDown className="size-3 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuLabel>排序方式</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {SORT_OPTIONS.map((option) => (
                        <DropdownMenuCheckboxItem key={option.id} checked={sort === option.id} onCheckedChange={() => { setSort(option.id); setPage(1) }}>
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <button
                  type="button"
                  onClick={() => notify("作品提交通道即将开放")}
                  className="flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[10.5px] font-semibold text-white outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:bg-[var(--accent-strong)] hover:shadow-[0_5px_14px_color-mix(in_srgb,var(--accent)_20%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:translate-y-0"
                >
                  <Plus className="size-3.5" weight="bold" />
                  提交作品
                </button>
              </div>
            </div>

            {/* 筛选条：分类 token + 搜索 */}
            <div className="flex h-[46px] shrink-0 items-center gap-1 border-b border-[var(--line)] bg-panel px-4">
              {CATEGORIES[tab].map((option) => {
                const active = category === option
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setCategory(option); setPage(1) }}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-medium outline-none transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      active
                        ? "bg-accent-soft text-accent-ink shadow-[inset_0_0_0_1px_var(--accent-soft-line)]"
                        : "text-[var(--muted-strong)] hover:bg-wash hover:text-[var(--ink-soft)]",
                    )}
                  >
                    {option}
                    <span className={cn("text-[9px] tabular-nums", active ? "opacity-70" : "opacity-55")}>{categoryCounts.get(option) ?? 0}</span>
                  </button>
                )
              })}
              <label className="ml-auto flex h-7 w-[210px] items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-3 text-[10px] text-[var(--muted)] transition-[background-color,box-shadow] focus-within:bg-panel focus-within:shadow-[inset_0_0_0_1px_var(--accent-soft-line)] max-[1200px]:w-[160px]">
                <MagnifyingGlass className="size-3.5 shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-[10.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                />
              </label>
            </div>

            {/* 卡片栅格 */}
            <div ref={gridRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#fbfbfc] px-4 py-3.5">
              {pageItemsLength === 0 ? (
                <p className="mx-auto mt-16 w-fit rounded-[12px] border border-dashed border-[var(--line-strong)] px-8 py-8 text-[11px] text-[var(--muted)]">
                  没有匹配「{query}」的条目，换个关键词试试
                </p>
              ) : (
                <div className="mx-auto grid max-w-[1240px] gap-3 grid-cols-[repeat(auto-fill,minmax(238px,1fr))]">
                  {tab === "agents"
                    ? visibleAgents.slice(pageSlice.from, pageSlice.to).map((agent) => <CommunityAgentCard key={agent.id} agent={agent} onInstall={() => installAgent(agent.id)} onOpen={() => setDetailId(agent.id)} />)
                    : tab === "connectors"
                      ? visibleConnectors.slice(pageSlice.from, pageSlice.to).map((connector) => <CommunityConnectorCard key={connector.id} connector={connector} onConnect={() => connectConnector(connector.id)} onOpen={() => setDetailId(connector.id)} />)
                      : visibleSkills.slice(pageSlice.from, pageSlice.to).map((skill) => <CommunitySkillCard key={skill.id} skill={skill} onInstall={() => installSkill(skill.id)} onOpen={() => setDetailId(skill.id)} />)}
                </div>
              )}
            </div>

            {/* 分页 */}
            <footer className="flex h-12 shrink-0 items-center border-t border-[var(--line)] bg-panel px-4">
              <CommunityPagination page={safePage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onChange={changePage} />
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute right-4 bottom-4 z-40 flex translate-y-2 items-center gap-2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--elevated)] px-3 py-2 text-[9.5px] font-medium text-[var(--ink)] opacity-0 shadow-[0_8px_24px_rgba(28,33,42,0.10)] transition-[opacity,transform]",
          toast && "translate-y-0 opacity-100",
        )}
      >
        <CheckCircle className="size-3.5 text-[#318b61]" weight="fill" />
        {toast}
      </div>
    </section>
  )
}
