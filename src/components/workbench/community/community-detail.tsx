"use client"

/**
 * 社区详情页：卡片点击进入，返回栏 + 头像区 + 指标条 + 安装动作 +
 * 简介 / 亮点 / 近期更新 / 权限与数据 / 相关推荐。纯展示，动作由画布注入。
 */

import { CaretLeft, CheckCircle, ShareFat, ShieldCheck } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { toneChips } from "../icon-tones"
import type { CommunityDetail, CommunityTab } from "./community-data"

const TAB_LABELS: Record<CommunityTab, string> = {
  agents: "Agents",
  connectors: "连接器",
  skills: "Skills",
}

const ACTION_LABELS: Record<CommunityTab, string> = {
  agents: "获取",
  connectors: "连接",
  skills: "安装",
}

const DONE_LABELS: Record<CommunityTab, string> = {
  agents: "已添加",
  connectors: "已连接",
  skills: "已安装",
}

export type RelatedItem = {
  id: string
  name: string
  glyph: string
  tone: CommunityDetail["tone"]
  meta: string
  done: boolean
}

export function CommunityDetailPage({
  detail,
  done,
  related,
  onBack,
  onAction,
  onOpenRelated,
  onShare,
}: {
  detail: CommunityDetail
  done: boolean
  related: RelatedItem[]
  onBack: () => void
  onAction: () => void
  onOpenRelated: (id: string) => void
  onShare: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {/* 返回栏 */}
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--line)] px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[10.5px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <CaretLeft className="size-3.5" weight="bold" />
          返回社区
        </button>
        <p className="truncate text-[10.5px] text-[var(--muted)]">
          社区 <span aria-hidden className="text-[var(--line-strong)]">/</span> {TAB_LABELS[detail.tab]} <span aria-hidden className="text-[var(--line-strong)]">/</span> <span className="text-[var(--ink-soft)]">{detail.name}</span>
        </p>
        <button
          type="button"
          aria-label="分享"
          onClick={onShare}
          className="ml-auto flex size-7 items-center justify-center rounded-full text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ShareFat className="size-[15px]" weight="fill" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-[#fbfbfc]">
        <div className="mx-auto w-full max-w-[760px] px-6 pb-12 pt-8 max-[760px]:px-4">
          {/* 头像区 */}
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-[14px] text-[17px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_10px_24px_-10px_rgba(30,36,42,0.25)]",
                toneChips[detail.tone],
              )}
            >
              {detail.glyph}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.03em] text-[var(--ink)]">{detail.name}</h1>
                <span className="rounded-full bg-wash px-2 py-0.5 text-[9.5px] font-medium text-[var(--muted-strong)]">{detail.category}</span>
              </div>
              <p className="mt-1 text-[10.5px] text-[var(--muted)]">{detail.byline}</p>
            </div>
            {done ? (
              <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] border border-[#bfe3d2] bg-[#e5f4ec] px-3.5 text-[11px] font-semibold text-[#2e8b63]">
                <CheckCircle className="size-4" weight="fill" />
                {DONE_LABELS[detail.tab]}
              </span>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-[9px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-white outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:bg-[var(--accent-strong)] hover:shadow-[0_5px_14px_color-mix(in_srgb,var(--accent)_22%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:translate-y-0"
              >
                {ACTION_LABELS[detail.tab]}
              </button>
            )}
          </div>

          {/* 指标条 */}
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-[12px] border border-[var(--line)] bg-panel sm:grid-cols-4">
            {detail.stats.map((stat) => (
              <div key={stat.label} className="flex min-w-0 flex-col gap-1 border-l border-[var(--line)] px-4 py-3 first:border-l-0">
                <span className="text-[9px] text-[var(--muted)]">{stat.label}</span>
                <span className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* 简介 */}
          <section className="mt-7">
            <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">简介</h2>
            <p className="mt-2 text-[11.5px] leading-[20px] text-[var(--ink-soft)]">{detail.description}</p>
          </section>

          {/* 亮点 */}
          <section className="mt-7">
            <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">亮点</h2>
            <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {detail.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2 rounded-[9px] border border-[var(--line)] bg-panel px-3 py-2.5 text-[11px] leading-[16px] text-[var(--ink-soft)]"
                >
                  <CheckCircle className="mt-px size-3.5 shrink-0 text-[#318b61]" weight="fill" />
                  {highlight}
                </li>
              ))}
            </ul>
          </section>

          {/* 近期更新 */}
          <section className="mt-7">
            <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">近期更新</h2>
            <ul className="mt-2.5 overflow-hidden rounded-[12px] border border-[var(--line)] bg-panel">
              {detail.updates.map((update, index) => (
                <li key={`${update.version}-${update.date}`} className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-[var(--line)]")}>
                  <span className="shrink-0 rounded-[6px] bg-wash px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--muted-strong)]">v{update.version}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--ink-soft)]">{update.note}</span>
                  <span className="shrink-0 text-[9.5px] tabular-nums text-[var(--muted)]">{update.date}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 权限与数据 */}
          <section className="mt-7">
            <h2 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              <ShieldCheck className="size-4 text-[#4d6fa7]" weight="fill" />
              权限与数据
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {detail.permissions.map((permission) => (
                <li key={permission} className="flex items-start gap-2 text-[11px] leading-[17px] text-[var(--ink-soft)]">
                  <span aria-hidden className="mt-[6px] size-1 shrink-0 rounded-full bg-[var(--line-strong)]" />
                  {permission}
                </li>
              ))}
            </ul>
          </section>

          {/* 相关推荐 */}
          {related.length > 0 ? (
            <section className="mt-7">
              <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">相关推荐</h2>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                {related.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenRelated(item.id)}
                    className="group flex items-center gap-2.5 rounded-[10px] border border-[var(--line)] bg-panel p-2.5 text-left outline-none transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:border-[var(--accent-soft-line)] hover:shadow-[0_10px_22px_-10px_rgba(30,36,42,0.14)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold", toneChips[item.tone])}>
                      {item.glyph}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-[var(--ink)]">{item.name}</span>
                      <span className="mt-px block truncate text-[9px] text-[var(--muted)]">{item.meta}</span>
                    </span>
                    {item.done ? <CheckCircle className="size-3.5 shrink-0 text-[#318b61]" weight="fill" /> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
