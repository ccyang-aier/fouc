"use client"

/**
 * 社区目录的陈列区块：编辑精选主位、本周上升榜单与精选合集，
 * 与下方目录栅格共同构成市场首页的信息层级。
 */

import { ArrowRight, DownloadSimple, SealCheck, Star } from "@phosphor-icons/react"

import type { IconTone } from "@/lib/icon-tones"
import { formatInstalls } from "./community-data"
import { Avatar } from "./community-cards"

export type FeaturedModel = {
  title: string
  tagline: string
  detail?: string
  author: string
  official: boolean
  glyph: string
  tone: IconTone
  tags: string[]
  rating?: number
  ratingCount?: number
  installs: number
  version: string
  updated: string
  actionLabel: string
  actioned: boolean
  actionedLabel: string
  onOpen: () => void
  onAction: () => void
}

export function FeatureSection({ item }: { item: FeaturedModel }) {
  return (
    <div className="flex min-w-0 items-center gap-12">
      <div className="min-w-0 max-w-[620px]">
        <p className="text-[12px] font-semibold tracking-[0.02em] text-[var(--ink)]">
          <span className="mr-2 tabular-nums text-[var(--accent)]">01</span>编辑精选
        </p>
        <button
          type="button"
          onClick={item.onOpen}
          className="mt-4 block max-w-[560px] rounded-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)]">{item.title}</h2>
          <p className="mt-1.5 text-[14px] text-[var(--ink-soft)]">{item.tagline}</p>
        </button>
        <div className="mt-4 flex items-center gap-2.5">
          <Avatar glyph={item.glyph} tone={item.tone} className="size-9 text-[13px]" />
          <p className="flex items-center gap-1 text-[13.5px] font-medium text-[var(--ink)]">
            {item.author}
            {item.official ? <SealCheck className="size-4 text-[var(--accent)]" weight="fill" /> : null}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-[6px] bg-[var(--surface-hover)] px-2 py-1 text-[11px] leading-none text-[var(--muted-strong)]">
              {tag}
            </span>
          ))}
        </div>
        {item.detail ? (
          <p className="mt-3 line-clamp-2 max-w-[520px] text-[12.5px] leading-[20px] text-[var(--muted-strong)]">{item.detail}</p>
        ) : null}
        <div className="mt-5 flex items-center gap-2.5 text-[11.5px] tabular-nums text-[var(--muted)]">
          {typeof item.rating === "number" ? (
            <>
              <Star className="size-3.5 text-[#dfa43c]" weight="fill" />
              <span className="font-medium text-[var(--ink-soft)]">{item.rating}</span>
              <span>({item.ratingCount})</span>
              <span className="text-[var(--line-strong)]">|</span>
            </>
          ) : null}
          <DownloadSimple className="size-3.5" />
          <span>{formatInstalls(item.installs)} 安装</span>
          <span className="text-[var(--line-strong)]">|</span>
          <span>v{item.version}</span>
          <span className="text-[var(--line-strong)]">|</span>
          <span>{item.updated}更新</span>
        </div>
      </div>
      {item.actioned ? (
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-[var(--ok-ink)]">
          <SealCheck className="size-4" weight="fill" />
          {item.actionedLabel}
        </span>
      ) : (
        <button
          type="button"
          onClick={item.onAction}
          className="h-9 shrink-0 rounded-[8px] bg-[var(--accent)] px-6 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {item.actionLabel}
        </button>
      )}
    </div>
  )
}

export type TrendingModel = { id: string; name: string; sub: string; glyph: string; tone: IconTone; trend: number }

export function TrendingRail({ items, onOpen }: { items: TrendingModel[]; onOpen: (id: string) => void }) {
  return (
    <aside className="min-w-0">
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">本周上升</p>
      <ul className="mt-1.5 divide-y divide-[var(--line)]">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="-mx-1.5 flex w-[calc(100%+12px)] items-center gap-3 rounded-[8px] px-1.5 py-2.5 text-left outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="w-4 shrink-0 text-[13px] tabular-nums text-[var(--muted-strong)]">{index + 1}</span>
              <Avatar glyph={item.glyph} tone={item.tone} className="size-9 text-[12px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-[var(--ink)]">{item.name}</span>
                <span className="block truncate text-[11px] text-[var(--muted)]">{item.sub}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[var(--ok-ink)]">+{item.trend}%</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export type CollectionModel = {
  key: string
  title: string
  desc: string
  count: number
  authors: number
  avatars: Array<{ glyph: string; tone: IconTone }>
}

export function CollectionsRow({ collections, onSelect }: { collections: CollectionModel[]; onSelect: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-8 max-[1100px]:grid-cols-1">
      {collections.map((collection) => (
        <button
          key={collection.key}
          type="button"
          onClick={() => onSelect(collection.key)}
          className="group rounded-[10px] text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <p className="flex items-baseline gap-2 text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {collection.title}
            <span className="text-[13px] font-semibold tabular-nums text-[var(--accent)]">{collection.count}</span>
          </p>
          <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{collection.desc}</p>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="flex -space-x-2">
              {collection.avatars.map((avatar, index) => (
                <Avatar key={index} glyph={avatar.glyph} tone={avatar.tone} className="size-6 text-[10px] ring-2 ring-[var(--surface-subtle)]" />
              ))}
            </span>
            <span className="text-[11px] text-[var(--muted)]">{collection.authors} 位作者 · {collection.count} 个条目</span>
            <ArrowRight className="ml-auto size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>
        </button>
      ))}
    </div>
  )
}
