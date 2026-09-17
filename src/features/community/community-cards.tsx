"use client"

import { CaretDown, CaretUp, Check, DownloadSimple, SealCheck, Star } from "@phosphor-icons/react"

import { toneChips, type IconTone } from "@/lib/icon-tones"
import { cn } from "@/lib/utils"

import type { CommunitySortKey } from "./community-canvas"

export type CommunityLibraryItem = {
  id: string
  kind: "agents" | "skills"
  name: string
  glyph: string
  tone: IconTone
  category: string
  summary: string
  author: string
  version: string
  installs: number
  installed: boolean
  rating?: number
  tags: string[]
  updated: string
}

const kindLabel = { agents: "Agent", skills: "Skill" } as const
const kindBadge = {
  agents: "bg-[color-mix(in_srgb,#4f7ee8_11%,transparent)] text-[#416bc8]",
  skills: "bg-[color-mix(in_srgb,#8765d8_11%,transparent)] text-[#7452c1]",
} as const

export function CommunityAssetTable({ items, selectedId, sort, sortDirection, onSort, onSelect, onOpen }: {
  items: CommunityLibraryItem[]
  selectedId: string | null
  sort: CommunitySortKey | null
  sortDirection: "asc" | "desc"
  onSort: (sort: CommunitySortKey) => void
  onSelect: (id: string) => void
  onOpen: (id: string) => void
}) {
  const gridColumns = "grid-cols-[minmax(260px,2fr)_72px_72px_120px_84px_68px_92px_68px]"
  return (
    <div className="overflow-x-auto border-y border-[var(--line)] bg-panel">
      <div role="row" className={cn("sticky top-0 z-10 grid min-w-[950px] items-center gap-3 border-b border-[var(--line-strong)] bg-[var(--surface-subtle)] px-3 py-2 text-[9.5px] font-medium text-[var(--muted)]", gridColumns)}>
        <SortHeader label="资源" sortKey="name" activeSort={sort} direction={sortDirection} onSort={onSort} />
        <span>类型</span><span>领域</span><span>作者</span>
        <SortHeader label="更新时间" sortKey="updated" activeSort={sort} direction={sortDirection} onSort={onSort} />
        <SortHeader label="评分" sortKey="rating" activeSort={sort} direction={sortDirection} onSort={onSort} />
        <SortHeader label="下载量" sortKey="popular" activeSort={sort} direction={sortDirection} onSort={onSort} />
        <span className="text-right">版本</span>
      </div>
      {items.map((item) => {
        const selected = selectedId === item.id
        return (
          <article key={item.id} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${item.name}，${kindLabel[item.kind]}`} onClick={() => onSelect(item.id)} onDoubleClick={() => onOpen(item.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(item.id); if (event.key === " ") { event.preventDefault(); onSelect(item.id) } }} className={cn("group grid min-w-[950px] cursor-default items-center gap-3 border-b border-[var(--line)] px-3 py-[9px] outline-none transition-colors last:border-b-0 hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]", gridColumns, selected && "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]")}>
            <div className="min-w-0"><div className="flex items-center gap-1.5"><p className="truncate text-[11.5px] font-semibold text-[var(--ink)]">{item.name}</p>{item.author === "Fouc 官方" ? <SealCheck className="size-3.5 shrink-0 text-[var(--accent)]" weight="fill" /> : null}{item.installed ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--ok-ink)]" title="已获取" /> : null}</div><p className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">{item.summary}</p></div>
            <span className="text-[10px] font-medium text-[var(--accent-ink)]">{kindLabel[item.kind]}</span>
            <span className="text-[10px] text-[var(--ink-soft)]">{item.category}</span>
            <span className="truncate text-[10px] text-[var(--muted-strong)]">{item.author}</span>
            <span className="text-[10px] text-[var(--muted-strong)]">{item.updated}</span>
            <span className="flex items-center gap-1 text-[10px] tabular-nums text-[var(--ink-soft)]">{typeof item.rating === "number" ? <><Star className="size-3 text-[#dfa43c]" weight="fill" />{item.rating}</> : "—"}</span>
            <span className="text-[10px] tabular-nums text-[var(--ink-soft)]">{item.installs.toLocaleString("zh-CN")}</span>
            <span className="text-right text-[9.5px] tabular-nums text-[var(--muted)]">v{item.version}</span>
          </article>
        )
      })}
    </div>
  )
}

function SortHeader({ label, sortKey, activeSort, direction, onSort }: { label: string; sortKey: CommunitySortKey; activeSort: CommunitySortKey | null; direction: "asc" | "desc"; onSort: (sort: CommunitySortKey) => void }) {
  const active = activeSort === sortKey
  const Icon = direction === "asc" ? CaretUp : CaretDown
  return <button type="button" onClick={() => onSort(sortKey)} className={cn("flex items-center gap-1 text-left outline-none hover:text-[var(--ink-soft)] focus-visible:text-[var(--accent-ink)]", active && "text-[var(--accent-ink)]")}>{label}{active ? <Icon className="size-2.5" weight="bold" /> : null}</button>
}

export function CommunityResourceIcon({ item, size = "medium" }: { item: CommunityLibraryItem; size?: "small" | "medium" | "large" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[12px] font-bold ring-1 ring-black/[0.025]",
        size === "small" && "size-10 text-[14px]",
        size === "medium" && "size-12 text-[17px]",
        size === "large" && "size-16 rounded-[15px] text-[22px]",
        toneChips[item.tone],
      )}
    >
      {item.glyph}
    </span>
  )
}

export function CommunityAssetCard({
  item,
  selected,
  view,
  onSelect,
  onOpen,
}: {
  item: CommunityLibraryItem
  selected: boolean
  view: "grid" | "list"
  onSelect: () => void
  onOpen: () => void
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter") onOpen()
    if (event.key === " ") {
      event.preventDefault()
      onSelect()
    }
  }

  if (view === "list") {
    return (
      <article
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${item.name}，${kindLabel[item.kind]}`}
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={onKeyDown}
        className={cn(
          "group grid min-w-[620px] cursor-default grid-cols-[44px_minmax(190px,1.5fr)_120px_92px_76px] items-center gap-3 border-b border-[var(--line)] px-3 py-2 outline-none transition-colors",
          selected ? "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]" : "hover:bg-[var(--surface-subtle)]",
        )}
      >
        <CommunityResourceIcon item={item} size="small" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[12px] font-semibold text-[var(--ink)]">{item.name}</p>
            {item.author === "Fouc 官方" ? <SealCheck className="size-3.5 shrink-0 text-[var(--accent)]" weight="fill" /> : null}
          </div>
          <p className="mt-1 truncate text-[10.5px] text-[var(--muted)]">{item.summary}</p>
        </div>
        <span className="truncate text-[10.5px] text-[var(--muted-strong)]">{item.author}</span>
        <span className="text-[10.5px] tabular-nums text-[var(--muted-strong)]">{item.installs.toLocaleString("zh-CN")}</span>
        <span className={cn("justify-self-end rounded-full px-2 py-1 text-[9px] font-medium", item.installed ? "bg-[color-mix(in_srgb,var(--ok-ink)_10%,transparent)] text-[var(--ok-ink)]" : "bg-[var(--surface-hover)] text-[var(--muted-strong)]")}>
          {item.installed ? "已获取" : `v${item.version}`}
        </span>
      </article>
    )
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.name}，${kindLabel[item.kind]}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative min-w-0 cursor-default rounded-[8px] border bg-panel p-3 outline-none transition-[border-color,box-shadow,transform] duration-150",
        selected
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--line)] shadow-[0_1px_2px_rgba(20,20,18,0.025)] hover:-translate-y-px hover:border-[var(--line-strong)] hover:shadow-[0_6px_18px_-12px_rgba(20,24,32,0.35)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-[4px] border transition-[color,background-color,border-color,opacity]",
          selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line-strong)] text-transparent opacity-0 group-hover:opacity-100",
        )}
      >
        <Check className="size-2.5" weight="bold" />
      </span>

      <div className="flex items-start gap-3 pr-5">
        <CommunityResourceIcon item={item} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1">
            <h3 className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{item.name}</h3>
            {item.author === "Fouc 官方" ? <SealCheck className="size-3.5 shrink-0 text-[var(--accent)]" weight="fill" /> : null}
          </div>
          <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{item.author}</p>
          <div className="mt-1.5 flex items-center gap-1">
            <span className={cn("inline-flex rounded-[4px] px-1.5 py-0.5 text-[9px] font-semibold", kindBadge[item.kind])}>{kindLabel[item.kind]}</span>
            <span className="inline-flex rounded-[4px] border border-[var(--line)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--muted-strong)]">{item.category}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-9 text-[10.5px] leading-[18px] text-[var(--ink-soft)]">{item.summary}</p>

      <div className="mt-2.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
        {item.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="truncate rounded-[5px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--muted-strong)]">{tag}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-dashed border-[var(--line)] pt-2.5 text-[9.5px] tabular-nums text-[var(--muted)]">
        {typeof item.rating === "number" ? (
          <>
            <Star className="size-3 text-[#dfa43c]" weight="fill" />
            <span>{item.rating}</span>
          </>
        ) : null}
        <DownloadSimple className={cn("size-3", typeof item.rating === "number" && "ml-1")} />
        <span>{item.installs.toLocaleString("zh-CN")}</span>
        <span className="ml-auto">v{item.version}</span>
        {item.installed ? <span className="ml-1 size-1.5 rounded-full bg-[var(--ok-ink)]" title="已获取" /> : null}
      </div>
    </article>
  )
}
