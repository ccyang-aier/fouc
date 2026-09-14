"use client"

/**
 * 社区画布：发现并安装社区贡献的 Agents / 连接器 / Skills。
 * 三个子页共用一套标题 + 分区 Tab + 搜索/分类工具栏骨架，条目以卡片栅格呈现；
 * 获取 / 连接动作即时落到本地状态并给出轻提示（V1 为本地演示数据）。
 */

import { useMemo, useState } from "react"
import { ArrowsDownUp, CaretDown, CheckCircle, Circle, MagnifyingGlass } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import {
  CommunityAgentCard,
  CommunityConnectorCard,
  CommunitySkillCard,
} from "./community-cards"
import {
  initialCommunityAgents,
  initialCommunityConnectors,
  initialCommunitySkills,
  type CommunityTab,
} from "./community-data"

const TABS: Array<{ id: CommunityTab; label: string }> = [
  { id: "agents", label: "Agents" },
  { id: "connectors", label: "连接器" },
  { id: "skills", label: "Skills" },
]

const CATEGORIES: Record<CommunityTab, string[]> = {
  agents: ["全部", "研发", "办公", "数据", "内容"],
  connectors: ["全部", "研发协作", "办公协同", "数据源", "设计资产"],
  skills: ["全部", "研发", "办公", "数据"],
}

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
  const [agents, setAgents] = useState(initialCommunityAgents)
  const [connectors, setConnectors] = useState(initialCommunityConnectors)
  const [skills, setSkills] = useState(initialCommunitySkills)
  const [toast, setToast] = useState<string | null>(null)

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function switchTab(next: CommunityTab) {
    setTab(next)
    setQuery("")
    setCategory("全部")
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
      (!normalized || `${agent.name} ${agent.tagline} ${agent.author} ${agent.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalized)),
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
    if (sort === "rating") return [...list].sort((a, b) => b.installs - a.installs) // 技能无评分，评分档退化为热门
    return [...list].sort((a, b) => b.installs - a.installs)
  }, [skills, category, normalized, sort])

  const installedAgents = agents.filter((agent) => agent.installed).length
  const connectedConnectors = connectors.filter((connector) => connector.connected).length
  const installedSkills = skills.filter((skill) => skill.installed).length

  const stats: Record<CommunityTab, string> = {
    agents: `共 ${agents.length} 位社区 Agent · 已添加 ${installedAgents} · 本周新增 2 位`,
    connectors: `共 ${connectors.length} 个连接器 · 已连接 ${connectedConnectors} · 覆盖 4 类场景`,
    skills: `共 ${skills.length} 个技能 · 已安装 ${installedSkills} · 本周新增 1 个`,
  }

  const empty = tab === "agents" ? visibleAgents.length === 0 : tab === "connectors" ? visibleConnectors.length === 0 : visibleSkills.length === 0
  const counts = { agents: visibleAgents.length, connectors: visibleConnectors.length, skills: visibleSkills.length }

  return (
    <section aria-label="社区" className="relative flex h-full min-h-0 bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 bg-panel px-5 pt-[14px] max-[900px]:px-4">
          <div className="flex min-h-[68px] items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="truncate text-[22px] leading-7 font-semibold tracking-[-0.035em] text-[var(--ink)]">社区</h1>
              <div className="mt-2 flex h-7 items-center gap-2 text-[10.5px] text-[var(--muted-strong)]">
                <Circle className="size-[11px] text-[#7856e5]" weight="fill" />
                <span>{stats[tab]}</span>
                <span aria-hidden className="text-[var(--muted)]">·</span>
                <span>内容由社区贡献，安装前请审阅权限</span>
              </div>
            </div>
            {tab !== "connectors" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="排序" className="mt-1 flex h-9 shrink-0 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                    <ArrowsDownUp className="size-4" />
                    <span className="max-[1200px]:hidden">{SORT_OPTIONS.find((option) => option.id === sort)?.label}</span>
                    <CaretDown className="size-3 max-[1200px]:hidden" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuLabel>排序方式</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuCheckboxItem key={option.id} checked={sort === option.id} onCheckedChange={() => setSort(option.id)}>
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          <nav role="tablist" aria-label="社区分区" className="mt-1.5 flex h-10 w-fit items-end gap-10">
            {TABS.map((item) => {
              const selected = tab === item.id
              return (
                <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => switchTab(item.id)} className={cn("relative flex h-10 items-end pb-1.5 text-[13px] font-semibold outline-none transition-colors after:absolute after:-inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-[var(--accent)] after:transition-transform focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", selected ? "text-[var(--ink)] after:scale-x-100" : "text-[var(--muted-strong)] after:scale-x-0 hover:text-[var(--ink-soft)]")}>
                  {item.label}
                </button>
              )
            })}
          </nav>
        </header>

        <div className="flex h-[54px] shrink-0 items-center gap-2 px-5">
          <div className="flex h-8 shrink-0 items-center overflow-hidden rounded-[7px] border border-[var(--line)] bg-panel">
            {CATEGORIES[tab].map((option) => (
              <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)} className={cn("flex h-full items-center border-l border-[var(--line)] px-3 text-[10px] font-medium outline-none transition-colors first:border-l-0 hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]", category === option ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--muted-strong)]")}>
                {option}
              </button>
            ))}
          </div>
          <label className="ml-auto flex h-8 w-[240px] items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10px] text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] max-[1200px]:w-[170px]">
            <MagnifyingGlass className="size-4 shrink-0" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={`搜索${TABS.find((item) => item.id === tab)?.label}`} placeholder="搜索名称 / 作者 / 能力" className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          </label>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#fbfbfc] px-3 pt-[10px]">
          <div className="min-h-full overflow-hidden rounded-t-[8px] border border-b-0 border-[var(--line)] bg-panel p-3">
            {empty ? (
              <p className="mx-auto mt-10 w-fit rounded-[10px] border border-dashed border-[var(--line-strong)] px-6 py-8 text-[11px] text-[var(--muted)]">
                没有匹配「{query}」的条目，换个关键词试试
              </p>
            ) : (
              <div className={cn("grid gap-2.5", tab === "connectors" ? "grid-cols-[repeat(auto-fill,minmax(300px,1fr))] max-[1100px]:grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(228px,1fr))] max-[1100px]:grid-cols-2 max-[820px]:grid-cols-1")}>
                {tab === "agents"
                  ? visibleAgents.map((agent) => <CommunityAgentCard key={agent.id} agent={agent} onInstall={() => installAgent(agent.id)} />)
                  : tab === "connectors"
                    ? visibleConnectors.map((connector) => <CommunityConnectorCard key={connector.id} connector={connector} onConnect={() => connectConnector(connector.id)} />)
                    : visibleSkills.map((skill) => <CommunitySkillCard key={skill.id} skill={skill} onInstall={() => installSkill(skill.id)} />)}
              </div>
            )}
          </div>
        </div>

        <footer className="flex h-10 shrink-0 items-center border-t border-[var(--line)] px-5 text-[9.5px] text-[var(--muted)]">
          共 {counts[tab]} 个条目
          <span className="ml-auto">连接器与技能安装后即刻生效</span>
        </footer>
      </div>

      <div role="status" aria-live="polite" className={cn("pointer-events-none absolute right-4 bottom-4 z-40 flex translate-y-2 items-center gap-2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--elevated)] px-3 py-2 text-[9.5px] font-medium text-[var(--ink)] opacity-0 shadow-[0_8px_24px_rgba(28,33,42,0.10)] transition-[opacity,transform]", toast && "translate-y-0 opacity-100")}>
        <CheckCircle className="size-3.5 text-[#318b61]" weight="fill" />
        {toast}
      </div>
    </section>
  )
}
