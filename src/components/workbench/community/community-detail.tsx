"use client"

/**
 * 社区详情页：两栏布局 —— 左侧内容流（头像区、亮点、更新时间线、相关推荐），
 * 右侧粘性操作卡（安装动作、关键指标、权限说明）。纯展示，动作由画布注入。
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
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--line)] bg-panel px-4">
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
        <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-3.5 px-4 pb-12 pt-5 max-[960px]:grid-cols-1 lg:grid-cols-[1fr_288px]">
          {/* ── 左栏：内容流 ── */}
          <div className="flex min-w-0 flex-col gap-3.5">
            {/* 头像区 */}
            <section className="relative overflow-hidden rounded-[14px] border border-[var(--line)] bg-panel p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(120%_100%_at_20%_0%,color-mix(in_srgb,var(--accent)_7%,transparent),transparent_70%)]"
              />
              <div className="relative flex items-start gap-4">
                <span
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-[14px] text-[17px] font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_10px_24px_-10px_rgba(30,36,42,0.28)]",
                    toneChips[detail.tone],
                  )}
                >
                  {detail.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[21px] leading-7 font-semibold tracking-[-0.03em] text-[var(--ink)]">{detail.name}</h1>
                    <span className="rounded-full bg-wash px-2 py-0.5 text-[9.5px] font-medium text-[var(--muted-strong)]">{detail.category}</span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-[var(--muted)]">{detail.byline}</p>
                  <p className="mt-3 max-w-[560px] text-[11.5px] leading-[19px] text-[var(--ink-soft)]">{detail.description}</p>
                </div>
              </div>
            </section>

            {/* 亮点 */}
            <section className="rounded-[14px] border border-[var(--line)] bg-panel p-5">
              <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">亮点</h2>
              <ul className="mt-3 space-y-2">
                {detail.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2.5 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">
                    <CheckCircle className="mt-px size-4 shrink-0 text-[#318b61]" weight="fill" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </section>

            {/* 近期更新：时间线 */}
            <section className="rounded-[14px] border border-[var(--line)] bg-panel p-5">
              <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">近期更新</h2>
              <ol className="mt-3.5">
                {detail.updates.map((update, index) => (
                  <li key={`${update.version}-${update.date}`} className="relative flex gap-3.5 pb-4 last:pb-0">
                    {index < detail.updates.length - 1 ? (
                      <span aria-hidden className="absolute left-[3.5px] top-[12px] bottom-0 w-px bg-[var(--line)]" />
                    ) : null}
                    <span aria-hidden className="mt-[5px] size-[8px] shrink-0 rounded-full border-2 border-[var(--accent)] bg-panel" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="rounded-[5px] bg-wash px-1.5 py-px font-mono text-[9.5px] font-medium text-[var(--ink-soft)]">v{update.version}</span>
                        <span className="text-[9px] tabular-nums text-[var(--muted)]">{update.date}</span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">{update.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* 相关推荐 */}
            {related.length > 0 ? (
              <section className="rounded-[14px] border border-[var(--line)] bg-panel p-5">
                <h2 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--ink)]">相关推荐</h2>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3 max-[560px]:grid-cols-1">
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

          {/* ── 右栏：粘性操作卡 ── */}
          <aside className="min-w-0">
            <div className="flex flex-col gap-3.5 lg:sticky lg:top-0 lg:pt-0">
              <section className="rounded-[14px] border border-[var(--line)] bg-panel p-4">
                {done ? (
                  <span className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#bfe3d2] bg-[#e5f4ec] text-[11.5px] font-semibold text-[#2e8b63]">
                    <CheckCircle className="size-4" weight="fill" />
                    {DONE_LABELS[detail.tab]}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onAction}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--accent)] text-[11.5px] font-semibold text-white outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:bg-[var(--accent-strong)] hover:shadow-[0_6px_16px_color-mix(in_srgb,var(--accent)_24%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:translate-y-0"
                  >
                    {ACTION_LABELS[detail.tab]}
                  </button>
                )}
                <dl className="mt-4 space-y-2.5">
                  {detail.stats.map((stat) => (
                    <div key={stat.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--line)] pb-2.5 last:border-b-0 last:pb-0">
                      <dt className="shrink-0 text-[9.5px] text-[var(--muted)]">{stat.label}</dt>
                      <dd className="truncate text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="rounded-[14px] border border-[var(--line)] bg-panel p-4">
                <h2 className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                  <ShieldCheck className="size-4 text-[#4d6fa7]" weight="fill" />
                  权限与数据
                </h2>
                <ul className="mt-2.5 space-y-1.5">
                  {detail.permissions.map((permission) => (
                    <li key={permission} className="flex items-start gap-2 text-[10.5px] leading-[16px] text-[var(--ink-soft)]">
                      <span aria-hidden className="mt-[5.5px] size-1 shrink-0 rounded-full bg-[var(--line-strong)]" />
                      {permission}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      </ScrollArea>
    </div>
  )
}
