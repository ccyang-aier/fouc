"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowClockwise,
  CaretDown,
  Check,
  CheckCircle,
  DownloadSimple,
  FunnelSimple,
  List,
  MagnifyingGlass,
  Plus,
  Robot,
  SealCheck,
  Sparkle,
  SquaresFour,
  Star,
  Storefront,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { CommunityAssetCard, PreviewArtwork, type CommunityLibraryItem } from "./community-cards"
import { CommunityDetailPage, type RelatedItem } from "./community-detail"
import {
  buildCommunityDetail,
  CATEGORIES,
  initialCommunityAgents,
  initialCommunitySkills,
  type CommunityTab,
} from "./community-data"

type Scope = "all" | CommunityTab | "installed"
type SortKey = "popular" | "rating" | "name"
type ViewMode = "grid" | "list"

const SCOPE_OPTIONS: Array<{ id: Scope; label: string; icon: typeof Storefront }> = [
  { id: "all", label: "全部资源", icon: Storefront },
  { id: "agents", label: "Agents", icon: Robot },
  { id: "skills", label: "Skills", icon: Sparkle },
  { id: "installed", label: "已获取", icon: CheckCircle },
]

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: "popular", label: "最多获取" },
  { id: "rating", label: "最高评分" },
  { id: "name", label: "名称排序" },
]

const CATEGORY_OPTIONS = [...new Set([...CATEGORIES.agents.slice(1), ...CATEGORIES.skills.slice(1)])]

function itemKindLabel(kind: CommunityTab) {
  return kind === "agents" ? "Agent" : "Skill"
}

export function CommunityCanvas() {
  const [agents, setAgents] = useState(initialCommunityAgents)
  const [skills, setSkills] = useState(initialCommunitySkills)
  const [scope, setScope] = useState<Scope>("all")
  const [category, setCategory] = useState("全部")
  const [sort, setSort] = useState<SortKey>("popular")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<ViewMode>("grid")
  const [selectedId, setSelectedId] = useState<string | null>("agent-reviewer")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const libraryItems = useMemo<CommunityLibraryItem[]>(() => [
    ...agents.map((agent) => ({
      id: agent.id,
      kind: "agents" as const,
      name: agent.name,
      glyph: agent.glyph,
      tone: agent.tone,
      category: agent.category,
      summary: agent.tagline,
      author: agent.author,
      version: agent.version,
      installs: agent.installs,
      installed: agent.installed,
      rating: agent.rating,
      tags: agent.tags,
      updated: agent.updated,
    })),
    ...skills.map((skill) => ({
      id: skill.id,
      kind: "skills" as const,
      name: skill.name,
      glyph: skill.name.slice(0, 1),
      tone: skill.tone,
      category: skill.category,
      summary: skill.summary,
      author: skill.author,
      version: skill.version,
      installs: skill.installs,
      installed: skill.installed,
      tags: skill.compat,
      updated: skill.updated,
    })),
  ], [agents, skills])

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const visibleItems = useMemo(() => {
    const filtered = libraryItems.filter((item) => {
      if (scope === "agents" || scope === "skills") {
        if (item.kind !== scope) return false
      } else if (scope === "installed" && !item.installed) return false
      if (category !== "全部" && item.category !== category) return false
      if (!normalizedQuery) return true
      return `${item.name} ${item.summary} ${item.author} ${item.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
    })
    return filtered.toSorted((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN")
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0) || b.installs - a.installs
      return b.installs - a.installs
    })
  }, [category, libraryItems, normalizedQuery, scope, sort])

  const activeSelectedId = visibleItems.some((item) => item.id === selectedId) ? selectedId : (visibleItems[0]?.id ?? null)
  const selectedItem = libraryItems.find((item) => item.id === activeSelectedId) ?? null

  const scopeCounts = useMemo(() => ({
    all: libraryItems.length,
    agents: agents.length,
    skills: skills.length,
    installed: libraryItems.filter((item) => item.installed).length,
  }), [agents.length, libraryItems, skills.length])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of libraryItems) counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
    return counts
  }, [libraryItems])

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

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function acquireItem(item: CommunityLibraryItem) {
    if (item.installed) return
    if (item.kind === "agents") {
      setAgents((list) => list.map((agent) => agent.id === item.id ? { ...agent, installed: true } : agent))
      notify(`${item.name} 已添加到你的 Agent 列表`)
    } else {
      setSkills((list) => list.map((skill) => skill.id === item.id ? { ...skill, installed: true } : skill))
      notify(`${item.name} 已安装，可在任务中引用`)
    }
  }

  const detail = useMemo(() => {
    if (!detailId) return null
    const agent = agents.find((item) => item.id === detailId)
    if (agent) {
      return {
        model: buildCommunityDetail("agents", agent),
        done: agent.installed,
        onAction: () => acquireItem(libraryItems.find((item) => item.id === agent.id)!),
        related: agents.filter((item) => item.id !== agent.id && item.category === agent.category).slice(0, 3)
          .map<RelatedItem>((item) => ({ id: item.id, name: item.name, glyph: item.glyph, desc: item.tagline, done: item.installed })),
      }
    }
    const skill = skills.find((item) => item.id === detailId)
    if (!skill) return null
    return {
      model: buildCommunityDetail("skills", skill),
      done: skill.installed,
      onAction: () => acquireItem(libraryItems.find((item) => item.id === skill.id)!),
      related: skills.filter((item) => item.id !== skill.id && item.category === skill.category).slice(0, 3)
        .map<RelatedItem>((item) => ({ id: item.id, name: item.name, glyph: item.name.slice(0, 1), desc: item.summary, done: item.installed })),
    }
    // acquireItem only writes the item selected by this derived detail model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, detailId, libraryItems, skills])

  if (detail) {
    return (
      <section aria-label="社区详情" className="relative flex h-full min-h-0 bg-panel">
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
      </section>
    )
  }

  return (
    <section aria-label="社区资产库" className="relative flex h-full min-h-0 flex-col bg-panel">
      <div className="grid min-h-0 flex-1 grid-cols-[176px_minmax(0,1fr)_286px] max-[1150px]:grid-cols-[160px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-[var(--line)] px-3 py-3">
          <div className="flex items-center justify-between px-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">资源集合</p>
            <button type="button" aria-label="新建集合" onClick={() => notify("自定义集合即将开放")} className="flex size-6 items-center justify-center rounded-[6px] text-[var(--muted)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink)]">
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="mt-1 space-y-0.5">
            {SCOPE_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[11px] transition-colors",
                  scope === item.id ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] font-medium text-[var(--accent-ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--hover-fill)]",
                )}
              >
                <item.icon className="size-3.5 shrink-0" weight={scope === item.id ? "fill" : "regular"} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-[9.5px] tabular-nums text-[var(--muted)]">{scopeCounts[item.id]}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between px-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">分类</p>
            {category !== "全部" ? (
              <button type="button" onClick={() => setCategory("全部")} className="text-[9.5px] text-[var(--accent-ink)] hover:underline">清除</button>
            ) : null}
          </div>
          <div className="mt-1 space-y-0.5">
            {CATEGORY_OPTIONS.map((item) => {
              const active = category === item
              return (
                <button key={item} type="button" onClick={() => setCategory(active ? "全部" : item)} className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[11px] text-[var(--ink-soft)] hover:bg-[var(--hover-fill)]">
                  <span className={cn("flex size-3.5 items-center justify-center rounded-[3px] border", active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line-strong)]")}>
                    {active ? <Check className="size-2.5" weight="bold" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item}</span>
                  <span className="text-[9.5px] tabular-nums text-[var(--muted)]">{categoryCounts.get(item) ?? 0}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 border-t border-[var(--line)] px-1.5 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">来源</p>
            <div className="mt-2 space-y-2.5 text-[10.5px] text-[var(--muted-strong)]">
              <p className="flex items-center gap-2"><SealCheck className="size-3.5 text-[var(--accent)]" weight="fill" />Fouc 官方精选</p>
              <p className="flex items-center gap-2"><Storefront className="size-3.5" />社区作者发布</p>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          <header className="shrink-0 border-b border-[var(--line)] px-3 pt-3">
            <div className="flex items-center gap-2">
              <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)]">
                <MagnifyingGlass className="size-3.5 shrink-0" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="搜索社区资源"
                  placeholder="搜索资源名称、作者、标签或描述…"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                />
                <kbd className="rounded-[4px] border border-[var(--line)] px-1.5 text-[9px] leading-[15px] text-[var(--muted)]">/</kbd>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex h-8 items-center gap-1.5 rounded-[7px] border border-[var(--line)] px-2.5 text-[10.5px] text-[var(--ink-soft)] outline-none hover:border-[var(--line-strong)] data-[state=open]:border-[var(--line-strong)]">
                    <FunnelSimple className="size-3.5" />
                    {SORT_OPTIONS.find((item) => item.id === sort)?.label}
                    <CaretDown className="size-3 text-[var(--muted)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {SORT_OPTIONS.map((item) => (
                    <DropdownMenuCheckboxItem key={item.id} checked={sort === item.id} onCheckedChange={() => setSort(item.id)}>
                      {item.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" aria-label="提交资源" onClick={() => notify("作品提交通道即将开放")} className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[var(--accent)] text-white outline-none transition-colors hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <Plus className="size-3.5" weight="bold" />
              </button>
            </div>
            <nav aria-label="资源范围" className="mt-2 flex h-8 items-end gap-5">
              {SCOPE_OPTIONS.map((item) => (
                <button key={item.id} type="button" onClick={() => setScope(item.id)} className={cn("relative flex h-8 items-center gap-1.5 text-[10.5px] outline-none transition-colors", scope === item.id ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink-soft)]")}>
                  {item.label}
                  <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[8.5px] tabular-nums text-[var(--muted-strong)]">{scopeCounts[item.id]}</span>
                  <span className={cn("absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[var(--ink)] transition-opacity", scope === item.id ? "opacity-100" : "opacity-0")} />
                </button>
              ))}
            </nav>
          </header>

          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
            <p className="text-[10.5px] tabular-nums text-[var(--muted)]">共 {visibleItems.length} 项资源</p>
            <div className="ml-auto flex items-center rounded-[7px] border border-[var(--line)] bg-[var(--surface-subtle)] p-0.5">
              {(["grid", "list"] as const).map((mode) => {
                const Icon = mode === "grid" ? SquaresFour : List
                return (
                  <button key={mode} type="button" aria-label={mode === "grid" ? "网格视图" : "列表视图"} aria-pressed={view === mode} onClick={() => setView(mode)} className={cn("flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)]", view === mode && "bg-panel text-[var(--ink)] shadow-[0_1px_3px_rgba(20,24,32,0.08)]")}>
                    <Icon className="size-3.5" weight={view === mode ? "fill" : "regular"} />
                  </button>
                )
              })}
            </div>
            <button type="button" aria-label="刷新社区资源" onClick={() => notify("社区资源已是最新")} className="flex size-7 items-center justify-center rounded-[7px] text-[var(--muted)] hover:bg-[var(--hover-fill)] hover:text-[var(--ink)]">
              <ArrowClockwise className="size-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {visibleItems.length > 0 ? (
              view === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-3">
                  {visibleItems.map((item) => (
                    <CommunityAssetCard key={item.id} item={item} selected={activeSelectedId === item.id} view="grid" onSelect={() => setSelectedId(item.id)} onOpen={() => setDetailId(item.id)} />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[8px] border border-[var(--line)]">
                  {visibleItems.map((item) => (
                    <CommunityAssetCard key={item.id} item={item} selected={activeSelectedId === item.id} view="list" onSelect={() => setSelectedId(item.id)} onOpen={() => setDetailId(item.id)} />
                  ))}
                </div>
              )
            ) : (
              <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                <MagnifyingGlass className="size-6 text-[var(--muted)]" />
                <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">没有匹配的社区资源</p>
                <button type="button" onClick={() => { setQuery(""); setCategory("全部"); setScope("all") }} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">清除筛选条件</button>
              </div>
            )}
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-[var(--line)] max-[1150px]:hidden">
          {selectedItem ? (
            <div className="flex min-h-full flex-col">
              <div className="p-3 pb-0">
                <PreviewArtwork item={selectedItem} />
              </div>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h2 className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--ink)]">{selectedItem.name}</h2>
                      {selectedItem.author === "Fouc 官方" ? <SealCheck className="size-4 shrink-0 text-[var(--accent)]" weight="fill" /> : null}
                    </div>
                    <p className="mt-1 text-[10.5px] text-[var(--muted)]">{selectedItem.author} · {selectedItem.updated}更新</p>
                  </div>
                  <span className="rounded-[6px] bg-[var(--surface-hover)] px-2 py-1 text-[9px] font-medium text-[var(--muted-strong)]">{itemKindLabel(selectedItem.kind)}</span>
                </div>

                <p className="mt-4 text-[11.5px] leading-[19px] text-[var(--ink-soft)]">{selectedItem.summary}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {selectedItem.tags.map((tag) => <span key={tag} className="rounded-[6px] bg-[var(--surface-hover)] px-2 py-1 text-[9.5px] text-[var(--muted-strong)]">{tag}</span>)}
                </div>

                <dl className="mt-5 border-y border-[var(--line)] py-2">
                  {[
                    ["分类", selectedItem.category],
                    ["版本", `v${selectedItem.version}`],
                    ["获取量", selectedItem.installs.toLocaleString("zh-CN")],
                    ["状态", selectedItem.installed ? "已获取" : "可获取"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-1.5 text-[10.5px]">
                      <dt className="text-[var(--muted)]">{label}</dt>
                      <dd className="truncate font-medium text-[var(--ink-soft)]">{value}</dd>
                    </div>
                  ))}
                </dl>

                {typeof selectedItem.rating === "number" ? (
                  <div className="mt-4 flex items-center gap-1.5">
                    <Star className="size-4 text-[#dfa43c]" weight="fill" />
                    <span className="text-[12px] font-semibold text-[var(--ink)]">{selectedItem.rating}</span>
                    <span className="text-[10px] text-[var(--muted)]">社区评分</span>
                  </div>
                ) : null}

                <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    disabled={selectedItem.installed}
                    onClick={() => acquireItem(selectedItem)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[11px] font-semibold text-white outline-none transition-colors hover:bg-[var(--accent-strong)] disabled:bg-[var(--surface-hover)] disabled:text-[var(--ok-ink)]"
                  >
                    {selectedItem.installed ? <CheckCircle className="size-3.5" weight="fill" /> : <DownloadSimple className="size-3.5" />}
                    {selectedItem.installed ? "已获取" : selectedItem.kind === "agents" ? "获取 Agent" : "安装 Skill"}
                  </button>
                  <button type="button" onClick={() => setDetailId(selectedItem.id)} className="h-9 rounded-[8px] border border-[var(--line-strong)] px-3 text-[10.5px] font-medium text-[var(--ink-soft)] hover:bg-[var(--hover-fill)]">
                    查看详情
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-[11px] leading-[18px] text-[var(--muted)]">选择一个资源以查看详情</div>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} role="status" className="pointer-events-none absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-[8px] border border-white/10 bg-[var(--ink)] px-3.5 py-2 text-[10px] font-medium text-white shadow-[0_8px_24px_rgba(28,33,42,0.16)]">
            <CheckCircle className="size-3.5" weight="fill" />
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
