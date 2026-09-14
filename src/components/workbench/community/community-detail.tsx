"use client"

/**
 * 社区详情页：macOS App Store 桌面版结构 ——
 * 白底大头部（80px 图标 + 大标题 + 元信息 + 胶囊动作）、
 * 下划线式横排子页签（概览/能力/版本历史/相似助理…按类型区分）、
 * 灰底内容区承载完整分区卡片。子页签随类型切换重置。
 */

import { useState } from "react"
import { CaretLeft, Check, ChatCircleDots, ShareFat } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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

const SUBTABS: Record<CommunityTab, readonly string[]> = {
  agents: ["概览", "能力", "版本历史", "相似助理"],
  skills: ["概览", "安装", "讨论", "信息"],
  connectors: ["概览", "信息", "版本历史"],
}

const RELATED_TAB_LABEL: Record<CommunityTab, string> = {
  agents: "相似助理",
  skills: "相关技能",
  connectors: "相关连接器",
}

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
  const [subtab, setSubtab] = useState<string>(subtabs[0])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f7]">
      {/* 顶栏 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-panel/80 px-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[11.5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
          className="ml-auto flex size-7 items-center justify-center rounded-full text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--hover-fill)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ShareFat className="size-[15px]" weight="fill" />
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-[#f5f5f7]">
        {/* ── 头部：白底大标题区 + 下划线子页签 ── */}
        <header className="bg-panel">
          <div className="mx-auto w-full max-w-[860px] px-7 pt-9 max-[760px]:px-5">
            <div className="flex items-start gap-5 max-[760px]:flex-col">
              <span className="flex size-20 shrink-0 items-center justify-center rounded-[22px] bg-[var(--surface-hover)] text-[26px] font-semibold text-[var(--ink-soft)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_rgba(0,0,0,0.10)] max-[760px]:size-16 max-[760px]:rounded-[18px] max-[760px]:text-[20px]">
                {detail.glyph}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <h1 className="truncate text-[26px] leading-8 font-semibold tracking-[-0.035em] text-[var(--ink)] max-[760px]:text-[21px]">{detail.name}</h1>
                <p className="mt-1 text-[13px] text-[var(--muted-strong)]">{detail.byline}</p>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--muted)]">
                  {detail.stats.map((stat, index) => (
                    <span key={stat.label} className="flex items-center gap-2">
                      {index > 0 ? <span aria-hidden className="text-[var(--line-strong)]">·</span> : null}
                      <span>{stat.value}</span>
                    </span>
                  ))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5 pt-1.5 max-[760px]:pt-1">
                {done ? (
                  <span className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-4 text-[12px] font-medium text-[var(--muted-strong)]">
                    <Check className="size-3.5" weight="bold" />
                    {DONE_LABELS[detail.tab]}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onAction}
                    className="flex h-9 items-center rounded-full bg-[var(--accent)] px-6 text-[12.5px] font-semibold text-white outline-none transition-[background-color] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    {ACTION_LABELS[detail.tab]}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 子页签：Apple.com 导航式（文字 + 底部指示线） */}
          <nav aria-label="详情分区" className="mx-auto mt-7 w-full max-w-[860px] px-7 max-[760px]:px-5">
            <div className="flex items-end gap-8 overflow-x-auto border-t border-[var(--line)]">
              {subtabs.map((item) => {
                const active = subtab === item
                return (
                  <button
                    key={item}
                    type="button"
                    aria-selected={active}
                    role="tab"
                    onClick={() => setSubtab(item)}
                    className={cn(
                      "relative flex h-11 shrink-0 items-center pb-0 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      active ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink-soft)]",
                    )}
                  >
                    {item}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-[var(--ink)] transition-opacity duration-150",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                )
              })}
            </div>
          </nav>
        </header>

        {/* ── 内容区 ── */}
        <div className="mx-auto w-full max-w-[860px] px-7 pb-20 pt-7 max-[760px]:px-5">
          {subtab === "概览" ? (
            <div className="flex flex-col gap-4">
              <section className="rounded-[14px] bg-panel p-7">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">关于</h2>
                <div className="mt-3.5 space-y-3.5">
                  {detail.about.map((paragraph) => (
                    <p key={paragraph.slice(0, 12)} className="text-[13px] leading-[22px] text-[var(--ink-soft)]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
              <section className="rounded-[14px] bg-panel p-7">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">亮点</h2>
                <ul className="mt-4 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                  {detail.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2.5">
                      <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium leading-[18px] text-[var(--ink)]">{highlight}</p>
                        <p className="mt-1 text-[11.5px] leading-[17px] text-[var(--muted-strong)]">
                          {detail.capabilities[detail.highlights.indexOf(highlight)]?.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-[14px] bg-panel p-7">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">权限与数据</h2>
                <ul className="mt-3.5 space-y-2.5">
                  {detail.permissions.map((permission) => (
                    <li key={permission} className="flex items-start gap-2.5 text-[12.5px] leading-[19px] text-[var(--muted-strong)]">
                      <Check className="mt-1 size-3.5 shrink-0 text-[var(--accent-ink)]" weight="bold" />
                      {permission}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {subtab === "能力" ? (
            <section className="rounded-[14px] bg-panel p-7">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">能力明细</h2>
              <div className="mt-5 flex flex-col">
                {detail.capabilities.map((capability, index) => (
                  <div key={capability.title} className={cn("flex items-start gap-5 py-5", index > 0 && "border-t border-[var(--line)]")}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{capability.title}</p>
                      <p className="mt-1.5 text-[12.5px] leading-[19px] text-[var(--muted-strong)]">{capability.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {subtab === "版本历史" ? (
            <section className="rounded-[14px] bg-panel p-7">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">版本历史</h2>
              <div className="mt-5 flex flex-col">
                {detail.updates.map((update, index) => (
                  <div key={`${update.version}-${update.date}`} className={cn("flex items-baseline gap-6 py-3.5", index > 0 && "border-t border-[var(--line)]")}>
                    <div className="flex w-[130px] shrink-0 flex-col">
                      <span className="text-[12.5px] font-semibold text-[var(--ink)]">v{update.version}</span>
                      <span className="mt-0.5 text-[10.5px] tabular-nums text-[var(--muted)]">{update.date}</span>
                    </div>
                    <p className="min-w-0 flex-1 text-[12.5px] leading-[19px] text-[var(--ink-soft)]">{update.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {subtab === "安装" ? (
            <div className="flex flex-col gap-4">
              <section className="rounded-[14px] bg-panel p-7">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">安装步骤</h2>
                <div className="mt-5 flex flex-col">
                  {[
                    { title: "点击安装", desc: "点击右上角「安装」，技能进入本机已安装列表，即刻可用。" },
                    { title: "在任务中引用", desc: "任务输入中 @ 技能名，或交由 Agent 按任务特征自动调用。" },
                    { title: "管理与更新", desc: "在 设置 · 技能 中管理已安装技能，支持一键升级与回滚。" },
                  ].map((step, index) => (
                    <div key={step.title} className={cn("flex items-start gap-5 py-5", index > 0 && "border-t border-[var(--line)]")}>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{step.title}</p>
                        <p className="mt-1.5 text-[12.5px] leading-[19px] text-[var(--muted-strong)]">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-[14px] bg-panel p-7">
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">运行要求</h2>
                <p className="mt-3 text-[13px] leading-[22px] text-[var(--ink-soft)]">
                  技能仅在本机加载提示词与模板，不发起网络请求；无额外依赖，卸载即清理全部缓存。
                </p>
              </section>
            </div>
          ) : null}

          {subtab === "讨论" ? (
            <div className="flex flex-col gap-4">
              <section className="rounded-[14px] bg-panel p-7">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">讨论</h2>
                  <button
                    type="button"
                    onClick={onDiscuss}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--hover-fill)] px-3.5 text-[11.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <ChatCircleDots className="size-3.5" weight="fill" />
                    发起讨论
                  </button>
                </div>
                <div className="mt-5 flex flex-col">
                  {detail.discussions.map((post, index) => (
                    <div key={post.author + post.time} className={cn("py-5", index > 0 && "border-t border-[var(--line)]")}>
                      <div className="flex gap-3.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[12px] font-semibold text-[var(--ink-soft)]">
                          {post.author.slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="text-[12.5px] font-semibold text-[var(--ink)]">{post.author}</p>
                            <span className="text-[10.5px] text-[var(--muted)]">{post.time}</span>
                          </div>
                          <p className="mt-1.5 text-[12.5px] leading-[20px] text-[var(--ink-soft)]">{post.text}</p>
                          {post.replies.length > 0 ? (
                            <div className="mt-3 space-y-2.5 rounded-[10px] bg-[var(--surface-subtle)] p-3.5">
                              {post.replies.map((reply) => (
                                <div key={reply.author + reply.time} className="flex gap-2.5">
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel text-[9.5px] font-semibold text-[var(--muted-strong)]">
                                    {reply.author.slice(0, 1)}
                                  </span>
                                  <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-[var(--muted-strong)]">
                                    <span className="font-medium text-[var(--ink-soft)]">{reply.author}</span>
                                    <span className="mx-1.5 text-[var(--muted)]">{reply.time}</span>
                                    {reply.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {subtab === "信息" ? (
            <section className="rounded-[14px] bg-panel p-7">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">信息</h2>
              <dl className="mt-5 grid gap-x-10 sm:grid-cols-2">
                {detail.info.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3.5">
                    <dt className="shrink-0 text-[11.5px] text-[var(--muted)]">{row.label}</dt>
                    <dd className="truncate text-[12.5px] font-medium text-[var(--ink)]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {subtab === RELATED_TAB_LABEL[detail.tab] && related.length > 0 ? (
            <section className="rounded-[14px] bg-panel p-7">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]">{RELATED_TAB_LABEL[detail.tab]}</h2>
              <div className="mt-5 grid gap-3 max-[760px]:grid-cols-1 sm:grid-cols-3">
                {related.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenRelated(item.id)}
                    className="group flex flex-col gap-2.5 rounded-[12px] border border-[var(--line)] bg-panel p-4 text-left outline-none transition-[border-color,box-shadow] hover:border-[var(--line-strong)] hover:shadow-[0_8px_20px_-10px_rgba(28,33,42,0.15)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span className="flex size-11 items-center justify-center rounded-[11px] bg-[var(--surface-hover)] text-[14px] font-semibold text-[var(--ink-soft)]">
                      {item.glyph}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{item.name}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">{item.meta}</p>
                    </div>
                    <span className={cn("mt-0.5 flex h-6 w-fit items-center rounded-full px-3 text-[10.5px] font-semibold", item.done ? "border border-[var(--line-strong)] text-[var(--muted-strong)]" : "bg-accent-soft text-accent-ink")}>
                      {item.done ? "已添加" : "查看"}
                    </span>
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
