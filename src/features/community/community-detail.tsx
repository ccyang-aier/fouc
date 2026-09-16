"use client"

/**
 * 社区详情页：通栏白底双栏结构 ——
 *  头部：图标 + 大标题 + 作者/更新信息 + 分类与数据徽标，右侧动作按钮；
 *  图标式下划线子页签（按类型区分）；
 *  左栏主内容直接流在白底上（无边框卡片堆叠），右栏粘性操作 + 相关推荐列表。
 */

import { useState } from "react"
import Markdown from "react-markdown"
import type { Components } from "react-markdown"
import {
  BookOpen,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  Chats,
  Check,
  ClockCounterClockwise,
  Info,
  ShareFat,
} from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import type { CommunityDetail, CommunityTab } from "./community-data"

/** Markdown 元素的极简渲染映射：排版驱动，去掉默认重样式 */
const mdComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mt-7 text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--ink)] first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-[12.5px] font-semibold text-[var(--ink)] first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[12.5px] leading-[21px] text-[var(--ink-soft)] first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="my-3 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-4">{children}</ol>,
  li: ({ children }) => {
    const hasListParent = false
    void hasListParent
    return (
      <li className="flex gap-2 text-[12.5px] leading-[19px] text-[var(--ink-soft)]">
        <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--muted)]" />
        <span className="min-w-0">{children}</span>
      </li>
    )
  },
  strong: ({ children }) => <strong className="font-semibold text-[var(--ink)]">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-[var(--surface-hover)] px-1 py-0.5 font-mono text-[11px] text-[var(--ink)]">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[var(--line-strong)] py-0.5 pl-3 text-[12px] leading-[19px] text-[var(--muted-strong)]">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)] underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-[var(--line)]" />,
}

const TAB_LABELS: Record<CommunityTab, string> = {
  agents: "Agents",
  skills: "Skills",
}

const ACTION_LABELS: Record<CommunityTab, string> = {
  agents: "获取",
  skills: "安装",
}

const DONE_LABELS: Record<CommunityTab, string> = {
  agents: "已添加",
  skills: "已安装",
}

const KIND_NOUN: Record<CommunityTab, string> = {
  agents: "助理",
  skills: "技能",
}

const SUBTABS: Record<CommunityTab, ReadonlyArray<{ id: string; label: string; icon: typeof BookOpen }>> = {
  agents: [
    { id: "overview", label: "概览", icon: BookOpen },
    { id: "versions", label: "版本历史", icon: ClockCounterClockwise },
    { id: "discussions", label: "讨论", icon: Chats },
    { id: "info", label: "信息", icon: Info },
  ],
  skills: [
    { id: "overview", label: "概览", icon: BookOpen },
    { id: "versions", label: "版本历史", icon: ClockCounterClockwise },
    { id: "discussions", label: "讨论", icon: Chats },
    { id: "info", label: "信息", icon: Info },
  ],
}

export type RelatedItem = {
  id: string
  name: string
  glyph: string
  desc: string
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
  onDiscuss,
}: {
  detail: CommunityDetail
  done: boolean
  related: RelatedItem[]
  onBack: () => void
  onAction: () => void
  onOpenRelated: (id: string) => void
  onShare: () => void
  onDiscuss: () => void
}) {
  const subtabs = SUBTABS[detail.tab]
  const [subtab, setSubtab] = useState<string>(subtabs[0].id)
  const [aboutOpen, setAboutOpen] = useState(true)

  const discussions = detail.discussions

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {/* 顶栏 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
        <button
          type="button"
          onClick={onBack}
          style={{ fontSize: 10 }}
          className="flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[10px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <CaretLeft className="size-3.5" weight="bold" />
          社区
        </button>
        <p className="truncate text-[11px] text-[var(--muted)]">
          {TAB_LABELS[detail.tab]} <span aria-hidden className="text-[var(--line-strong)]">/</span> <span className="text-[var(--ink-soft)]">{detail.name}</span>
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-panel">
        {/* ── 头部 ── */}
        <header className="px-8 pt-8 max-[760px]:px-5">
          <div className="flex items-start gap-5 max-[760px]:flex-col">
            <span className="flex size-[72px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--surface-hover)] text-[24px] font-semibold text-[var(--ink-soft)]">
              {detail.glyph}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="truncate text-[26px] leading-8 font-bold tracking-[-0.035em] text-[var(--ink)] max-[760px]:text-[21px]">{detail.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--muted-strong)]">
                <span>{detail.byline}</span>
                <span aria-hidden className="text-[var(--line-strong)]">·</span>
                <span>{detail.stats.find((stat) => stat.label === "更新")?.value ?? ""}更新</span>
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <span className="flex h-6 items-center rounded-[7px] border border-[var(--line)] px-2 text-[10.5px] font-medium text-[var(--ink-soft)]">
                  {detail.category}
                </span>
                {detail.stats
                  .filter((stat) => stat.label !== "更新" && stat.label !== "分类")
                  .map((stat) => (
                    <span key={stat.label} className="flex h-6 items-center gap-1 px-1 text-[10.5px] text-[var(--muted-strong)]">
                      <span className="font-medium text-[var(--ink-soft)]">{stat.value}</span>
                      <span className="text-[var(--muted)]">{stat.label}</span>
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              {done ? (
                <span className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--line-strong)] px-4 text-[12px] font-medium text-[var(--muted-strong)]">
                  <Check className="size-3.5" weight="bold" />
                  {DONE_LABELS[detail.tab]}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onAction}
                  className="flex h-9 items-center rounded-[8px] bg-[var(--ink)] px-5 text-[12.5px] font-semibold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {ACTION_LABELS[detail.tab]}
                </button>
              )}
              <button
                type="button"
                aria-label="分享"
                onClick={onShare}
                className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--line)] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <ShareFat className="size-4" weight="fill" />
              </button>
            </div>
          </div>

          {/* 子页签 */}
          <nav aria-label="详情分区" className="mt-7 flex items-center gap-6 overflow-x-auto border-b border-[var(--line)]">
            {subtabs.map((item) => {
              const active = subtab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSubtab(item.id)}
                  className={cn(
                    "relative flex h-10 shrink-0 items-center gap-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    active ? "font-medium text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink-soft)]",
                  )}
                >
                  <item.icon className={cn("size-4", active ? "text-[var(--ink)]" : "text-[var(--muted)]")} weight="fill" />
                  {item.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--ink)] transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                </button>
              )
            })}
          </nav>
        </header>

        {/* ── 内容：左主内容流 + 右粘性栏 ── */}
        <div className="flex items-start gap-10 px-8 pb-16 pt-7 max-[1100px]:flex-col max-[760px]:px-5">
          <div className="flex min-w-0 flex-1 flex-col">
            {subtab === "overview" ? (
              <>
                {/* 可折叠说明框：Markdown 渲染 */}
                <section className="overflow-hidden rounded-[8px] border border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => setAboutOpen((open) => !open)}
                    aria-expanded={aboutOpen}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">你可以使用该{KIND_NOUN[detail.tab]}做什么？</span>
                    <CaretRight className={cn("size-3.5 text-[var(--muted)] transition-transform duration-200", aboutOpen && "rotate-90")} weight="bold" />
                  </button>
                  {aboutOpen ? (
                    <div className="border-t border-[var(--line)] px-5 py-4">
                      <Markdown components={mdComponents}>{detail.about}</Markdown>
                    </div>
                  ) : null}
                </section>
                <section className="mt-9">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]">权限与数据</h2>
                  <ul className="mt-3.5 space-y-2">
                    {detail.permissions.map((permission) => (
                      <li key={permission} className="flex items-start gap-2.5 text-[12px] leading-[18px] text-[var(--muted-strong)]">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--muted-strong)]" weight="bold" />
                        {permission}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}

            {subtab === "versions" ? (
              <section>
                <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]">版本历史</h2>
                <div className="mt-2 flex flex-col">
                  {detail.updates.map((update, index) => (
                    <div key={`${update.version}-${update.date}`} className={cn("flex items-baseline gap-6 py-3.5", index > 0 && "border-t border-[var(--line)]")}>
                      <div className="flex w-[110px] shrink-0 flex-col">
                        <span className="text-[12.5px] font-semibold text-[var(--ink)]">v{update.version}</span>
                        <span className="mt-0.5 text-[10.5px] tabular-nums text-[var(--muted)]">{update.date}</span>
                      </div>
                      <p className="min-w-0 flex-1 text-[12.5px] leading-[19px] text-[var(--ink-soft)]">{update.note}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {subtab === "discussions" ? (
              <section>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]">讨论</h2>
                  <button
                    type="button"
                    onClick={onDiscuss}
                    className="flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--hover-fill)] px-3.5 text-[11.5px] text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <ChatCircleDots className="size-3.5" weight="fill" />
                    发起讨论
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {discussions.map((post) => (
                    <article key={post.author + post.time} className="rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_2%,transparent)] px-4 py-4">
                      <div className="flex gap-3.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] text-[12px] text-[var(--accent-ink)]">
                          {post.author.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="text-[12.5px] text-[var(--ink)]">{post.author}</p>
                            <span className="text-[10.5px] text-[var(--muted)]">{post.time}</span>
                          </div>
                          <p className="mt-1.5 text-[12.5px] leading-[20px] text-[var(--ink-soft)]">{post.text}</p>
                          <button type="button" onClick={onDiscuss} className="mt-2 rounded-[5px] text-[10.5px] text-[var(--muted)] outline-none hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">回复</button>
                        </div>
                      </div>
                      {post.replies.length > 0 ? (
                        <div className="relative ml-[18px] mt-3 space-y-2.5 pl-[34px] before:absolute before:bottom-4 before:left-0 before:top-0 before:w-px before:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]">
                          {post.replies.map((reply) => (
                            <div key={reply.author + reply.time} className="relative flex gap-2.5 before:absolute before:-left-[34px] before:top-3 before:h-px before:w-6 before:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel text-[9.5px] text-[var(--muted-strong)] shadow-[0_0_0_1px_var(--line)]">
                                {reply.author.slice(0, 1)}
                              </span>
                              <div className="min-w-0 flex-1 rounded-[9px] bg-panel px-3 py-2.5">
                                <div className="flex items-baseline gap-2"><span className="text-[11.5px] text-[var(--ink-soft)]">{reply.author}</span><span className="text-[10px] text-[var(--muted)]">{reply.time}</span></div>
                                <p className="mt-1 text-[12px] leading-[18px] text-[var(--muted-strong)]">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {subtab === "info" ? (
              <section>
                <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]">信息</h2>
                <dl className="mt-4 max-w-[640px]">
                  {detail.info.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3">
                      <dt className="shrink-0 text-[11.5px] text-[var(--muted)]">{row.label}</dt>
                      <dd className="truncate text-[12.5px] font-medium text-[var(--ink)]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>

          {/* ── 右栏：动作 + 相关推荐 ── */}
          <aside className="sticky top-0 w-[300px] shrink-0 max-[1100px]:w-full">
            {done ? (
              <span className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[9px] border border-[var(--line-strong)] text-[12px] font-medium text-[var(--muted-strong)]">
                <Check className="size-3.5" weight="bold" />
                {DONE_LABELS[detail.tab]}
              </span>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="flex h-10 w-full items-center justify-center rounded-[9px] bg-[var(--ink)] text-[12.5px] font-semibold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {ACTION_LABELS[detail.tab]}
              </button>
            )}

            {related.length > 0 ? (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold tracking-[-0.01em] text-[var(--ink)]">相关{KIND_NOUN[detail.tab]}</h3>
                  <button
                    type="button"
                    onClick={onDiscuss}
                    className="flex items-center gap-0.5 text-[11px] text-[var(--muted)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    查看更多
                    <CaretRight className="size-3" />
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {related.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenRelated(item.id)}
                      className="rounded-[10px] border border-[var(--line)] bg-panel p-3.5 text-left outline-none transition-[border-color] hover:border-[var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-[var(--surface-hover)] text-[11.5px] font-semibold text-[var(--ink-soft)]">
                          {item.glyph}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--ink)]">{item.name}</p>
                        {item.done ? <Check className="size-3.5 shrink-0 text-[var(--muted-strong)]" weight="bold" /> : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-[16px] text-[var(--muted-strong)]">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </ScrollArea>
    </div>
  )
}
