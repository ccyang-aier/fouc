"use client"

/**
 * 社区画布：单色克制视觉 —— 文字化控件（无边框下拉 / 无底色筛选）、
 * 白底内容区 + 发丝线卡片、居中极简分页。点击卡片进入详情页。
 */

import { useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowClockwise, CaretDown, Check, CheckCircle, MagnifyingGlass, PlugsConnected, Plus, Robot, Sparkle } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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

const TABS: Array<{ id: CommunityTab; label: string; icon: typeof Robot; blurb: string }> = [
  { id: "agents", label: "Agents", icon: Robot, blurb: "可直接托付任务的社区智能体" },
  { id: "skills", label: "Skills", icon: Sparkle, blurb: "为 Agent 叠加领域能力的技能包" },
  { id: "connectors", label: "连接器", icon: PlugsConnected, blurb: "接入外部服务与数据源" },
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0]

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
          .map<RelatedItem>((other) => ({ id: other.id, name: other.name, glyph: other.glyph, desc: other.tagline, done: other.installed })),
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
          .map<RelatedItem>((other) => ({ id: other.id, name: other.name, glyph: other.glyph, desc: other.description, done: other.connected })),
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
        .map<RelatedItem>((other) => ({ id: other.id, name: other.name, glyph: other.name.slice(0, 1), desc: other.summary, done: other.installed })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, tab, agents, connectors, skills])

  function changePage(next: number) {
    setPage(next)
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const searchPlaceholder = tab === "agents" ? "搜索 Agent / 作者" : tab === "connectors" ? "搜索连接器 / 发布者" : "搜索技能 / 作者"

  return (
    <section aria-label="社区" className="relative flex h-full min-h-0 bg-panel">
      <AnimatePresence initial={false} mode="wait">
        {detail ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="min-h-0 flex-1"
          >
            <CommunityDetailPage
              key={detail.model.name}
              detail={detail.model}
              done={detail.done}
              related={detail.related}
              onBack={() => setDetailId(null)}
              onAction={detail.onAction}
              onOpenRelated={(id) => setDetailId(id)}
              onShare={() => notify("详情链接已复制")}
              onDiscuss={() => notify("讨论区即将开放")}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="flex min-w-0 flex-1 flex-col"
          >
            {/* 控制栏：文字化视图下拉 + 安静操作区，单条发丝线锚定 */}
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--line)] bg-panel px-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="切换社区视图"
                    className="flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)] outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-[var(--hover-fill)]"
                  >
                    {activeTab.label}
                    <CaretDown className="size-3 text-[var(--muted)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {TABS.map((item) => (
                    <DropdownMenuItem key={item.id} onSelect={() => switchTab(item.id)}>
                      <item.icon className={cn("size-4 shrink-0", tab === item.id ? "text-[var(--ink)]" : "text-[var(--muted)]")} weight="fill" />
                      <span className="flex-1">{item.label}</span>
                      {tab === item.id ? <Check className="ml-auto size-3.5 shrink-0 text-[var(--ink)]" weight="bold" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="刷新目录"
                  onClick={() => notify("目录已是最新")}
                  className="flex size-8 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <ArrowClockwise className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => notify("作品提交通道即将开放")}
                  className="ml-1.5 flex h-8 items-center gap-1 rounded-[8px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white outline-none transition-[background-color,opacity] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <Plus className="size-3" weight="bold" />
                  提交作品
                </button>
              </div>
            </div>

            {/* 内容区：白底、留白排版、发丝线卡片 */}
            <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#f5f5f7]">
              <div className="w-full px-5 pb-16 pt-5">
                {/* 筛选行：无底色文字 pill + 文字排序 + 极简搜索 */}
                <div className="flex items-center gap-0.5">
                  {CATEGORIES[tab].map((option) => {
                    const active = category === option
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={active}
                        onClick={() => { setCategory(option); setPage(1) }}
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

                  <div className="ml-auto flex items-center gap-1">
                    {tab !== "connectors" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="排序"
                            className="flex h-7 items-center gap-1 rounded-[8px] px-2 text-[11px] text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:text-[var(--ink)]"
                          >
                            {SORT_OPTIONS.find((option) => option.id === sort)?.label}
                            <CaretDown className="size-2.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          {SORT_OPTIONS.map((option) => (
                            <DropdownMenuCheckboxItem key={option.id} checked={sort === option.id} onCheckedChange={() => { setSort(option.id); setPage(1) }}>
                              {option.label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                    <label className="group flex h-7 w-44 items-center gap-1.5 rounded-[8px] bg-[var(--hover-fill)] px-2.5 text-[var(--muted)] transition-colors focus-within:bg-panel focus-within:shadow-[0_0_0_2px_var(--focus-ring)] max-[1200px]:w-36">
                      <MagnifyingGlass className="size-3.5 shrink-0" />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                        aria-label={searchPlaceholder}
                        placeholder={searchPlaceholder}
                        className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                      />
                    </label>
                  </div>
                </div>

                {/* 卡片栅格 */}
                {pageItemsLength === 0 ? (
                  <p className="pb-4 pt-24 text-center text-[11.5px] text-[var(--muted)]">
                    没有匹配「{query}」的条目 · 试试其他关键词
                  </p>
                ) : (
                  <div className="mt-5 grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                    {tab === "agents"
                      ? visibleAgents.slice(pageSlice.from, pageSlice.to).map((agent) => <CommunityAgentCard key={agent.id} agent={agent} onInstall={() => installAgent(agent.id)} onOpen={() => setDetailId(agent.id)} />)
                      : tab === "connectors"
                        ? visibleConnectors.slice(pageSlice.from, pageSlice.to).map((connector) => <CommunityConnectorCard key={connector.id} connector={connector} onConnect={() => connectConnector(connector.id)} onOpen={() => setDetailId(connector.id)} />)
                        : visibleSkills.slice(pageSlice.from, pageSlice.to).map((skill) => <CommunitySkillCard key={skill.id} skill={skill} onInstall={() => installSkill(skill.id)} onOpen={() => setDetailId(skill.id)} />)}
                  </div>
                )}

                {/* 居中分页 */}
                {total > 0 ? (
                  <div className="mt-12 flex justify-center">
                    <CommunityPagination page={safePage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onChange={changePage} />
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
