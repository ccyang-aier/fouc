"use client"

/**
 * 社区详情页：App Store 式单栏排版 —— 居中头部（徽章 + 名称 + 胶囊动作）、
 * 分段控制器切换子模块（按类型区分）、白卡分区内容。
 *  Agents: 概览 / 能力 / 版本历史 / 相似助理
 *  Skills: 概览 / 安装 / 讨论 / 信息
 *  连接器: 概览 / 信息 / 版本历史
 */

import { useState } from "react"
import { CaretLeft, CaretRight, Check, CheckCircle, ShareFat } from "@phosphor-icons/react"

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

export type RelatedItem = {
  id: string
  name: string
  glyph: string
  meta: string
  done: boolean
}

const sectionCard =
  "rounded-[12px] bg-panel p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_14px_rgba(0,0,0,0.04)]"
const sectionTitle = "text-[13px] font-semibold tracking-[-0.01em] text-[var(--ink)]"

/** 讨论区演示数据（技能子页），后续由社区服务替换 */
function mockDiscussions(name: string) {
  return [
    { author: "林默", time: "3 天前", text: `在长任务里连续用「${name}」跑了一周，输出很稳定，值得装。`, replies: 2 },
    { author: "苏晴", time: "1 周前", text: "想问下团队规范模板支持自定义吗？", replies: 1 },
    { author: "周欣", time: "2 周前", text: "搭配默认 Agent 使用效果最好，建议先跑一遍示例任务。", replies: 0 },
  ]
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-subtle)]">
      {/* 返回栏 */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-panel px-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[11px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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

      <ScrollArea className="min-h-0 flex-1" viewportClassName="bg-[var(--surface-subtle)]">
        <div className="mx-auto w-full max-w-[680px] px-6 pb-20 pt-8 max-[760px]:px-4">
          {/* 头部：徽章 + 名称 + 胶囊动作 */}
          <header className="flex items-start gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-[15px] bg-panel text-[20px] font-semibold text-[var(--ink-soft)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_rgba(0,0,0,0.07)]">
              {detail.glyph}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.03em] text-[var(--ink)]">{detail.name}</h1>
              <p className="mt-1 text-[11.5px] text-[var(--muted)]">{detail.byline}</p>
              <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">
                {detail.stats.map((stat, index) => (
                  <span key={stat.label}>
                    {index > 0 ? <span aria-hidden className="mx-1.5 text-[var(--line-strong)]">·</span> : null}
                    {stat.value}
                  </span>
                ))}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
              {done ? (
                <span className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-4 text-[11.5px] font-medium text-[var(--muted-strong)]">
                  <Check className="size-3.5" weight="bold" />
                  {DONE_LABELS[detail.tab]}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onAction}
                  className="flex h-8 items-center rounded-full bg-[var(--accent)] px-5 text-[12px] font-semibold text-white outline-none transition-[background-color] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {ACTION_LABELS[detail.tab]}
                </button>
              )}
              <button
                type="button"
                onClick={onShare}
                className="text-[10px] text-[var(--muted)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                分享
              </button>
            </div>
          </header>

          {/* 分段控制器 */}
          <div className="mt-7 flex justify-center">
            <div role="tablist" aria-label="详情分区" className="flex items-center rounded-[9px] bg-[var(--hover-fill)] p-0.5">
              {subtabs.map((item) => {
                const active = subtab === item
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSubtab(item)}
                    className={cn(
                      "flex h-7 items-center rounded-[7px] px-3.5 text-[11px] font-medium outline-none transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      active
                        ? "bg-panel text-[var(--ink)] shadow-[0_1px_3px_rgba(28,33,42,0.10)]"
                        : "text-[var(--muted-strong)] hover:text-[var(--ink)]",
                    )}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 子模块内容 */}
          <div className="mt-6 flex flex-col gap-4">
            {subtab === "概览" ? (
              <>
                <section className={sectionCard}>
                  <h2 className={sectionTitle}>简介</h2>
                  <p className="mt-2.5 text-[12px] leading-[20px] text-[var(--ink-soft)]">{detail.description}</p>
                </section>
                <section className={sectionCard}>
                  <h2 className={sectionTitle}>亮点</h2>
                  <ul className="mt-3 space-y-2.5">
                    {detail.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2.5 text-[12px] leading-[18px] text-[var(--ink-soft)]">
                        <Check className="mt-1 size-3.5 shrink-0 text-[var(--accent-ink)]" weight="bold" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className={sectionCard}>
                  <h2 className={sectionTitle}>权限与数据</h2>
                  <ul className="mt-3 space-y-2">
                    {detail.permissions.map((permission) => (
                      <li key={permission} className="flex items-start gap-2.5 text-[11.5px] leading-[17px] text-[var(--muted-strong)]">
                        <span aria-hidden className="mt-[6px] size-1 shrink-0 rounded-full bg-[var(--line-strong)]" />
                        {permission}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}

            {subtab === "能力" ? (
              <section className={cn(sectionCard, "py-2")}>
                {detail.highlights.map((highlight, index) => (
                  <div key={highlight} className={cn("flex items-center gap-4 py-3.5", index > 0 && "border-t border-[var(--line)]")}>
                    <span className="shrink-0 font-mono text-[10px] font-medium text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
                    <p className="text-[12.5px] font-medium text-[var(--ink)]">{highlight}</p>
                  </div>
                ))}
              </section>
            ) : null}

            {subtab === "版本历史" ? (
              <section className={sectionCard}>
                <ol>
                  {detail.updates.map((update, index) => (
                    <li key={`${update.version}-${update.date}`} className={cn("relative flex gap-4 pb-5 last:pb-0", index > 0 && "pt-5 border-t border-[var(--line)]")}>
                      <div className="flex w-[72px] shrink-0 flex-col">
                        <span className="font-mono text-[10.5px] font-medium text-[var(--ink)]">v{update.version}</span>
                        <span className="mt-0.5 text-[9.5px] tabular-nums text-[var(--muted)]">{update.date}</span>
                      </div>
                      <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-[var(--ink-soft)]">{update.note}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {subtab === "安装" ? (
              <>
                <section className={sectionCard}>
                  <h2 className={sectionTitle}>安装步骤</h2>
                  <ol className="mt-4 space-y-3.5">
                    {[
                      "点击右上角「安装」，技能将进入本机已安装列表",
                      "在任务输入中 @ 技能名，或交由 Agent 自动调用",
                      "在 设置 · 技能 中管理已安装技能与版本更新",
                    ].map((step, index) => (
                      <li key={step} className="flex items-start gap-3">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--hover-fill)] text-[10px] font-semibold text-[var(--ink-soft)]">
                          {index + 1}
                        </span>
                        <p className="pt-0.5 text-[12px] leading-[18px] text-[var(--ink-soft)]">{step}</p>
                      </li>
                    ))}
                  </ol>
                </section>
                <section className={sectionCard}>
                  <h2 className={sectionTitle}>运行要求</h2>
                  <p className="mt-2.5 text-[12px] leading-[19px] text-[var(--ink-soft)]">
                    技能仅在本机加载提示词与模板，不发起网络请求；可随时在设置中卸载并清理缓存。
                  </p>
                </section>
              </>
            ) : null}

            {subtab === "讨论" ? (
              <>
                <section className={cn(sectionCard, "py-2")}>
                  {mockDiscussions(detail.name).map((post, index) => (
                    <div key={post.author} className={cn("flex gap-3 py-3.5", index > 0 && "border-t border-[var(--line)]")}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[11px] font-semibold text-[var(--ink-soft)]">
                        {post.author.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="text-[11.5px] font-medium text-[var(--ink)]">{post.author}</p>
                          <span className="text-[9.5px] text-[var(--muted)]">{post.time}</span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-[17px] text-[var(--ink-soft)]">{post.text}</p>
                        {post.replies > 0 ? (
                          <button type="button" onClick={onDiscuss} className="mt-1.5 text-[10.5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                            {post.replies} 条回复
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </section>
                <button
                  type="button"
                  onClick={onDiscuss}
                  className="flex h-9 w-full items-center justify-center rounded-[10px] border border-[var(--line-strong)] bg-panel text-[11.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:bg-panel hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  发起讨论
                </button>
              </>
            ) : null}

            {subtab === "信息" ? (
              <section className={cn(sectionCard, "py-1")}>
                <dl>
                  {detail.info.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] py-3 last:border-b-0">
                      <dt className="shrink-0 text-[10.5px] text-[var(--muted)]">{row.label}</dt>
                      <dd className="truncate text-[12px] font-medium text-[var(--ink)]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {subtab === "相似助理" || subtab === "相关推荐" ? (
              <section className={cn(sectionCard, "py-1.5")}>
                {related.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenRelated(item.id)}
                    className="group flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--surface-hover)] text-[11.5px] font-semibold text-[var(--ink-soft)]">
                      {item.glyph}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{item.name}</span>
                      <span className="mt-px block truncate text-[10px] text-[var(--muted)]">{item.meta}</span>
                    </span>
                    {item.done ? (
                      <CheckCircle className="size-4 shrink-0 text-[var(--muted-strong)]" weight="fill" />
                    ) : (
                      <CaretRight className="size-3.5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                    )}
                  </button>
                ))}
              </section>
            ) : null}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
