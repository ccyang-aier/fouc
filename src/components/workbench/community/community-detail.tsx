"use client"

/**
 * 社区详情页：单色编辑排版 —— 左栏无边框内容流（大标题、亮点清单、更新时间线、
 * 相关推荐文字行），右栏单个发丝线卡片承载动作与指标。
 */

import { CaretLeft, CaretRight, Check, CheckCircle, ShareFat } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"

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

const SECTION_HEAD = "text-[10.5px] font-medium tracking-[0.08em] text-[var(--muted)]"

export type RelatedItem = {
  id: string
  name: string
  glyph: string
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
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-panel px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[11px] font-medium text-[var(--ink)] outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <CaretLeft className="size-3.5" weight="bold" />
          社区
        </button>
        <p className="truncate text-[11px] text-[var(--muted)]">
          {TAB_LABELS[detail.tab]} <span aria-hidden className="text-[var(--line-strong)]">/</span> <span className="text-[var(--ink-soft)]">{detail.name}</span>
        </p>
        <button
          type="button"
          aria-label="分享"
          onClick={onShare}
          className="ml-auto flex size-7 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ShareFat className="size-[15px]" weight="fill" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-panel">
        <div className="mx-auto grid w-full max-w-[920px] grid-cols-1 gap-x-14 gap-y-9 px-6 pb-16 pt-9 max-[960px]:grid-cols-1 lg:grid-cols-[1fr_272px]">
          {/* ── 左栏：内容流（无边框，排版分区） ── */}
          <div className="flex min-w-0 flex-col">
            {/* 头部 */}
            <header>
              <div className="flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-[13px] bg-[var(--surface-hover)] text-[17px] font-semibold text-[var(--ink-soft)]">
                  {detail.glyph}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <h1 className="text-[21px] leading-7 font-semibold tracking-[-0.03em] text-[var(--ink)]">{detail.name}</h1>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{detail.category} · {detail.byline}</p>
                </div>
              </div>
              <p className="mt-5 max-w-[540px] text-[12.5px] leading-[21px] text-[var(--ink-soft)]">{detail.description}</p>
            </header>

            {/* 亮点 */}
            <section className="mt-10">
              <h2 className={SECTION_HEAD}>亮点</h2>
              <ul className="mt-3.5 space-y-2.5">
                {detail.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2.5 text-[12px] leading-[18px] text-[var(--ink-soft)]">
                    <Check className="mt-1 size-3.5 shrink-0 text-[var(--muted-strong)]" weight="bold" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </section>

            {/* 近期更新：时间线 */}
            <section className="mt-10">
              <h2 className={SECTION_HEAD}>近期更新</h2>
              <ol className="mt-4">
                {detail.updates.map((update, index) => (
                  <li key={`${update.version}-${update.date}`} className="relative flex gap-4 pb-5 last:pb-0">
                    {index < detail.updates.length - 1 ? (
                      <span aria-hidden className="absolute left-[3px] top-[11px] bottom-0 w-px bg-[var(--line)]" />
                    ) : null}
                    <span aria-hidden className="mt-[4px] size-[7px] shrink-0 rounded-full border border-[var(--line-strong)] bg-panel" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="font-mono text-[10px] font-medium text-[var(--ink)]">v{update.version}</span>
                        <span className="text-[9.5px] tabular-nums text-[var(--muted)]">{update.date}</span>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">{update.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* 相关推荐：文字行 */}
            {related.length > 0 ? (
              <section className="mt-10">
                <h2 className={SECTION_HEAD}>相关推荐</h2>
                <div className="-mx-2.5 mt-1.5">
                  {related.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenRelated(item.id)}
                      className="group flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-hover)] text-[11px] font-semibold text-[var(--ink-soft)]">
                        {item.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-[var(--ink)]">{item.name}</span>
                        <span className="mt-px block truncate text-[9.5px] text-[var(--muted)]">{item.meta}</span>
                      </span>
                      {item.done ? (
                        <CheckCircle className="size-3.5 shrink-0 text-[var(--muted-strong)]" weight="fill" />
                      ) : (
                        <CaretRight className="size-3.5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* ── 右栏：单个发丝线卡片，粘性 ── */}
          <aside className="min-w-0">
            <div className="rounded-[14px] border border-[var(--line)] bg-panel p-4 lg:sticky lg:top-9">
              {done ? (
                <span className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-[var(--surface-hover)] text-[11.5px] font-semibold text-[var(--ink-soft)]">
                  <Check className="size-3.5" weight="bold" />
                  {DONE_LABELS[detail.tab]}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onAction}
                  className="flex h-9 w-full items-center justify-center rounded-[9px] bg-[var(--accent)] text-[11.5px] font-semibold text-white outline-none transition-[background-color,opacity] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {ACTION_LABELS[detail.tab]}
                </button>
              )}
              <dl className="mt-4">
                {detail.stats.map((stat) => (
                  <div key={stat.label} className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0">
                    <dt className="shrink-0 text-[10px] text-[var(--muted)]">{stat.label}</dt>
                    <dd className="truncate text-[11.5px] font-medium text-[var(--ink)]">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 border-t border-[var(--line)] pt-3.5">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--muted-strong)]">
                  <Check className="size-3" weight="bold" />
                  权限与数据
                </p>
                <ul className="mt-2 space-y-1.5">
                  {detail.permissions.map((permission) => (
                    <li key={permission} className="text-[10px] leading-[15px] text-[var(--muted)]">{permission}</li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </ScrollArea>
    </div>
  )
}
