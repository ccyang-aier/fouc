"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  CaretDown,
  Check,
  CheckCircle,
  DotsThree,
  DownloadSimple,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  SealCheck,
  SquaresFour,
  Star,
  Table,
  Users,
  X,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { CommunityAssetCard, CommunityAssetTable, CommunityResourceIcon, type CommunityLibraryItem } from "./community-cards"
import { CommunityDetailPage, type RelatedItem } from "./community-detail"
import { CommunityFacets, type CommunityTypeFilter } from "./community-facets"
import {
  buildCommunityDetail,
  initialCommunityAgents,
  initialCommunitySkills,
  type CommunityTab,
} from "./community-data"

export type CommunitySortKey = "popular" | "rating" | "name" | "updated"
type ViewMode = "grid" | "list"
type AudienceFilter = "all" | "official" | "community"

const SORT_OPTIONS: Array<{ id: CommunitySortKey; label: string }> = [
  { id: "popular", label: "最多获取" },
  { id: "rating", label: "最高评分" },
  { id: "name", label: "名称排序" },
  { id: "updated", label: "最近更新" },
]

function updatedWeight(value: string) {
  const amount = Number.parseInt(value, 10) || 0
  if (value.includes("小时")) return amount / 24
  if (value.includes("周")) return amount * 7
  return amount
}

function itemKindLabel(kind: CommunityTab) {
  return kind === "agents" ? "Agent" : "Skill"
}

function itemMatchesDomain(item: CommunityLibraryItem, domain: string) {
  if (!domain) return true
  if (domain === "写作") return item.category === "内容" || item.tags.some((value) => ["文档", "长文", "周报", "扩写"].includes(value))
  return item.category === domain
}

export function CommunityCanvas() {
  const [agents, setAgents] = useState(initialCommunityAgents)
  const [skills, setSkills] = useState(initialCommunitySkills)
  const [typeFilter, setTypeFilter] = useState<CommunityTypeFilter>("all")
  const [domain, setDomain] = useState("")
  const [tag, setTag] = useState("")
  const [minRating, setMinRating] = useState(0)
  const [minDownloads, setMinDownloads] = useState(0)
  const [audience, setAudience] = useState<AudienceFilter>("all")
  const [sort, setSort] = useState<CommunitySortKey>("popular")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<ViewMode>("grid")
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
      if (typeFilter === "agents" || typeFilter === "skills") {
        if (item.kind !== typeFilter) return false
      } else if (typeFilter === "plugins" || typeFilter === "prompts") return false
      if (!itemMatchesDomain(item, domain)) return false
      if (tag && !item.tags.includes(tag)) return false
      if ((item.rating ?? 0) < minRating) return false
      if (item.installs < minDownloads) return false
      if (audience === "official" && item.author !== "Fouc 官方") return false
      if (audience === "community" && item.author === "Fouc 官方") return false
      if (!normalizedQuery) return true
      return `${item.name} ${item.summary} ${item.author} ${item.tags.join(" ")}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
    })
    return filtered.toSorted((a, b) => {
      let comparison = 0
      if (sort === "name") comparison = a.name.localeCompare(b.name, "zh-CN")
      else if (sort === "rating") comparison = (a.rating ?? 0) - (b.rating ?? 0) || a.installs - b.installs
      else if (sort === "updated") comparison = updatedWeight(a.updated) - updatedWeight(b.updated)
      else comparison = a.installs - b.installs
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [audience, domain, libraryItems, minDownloads, minRating, normalizedQuery, sort, sortDirection, tag, typeFilter])

  const activeSelectedId = selectedId && visibleItems.some((item) => item.id === selectedId) ? selectedId : null
  const selectedItem = libraryItems.find((item) => item.id === activeSelectedId) ?? null

  const typeCounts = useMemo<Record<CommunityTypeFilter, number>>(() => ({
    all: libraryItems.length,
    agents: agents.length,
    skills: skills.length,
    plugins: 0,
    prompts: 0,
  }), [agents.length, libraryItems, skills.length])

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const label of ["研发", "办公", "数据", "内容", "写作"]) {
      counts.set(label, libraryItems.filter((item) => itemMatchesDomain(item, label)).length)
    }
    return counts
  }, [libraryItems])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of libraryItems) {
      for (const label of item.tags) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return new Map([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN")))
  }, [libraryItems])

  const activeFilterCount = Number(minRating > 0) + Number(minDownloads > 0) + Number(audience !== "all")

  function clearAdvancedFilters() {
    setMinRating(0)
    setMinDownloads(0)
    setAudience("all")
  }

  function chooseSort(next: CommunitySortKey) {
    if (sort === next) setSortDirection((current) => current === "asc" ? "desc" : "asc")
    else {
      setSort(next)
      setSortDirection(next === "name" || next === "updated" ? "asc" : "desc")
    }
  }

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
      <div className="flex min-h-0 flex-1">
        <CommunityFacets type={typeFilter} domain={domain} tag={tag} typeCounts={typeCounts} domainCounts={domainCounts} tagCounts={tagCounts} onTypeChange={setTypeFilter} onDomainChange={setDomain} onTagChange={setTag} />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-[50px] shrink-0 items-center justify-between border-b border-[var(--line)] px-[18px]">
            <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
              <span>社区</span><span aria-hidden className="text-[var(--line-strong)]">/</span><strong className="truncate font-medium text-[var(--muted-strong)]">{typeFilter === "all" ? "全部资源" : typeFilter === "agents" ? "Agents" : typeFilter === "skills" ? "Skill" : typeFilter === "plugins" ? "Plugin" : "Prompt"}</strong>
            </nav>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => notify("作品提交通道即将开放")} className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_18%,transparent)] outline-none hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <Plus className="size-3.5" weight="bold" />提交资源
              </button>
              <button type="button" aria-label="更多社区操作" onClick={() => notify("更多社区能力即将开放")} className="flex size-[30px] items-center justify-center rounded-[6px] border border-[var(--line)] text-[var(--muted-strong)] outline-none hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <DotsThree className="size-[18px]" weight="bold" />
              </button>
            </div>
          </header>

          <div className="flex shrink-0 items-center justify-between gap-[18px] px-[18px] py-[13px]">
            <div className="flex min-w-0 w-full max-w-[410px] items-center gap-2.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" data-active={activeFilterCount > 0 || undefined} className="flex h-8 w-[110px] shrink-0 items-center justify-between rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[10px] text-[var(--ink-soft)] outline-none hover:border-[var(--line-strong)] data-[active=true]:border-[var(--accent-soft-line)] data-[active=true]:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] data-[active=true]:text-[var(--accent-ink)]">
                    <span className="flex items-center gap-1.5"><FunnelSimple className="size-3.5" />类型筛选{activeFilterCount ? <b className="flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] text-white">{activeFilterCount}</b> : null}</span><CaretDown className="size-3 text-[var(--muted)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[202px] p-1.5">
                  <FilterSubmenu label="评分" icon={<Star weight="fill" />} value={minRating} options={[{ value: 0, label: "不限" }, { value: 4.5, label: "4.5 以上" }, { value: 4.8, label: "4.8 以上" }]} onChange={setMinRating} />
                  <FilterSubmenu label="下载量" icon={<DownloadSimple />} value={minDownloads} options={[{ value: 0, label: "不限" }, { value: 5000, label: "5 千以上" }, { value: 10000, label: "1 万以上" }]} onChange={setMinDownloads} />
                  <FilterSubmenu label="用户" icon={<Users />} value={audience} options={[{ value: "all", label: "全部用户" }, { value: "official", label: "Fouc 官方" }, { value: "community", label: "社区作者" }]} onChange={setAudience} />
                  {activeFilterCount ? <DropdownMenuItem onSelect={clearAdvancedFilters} className="mt-1 border-t border-[var(--line)] text-[10px] text-[var(--accent-ink)]">清除全部筛选</DropdownMenuItem> : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <label className="flex h-8 min-w-[150px] max-w-[290px] flex-1 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)]">
                <MagnifyingGlass className="size-4 shrink-0" />
                <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索社区资源" placeholder="搜索资源名称、标签或描述…" className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
              </label>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              <div className="flex h-8 items-center overflow-hidden rounded-[6px] border border-[var(--line)]" aria-label="浏览方式">
              {(["list", "grid"] as const).map((mode) => {
                const Icon = mode === "grid" ? SquaresFour : Table
                return (
                  <button key={mode} type="button" aria-label={mode === "grid" ? "网格视图" : "列表视图"} aria-pressed={view === mode} onClick={() => setView(mode)} className={cn("flex size-[30px] items-center justify-center text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)]", view === mode && "bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] text-[var(--accent-ink)]")}>
                    <Icon className={mode === "grid" ? "size-[17px]" : "size-[17px]"} weight={view === mode ? "fill" : "regular"} />
                  </button>
                )
              })}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex h-8 w-[84px] items-center justify-between gap-1 whitespace-nowrap rounded-[6px] border border-[var(--line)] px-2 text-[10px] text-[var(--ink-soft)] outline-none hover:border-[var(--line-strong)]">
                    {SORT_OPTIONS.find((item) => item.id === sort)?.label}<CaretDown className="size-3 text-[var(--muted)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {SORT_OPTIONS.map((item) => <DropdownMenuCheckboxItem key={item.id} checked={sort === item.id} onCheckedChange={() => chooseSort(item.id)}>{item.label}</DropdownMenuCheckboxItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-20 pt-0.5">
            <p className="mb-3 text-[10px] tabular-nums text-[var(--muted)]">共 {visibleItems.length} 项资源</p>
            {visibleItems.length > 0 ? (
              view === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                  {visibleItems.map((item) => (
                    <CommunityAssetCard key={item.id} item={item} selected={activeSelectedId === item.id} view="grid" onSelect={() => setSelectedId(item.id)} onOpen={() => setDetailId(item.id)} />
                  ))}
                </div>
              ) : (
                <CommunityAssetTable items={visibleItems} selectedId={activeSelectedId} sort={sort} sortDirection={sortDirection} onSort={chooseSort} onSelect={setSelectedId} onOpen={setDetailId} />
              )
            ) : (
              <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                <MagnifyingGlass className="size-6 text-[var(--muted)]" />
                <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">没有匹配的社区资源</p>
                <button type="button" onClick={() => { setQuery(""); setTag(""); setDomain(""); setTypeFilter("all"); clearAdvancedFilters() }} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">清除筛选条件</button>
              </div>
            )}
          </div>
        </main>

        {selectedItem ? (
          <aside aria-label="资源详情检查器" className="w-[304px] shrink-0 min-h-0 overflow-y-auto border-l border-[var(--line)] bg-panel max-[1150px]:hidden">
            <div className="flex min-h-full flex-col">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)] bg-panel px-4">
                <span className="text-[10.5px] font-semibold text-[var(--ink-soft)]">资源详情</span>
                <button type="button" aria-label="关闭资源详情" title="关闭" onClick={() => setSelectedId(null)} className="flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><X className="size-3.5" weight="bold" /></button>
              </div>

              <div className="flex flex-1 flex-col">
                <div className="px-5 pb-5 pt-5">
                  <div className="flex items-start gap-3.5"><CommunityResourceIcon item={selectedItem} size="medium" /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--ink)]">{selectedItem.name}</h2>{selectedItem.author === "Fouc 官方" ? <SealCheck className="size-4 shrink-0 text-[var(--accent)]" weight="fill" /> : null}</div><p className="mt-1 text-[10px] text-[var(--muted)]">{selectedItem.author} · {selectedItem.updated}更新</p><div className="mt-2 flex items-center gap-2 text-[9.5px]"><span className="font-semibold text-[var(--accent-ink)]">{itemKindLabel(selectedItem.kind)}</span><span className="size-1 rounded-full bg-[var(--line-strong)]" /><span className="text-[var(--muted-strong)]">{selectedItem.category}</span></div></div></div>
                  <p className="mt-4 text-[11px] leading-[19px] text-[var(--ink-soft)]">{selectedItem.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">{selectedItem.tags.map((label) => <span key={label} className="text-[9.5px] text-[var(--muted-strong)]">#{label}</span>)}</div>
                </div>

                <div className="grid grid-cols-2 border-y border-[var(--line)]">
                  <div className="px-5 py-3"><p className="text-[9px] text-[var(--muted)]">累计获取</p><p className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--ink)]">{selectedItem.installs.toLocaleString("zh-CN")}</p></div>
                  <div className="border-l border-[var(--line)] px-5 py-3"><p className="text-[9px] text-[var(--muted)]">社区评分</p><p className="mt-1 flex items-center gap-1 text-[14px] font-semibold tabular-nums text-[var(--ink)]"><Star className="size-3.5 text-[#dfa43c]" weight="fill" />{selectedItem.rating ?? "—"}</p></div>
                </div>

                <dl className="px-5 py-2">
                  {[["类型", itemKindLabel(selectedItem.kind)], ["领域", selectedItem.category], ["版本", `v${selectedItem.version}`], ["状态", selectedItem.installed ? "已获取" : "可获取"]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2 text-[10.5px]"><dt className="text-[var(--muted)]">{label}</dt><dd className="truncate font-medium text-[var(--ink-soft)]">{value}</dd></div>)}
                </dl>

                <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 border-t border-[var(--line)] p-4">
                  <button type="button" disabled={selectedItem.installed} onClick={() => acquireItem(selectedItem)} className="flex h-9 items-center justify-center gap-1.5 rounded-[7px] bg-[var(--accent)] px-3 text-[11px] font-semibold text-white outline-none transition-colors hover:bg-[var(--accent-strong)] disabled:bg-[var(--surface-hover)] disabled:text-[var(--ok-ink)]">{selectedItem.installed ? <CheckCircle className="size-3.5" weight="fill" /> : <DownloadSimple className="size-3.5" />}{selectedItem.installed ? "已获取" : selectedItem.kind === "agents" ? "获取 Agent" : "安装 Skill"}</button>
                  <button type="button" onClick={() => setDetailId(selectedItem.id)} className="h-9 rounded-[7px] border border-[var(--line-strong)] px-3 text-[10.5px] font-medium text-[var(--ink-soft)] hover:bg-[var(--hover-fill)]">查看详情</button>
                </div>
              </div>
            </div>
          </aside>
        ) : null}
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

function FilterSubmenu<T extends string | number>({ label, icon, value, options, onChange }: { label: string; icon: React.ReactNode; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  const selectedLabel = options.find((option) => option.value === value)?.label
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="h-9 text-[11px] [&>svg:first-child]:text-[var(--muted)]">
        {icon}<span>{label}</span><span className="ml-auto mr-1 text-[9.5px] text-[var(--muted)]">{selectedLabel}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-36">
        {options.map((option) => <DropdownMenuItem key={String(option.value)} onSelect={() => onChange(option.value)} className="text-[11px]"><span className="flex size-4 items-center justify-center">{value === option.value ? <Check className="size-3" weight="bold" /> : null}</span>{option.label}</DropdownMenuItem>)}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
