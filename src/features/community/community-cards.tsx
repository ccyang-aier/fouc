"use client"

import { Check, DownloadSimple, SealCheck, Star } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { toneChips, type IconTone } from "@/lib/icon-tones"

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

export function PreviewArtwork({ item, compact = false }: { item: CommunityLibraryItem; compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden bg-[var(--surface-subtle)]",
        compact ? "h-16 w-20 shrink-0 rounded-[8px]" : "aspect-[16/10] border-b border-[var(--line)]",
      )}
    >
      <span aria-hidden className="absolute -right-6 -top-7 size-24 rounded-full border border-current opacity-[0.08]" />
      <span aria-hidden className="absolute -bottom-8 -left-5 size-28 rounded-full border border-current opacity-[0.08]" />
      <span
        aria-hidden
        className={cn(
          "relative flex items-center justify-center rounded-[18px] font-bold shadow-[0_10px_28px_-18px_rgba(20,24,32,0.35)] ring-1 ring-white/70",
          compact ? "size-10 text-[15px]" : "size-16 text-[22px]",
          toneChips[item.tone],
        )}
      >
        {item.glyph}
      </span>
      {!compact ? (
        <span className="absolute right-2.5 top-2.5 rounded-[5px] border border-white/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.04em] text-[var(--muted-strong)] backdrop-blur-sm">
          {kindLabel[item.kind]}
        </span>
      ) : null}
    </div>
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
          "group grid min-w-[650px] cursor-default grid-cols-[80px_minmax(190px,1.35fr)_120px_100px_82px] items-center gap-4 border-b border-[var(--line)] px-3 py-2 outline-none transition-colors",
          selected ? "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]" : "hover:bg-[var(--surface-subtle)]",
        )}
      >
        <PreviewArtwork item={item} compact />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{item.name}</p>
            {item.author === "Fouc 官方" ? <SealCheck className="size-3.5 shrink-0 text-[var(--accent)]" weight="fill" /> : null}
          </div>
          <p className="mt-1 truncate text-[10.5px] text-[var(--muted)]">{item.summary}</p>
        </div>
        <span className="truncate text-[11px] text-[var(--muted-strong)]">{item.author}</span>
        <span className="text-[11px] tabular-nums text-[var(--muted-strong)]">{item.installs.toLocaleString("zh-CN")}</span>
        <span className={cn("justify-self-end rounded-full px-2 py-1 text-[9.5px] font-medium", item.installed ? "bg-[color-mix(in_srgb,var(--ok-ink)_10%,transparent)] text-[var(--ok-ink)]" : "bg-[var(--surface-hover)] text-[var(--muted-strong)]")}>
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
        "group relative min-w-0 cursor-default overflow-hidden rounded-[10px] border bg-panel text-left outline-none transition-[border-color,box-shadow,transform] duration-150",
        selected
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--line)] hover:-translate-y-px hover:border-[var(--line-strong)] hover:shadow-[0_8px_22px_-16px_rgba(20,24,32,0.28)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-2 top-2 z-10 flex size-4 items-center justify-center rounded-[4px] border text-white transition-colors",
          selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-white/80 bg-white/80",
        )}
      >
        {selected ? <Check className="size-2.5" weight="bold" /> : null}
      </span>
      <PreviewArtwork item={item} />
      <div className="p-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-[12px] font-semibold text-[var(--ink)]">{item.name}</p>
              {item.author === "Fouc 官方" ? <SealCheck className="size-3.5 shrink-0 text-[var(--accent)]" weight="fill" /> : null}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{item.author}</p>
          </div>
          {item.installed ? <span className="size-2 shrink-0 rounded-full bg-[var(--ok-ink)]" title="已获取" /> : null}
        </div>
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
          {item.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="truncate rounded-[5px] bg-[var(--surface-hover)] px-1.5 py-0.5 text-[9px] text-[var(--muted-strong)]">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[9.5px] tabular-nums text-[var(--muted)]">
          {typeof item.rating === "number" ? (
            <>
              <Star className="size-3 text-[#dfa43c]" weight="fill" />
              <span>{item.rating}</span>
            </>
          ) : null}
          <DownloadSimple className={cn("size-3", typeof item.rating === "number" && "ml-1")} />
          <span>{item.installs.toLocaleString("zh-CN")}</span>
          <span className="ml-auto">v{item.version}</span>
        </div>
      </div>
    </article>
  )
}
