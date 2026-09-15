"use client"

/**
 * 社区画布：市场目录式首页 —— 编辑精选主位 + 本周上升榜单 + 精选合集，
 * 下方为目录栅格；筛选行用带边框 pill 下拉与「/」快捷搜索。点击卡片进入详情页。
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowClockwise, CaretDown, Check, CheckCircle, MagnifyingGlass, Plus, Robot, Sparkle } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { CommunityAgentCard, CommunitySkillCard } from "./community-cards"
import { CommunityDetailPage, type RelatedItem } from "./community-detail"
import { CommunityPagination } from "./community-pagination"
import { CollectionsRow, FeatureSection, TrendingRail } from "./community-sections"
import {
  buildCommunityDetail,
  CATEGORIES,
  initialCommunityAgents,
  initialCommunitySkills,
  PAGE_SIZE,
  type CommunityTab,
} from "./community-data"

const TABS: Array<{ id: CommunityTab; label: string; icon: typeof Robot; blurb: string }> = [
  { id: "agents", label: "Agents", icon: Robot, blurb: "可直接托付任务的社区智能体" },
  { id: "skills", label: "Skills", icon: Sparkle, blurb: "为 Agent 叠加领域能力的技能包" },
]

type SortKey = "popular" | "rating" | "name"

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "popular", label: "热门安装" },
  { id: "rating", label: "最高评分" },
  { id: "name", label: "名称" },
]

const COLLECTIONS: Record<CommunityTab, Array<{ key: string; title: string; desc: string }>> = {
  agents: [
    { key: "研发", title: "研发提效", desc: "从评审到上线，覆盖研发全流程。" },
    { key: "办公", title: "办公协同", desc: "会议、周报与日程的自动化流转。" },
    { key: "数据", title: "数据自动化", desc: "让数据自己工作，释放更多可能。" },
  ],
  skills: [
    { key: "研发", title: "研发工程", desc: "评审、测试与 API 速查的得力助手。" },
    { key: "办公", title: "高质量写作", desc: "更好的表达，带来更大的影响力。" },
    { key: "数据", title: "数据分析", desc: "从查询到归因的完整链路。" },
  ],
}

export function CommunityCanvas() {
  const [tab, setTab] = useState<CommunityTab>("agents")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("全部")
  const [sort, setSort] = useState<SortKey>("popular")
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [agents, setAgents] = useState(initialCommunityAgents)
  const [skills, setSkills] = useState(initialCommunitySkills)
  const [toast, setToast] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0]

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  // 「/」快捷键聚焦搜索（参考市场目录页习惯）
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

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

  const visibleSkills = useMemo(() => {
    const list = skills.filter((skill) =>
      (category === "全部" || skill.category === category) &&
      (!normalized || `${skill.name} ${skill.summary} ${skill.author} ${skill.compat.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalized)),
    )
    if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    return [...list].sort((a, b) => b.installs - a.installs)
  }, [skills, category, normalized, sort])

  // 陈列区：编辑精选取安装量最高条目，榜单取前四；筛选或搜索时收起
  const showcase = useMemo(() => {
    if (tab === "agents") {
      const pool = [...agents].sort((a, b) => b.installs - a.installs)
      const top = pool[0]
      return {
        featured: top && {
          title: top.name,
          tagline: top.tagline,
          detail: `${top.highlights.join("；")}。`,
          author: top.author,
          official: top.author === "Fouc 官方",
          glyph: top.author.slice(0, 1),
          tone: top.tone,
          tags: top.tags,
          rating: top.rating,
          ratingCount: top.ratingCount,
          installs: top.installs,
          version: top.version,
          updated: top.updated,
          actionLabel: "获取",
          actioned: top.installed,
          actionedLabel: "已添加",
          onOpen: () => setDetailId(top.id),
          onAction: () => installAgent(top.id),
        },
        trending: pool.slice(0, 4).map((agent) => ({
          id: agent.id,
          name: agent.name,
          sub: agent.author,
          glyph: agent.author.slice(0, 1),
          tone: agent.tone,
          trend: Math.max(12, Math.round((agent.rating - 4) * 100)),
        })),
      }
    }
    const pool = [...skills].sort((a, b) => b.installs - a.installs)
    const top = pool[0]
    return {
      featured: top && {
        title: top.name,
        tagline: top.summary,
        author: top.author,
        official: top.author === "Fouc 官方",
        glyph: top.author.slice(0, 1),
        tone: top.tone,
        tags: top.compat,
        installs: top.installs,
        version: top.version,
        updated: top.updated,
        actionLabel: "安装",
        actioned: top.installed,
        actionedLabel: "已安装",
        onOpen: () => setDetailId(top.id),
        onAction: () => installSkill(top.id),
      },
      trending: pool.slice(0, 4).map((skill) => ({
        id: skill.id,
        name: skill.name,
        sub: skill.author,
        glyph: skill.author.slice(0, 1),
        tone: skill.tone,
        trend: Math.max(12, Math.round(15 + (skill.installs % 85))),
      })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, agents, skills])

  const collections = useMemo(() => {
    const source = tab === "agents" ? agents : skills
    return COLLECTIONS[tab].map((config) => {
      const items = source.filter((item) => item.category === config.key)
      return {
        ...config,
        count: items.length,
        authors: new Set(items.map((item) => item.author)).size,
        avatars: items.slice(0, 4).map((item) => ({ glyph: item.author.slice(0, 1), tone: item.tone })),
      }
    })
  }, [tab, agents, skills])

  const showcaseVisible = !normalized && category === "全部"

  const total = tab === "agents" ? visibleAgents.length : visibleSkills.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageSlice = { from: (safePage - 1) * PAGE_SIZE, to: safePage * PAGE_SIZE }
  const pageItemsLength = Math.max(0, Math.min(total, pageSlice.to) - pageSlice.from)

  const categoryCounts = useMemo(() => {
    const source: Array<{ category: string }> = tab === "agents" ? agents : skills
    const counts = new Map<string, number>([["全部", source.length]])
    for (const item of source) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    return counts
  }, [tab, agents, skills])

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
  }, [detailId, tab, agents, skills])

  function changePage(next: number) {
    setPage(next)
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const searchPlaceholder = tab === "agents" ? "搜索 Agents、作者或关键词" : "搜索 Skills、作者或关键词"
  const featured = showcaseVisible ? showcase.featured : null

  const filterPill =
    "flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-panel px-3 text-[12px] text-[var(--ink)] outline-none " +
    "transition-colors hover:border-[var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:border-[var(--line-strong)]"

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
            {/* 控制栏：视图下拉 + 刷新 + 提交作品 */}
            <div className="flex h-12 shrink-0 items-center gap-1 bg-panel px-4">
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

            {/* 内容区：筛选 pill 行 + 陈列区块 + 目录栅格 */}
            <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-panel">
              <div className="w-full px-4 pb-16">
                {/* 筛选行 */}
                <div className="flex items-center gap-2 pt-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="筛选分类" className={filterPill}>
                        {category === "全部" ? "全部类型" : category}
                        <CaretDown className="size-3 text-[var(--muted)]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      {CATEGORIES[tab].map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option}
                          checked={category === option}
                          onCheckedChange={() => { setCategory(option); setPage(1) }}
                        >
                          {option}
                          <span className="ml-auto text-[10.5px] tabular-nums text-[var(--muted)]">{categoryCounts.get(option) ?? 0}</span>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="排序" className={filterPill}>
                        {SORT_OPTIONS.find((option) => option.id === sort)?.label}
                        <CaretDown className="size-3 text-[var(--muted)]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-32">
                      {SORT_OPTIONS.map((option) => (
                        <DropdownMenuCheckboxItem key={option.id} checked={sort === option.id} onCheckedChange={() => { setSort(option.id); setPage(1) }}>
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <label className="ml-auto flex h-8 w-72 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-panel px-3 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] max-[1200px]:w-52">
                    <MagnifyingGlass className="size-4 shrink-0" />
                    <input
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                      aria-label={searchPlaceholder}
                      placeholder={searchPlaceholder}
                      className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                    />
                    <kbd className="shrink-0 rounded-[4px] border border-[var(--line)] px-1.5 text-[10px] leading-[16px] text-[var(--muted)]">/</kbd>
                  </label>
                </div>

                {/* 编辑精选 / 本周上升：各自独立成卡 */}
                {featured ? (
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_340px] items-stretch gap-4 max-[1100px]:grid-cols-1">
                    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface-subtle)] p-6">
                      <FeatureSection item={featured} />
                    </div>
                    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
                      <TrendingRail items={showcase.trending} onOpen={setDetailId} />
                    </div>
                  </div>
                ) : null}

                {/* 精选合集：浅底面板 */}
                {showcaseVisible ? (
                  <div className="mt-4 rounded-[12px] border border-[var(--line)] bg-[var(--surface-subtle)] p-6">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">精选合集</p>
                    <div className="mt-4">
                      <CollectionsRow collections={collections} onSelect={(key) => { setCategory(key); setPage(1) }} />
                    </div>
                  </div>
                ) : null}

                {/* 目录栅格 */}
                {pageItemsLength === 0 ? (
                  <p className="pb-4 pt-24 text-center text-[11.5px] text-[var(--muted)]">
                    没有匹配「{query}」的条目 · 试试其他关键词
                  </p>
                ) : (
                  <section className="mt-6">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                      {showcaseVisible ? (tab === "agents" ? "全部 Agents" : "全部 Skills") : "筛选结果"}
                    </p>
                    <div className="mt-4 grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                      {tab === "agents"
                        ? visibleAgents.slice(pageSlice.from, pageSlice.to).map((agent) => <CommunityAgentCard key={agent.id} agent={agent} onInstall={() => installAgent(agent.id)} onOpen={() => setDetailId(agent.id)} />)
                        : visibleSkills.slice(pageSlice.from, pageSlice.to).map((skill) => <CommunitySkillCard key={skill.id} skill={skill} onInstall={() => installSkill(skill.id)} onOpen={() => setDetailId(skill.id)} />)}
                    </div>
                  </section>
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
