"use client"

/**
 * 项目会话侧栏：会话按 #标签 汇聚，标签再按业务分组收纳；
 * 支持团队 / 个人两种视角，团队视角可切换到具体成员过滤会话，
 * 选中会话后在底部展开快速回复，形成完整的浏览—定位—回应闭环。
 */

import { useMemo, useState } from "react"
import Image from "next/image"
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Hash,
  PaperPlaneTilt,
  User,
  UsersThree,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { toneIcons, type IconTone } from "./icon-tones"
import { railMembers } from "./project-management-model"

type ChatView = "team" | "personal"

const chatTags = {
  release: { label: "发布", tone: "blue" },
  review: { label: "评审", tone: "amber" },
  design: { label: "设计", tone: "violet" },
  api: { label: "接口", tone: "sky" },
  regression: { label: "回归", tone: "rose" },
  notify: { label: "通知", tone: "teal" },
} as const satisfies Record<string, { label: string; tone: IconTone }>

type ChatTagId = keyof typeof chatTags

const chatTagGroups: Array<{ id: string; label: string; tags: ChatTagId[] }> = [
  { id: "product", label: "产品", tags: ["release", "review", "design"] },
  { id: "dev", label: "研发", tags: ["api", "regression", "notify"] },
]

type ChatConversation = {
  id: string
  title: string
  owner: string
  meta: string
  unread: number
  tags: ChatTagId[]
  participants: string[]
  /** 个人视角可见：我发起或仅与自己相关的会话 */
  mine: boolean
}

const conversations: ChatConversation[] = [
  { id: "release", title: "V1 发布准备", owner: "lin-mo", meta: "Nova · 8 分钟前", unread: 3, tags: ["release"], participants: ["lin-mo", "zhou-xin", "xiao-man"], mine: false },
  { id: "release-risk", title: "发布风险与回滚预案", owner: "gao-xiang", meta: "高翔 · 1 小时前", unread: 0, tags: ["release"], participants: ["gao-xiang", "lin-mo"], mine: true },
  { id: "permission", title: "权限模型评审", owner: "lin-mo", meta: "林默 · 42 分钟前", unread: 0, tags: ["review"], participants: ["lin-mo", "su-qing", "han-mei"], mine: false },
  { id: "rule-review", title: "项目规则评审记录", owner: "he-jing", meta: "何静 · 昨天", unread: 1, tags: ["review"], participants: ["he-jing", "lin-mo", "li-ang"], mine: false },
  { id: "spec", title: "工作台交互规范", owner: "su-qing", meta: "苏晴 · 2 小时前", unread: 0, tags: ["design"], participants: ["su-qing", "li-ang"], mine: false },
  { id: "prototype", title: "用户中心原型走查", owner: "su-qing", meta: "苏晴 · 昨天", unread: 2, tags: ["design"], participants: ["su-qing", "lin-mo", "xiao-man"], mine: true },
  { id: "notify-api", title: "通知服务接口变更", owner: "zhou-xin", meta: "周欣 · 5 小时前", unread: 0, tags: ["api", "notify"], participants: ["zhou-xin", "li-ang"], mine: false },
  { id: "issue-128", title: "Issue-128 回归", owner: "chen-an", meta: "陈安 · 昨天", unread: 0, tags: ["regression"], participants: ["chen-an", "gao-xiang"], mine: false },
  { id: "regression-auto", title: "自动化回归接入", owner: "chen-an", meta: "陈安 · 前天", unread: 0, tags: ["regression", "notify"], participants: ["chen-an", "zhou-xin", "gao-xiang"], mine: true },
]

const viewOptions: Array<{ id: ChatView; label: string; icon: typeof UsersThree }> = [
  { id: "team", label: "团队", icon: UsersThree },
  { id: "personal", label: "个人", icon: User },
]

export function ChatPanel() {
  const [view, setView] = useState<ChatView>("team")
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [items, setItems] = useState(conversations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  const active = items.find((item) => item.id === activeId) ?? null

  const visible = useMemo(() => {
    let pool = items.filter((item) => (view === "personal" ? item.mine : true))
    if (view === "team" && memberFilter) {
      pool = pool.filter((item) => item.participants.includes(memberFilter))
    }
    return pool
  }, [items, view, memberFilter])

  function selectConversation(id: string) {
    setActiveId(id)
    setSent(false)
    setItems((current) => current.map((item) => (item.id === id ? { ...item, unread: 0 } : item)))
  }

  function sendMessage() {
    if (!message.trim() || !active) return
    setMessage("")
    setSent(true)
  }

  return (
    <div>
      {/* 视角切换：团队全景 / 仅我的会话 */}
      <div role="tablist" aria-label="会话视角" className="flex h-8 rounded-[9px] bg-[var(--surface-subtle)] p-0.5">
        {viewOptions.map((option) => {
          const selected = view === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => { setView(option.id); setMemberFilter(null) }}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[10.5px] font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected
                  ? "bg-panel text-[var(--ink)] shadow-[0_1px_3px_rgba(24,30,42,0.1)]"
                  : "text-[var(--muted-strong)] hover:text-[var(--ink-soft)]",
              )}
            >
              <option.icon className="size-[14px]" weight={selected ? "fill" : "regular"} />
              {option.label}
            </button>
          )
        })}
      </div>

      {/* 团队视角：按成员过滤 */}
      {view === "team" ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={memberFilter === null}
            onClick={() => setMemberFilter(null)}
            className={cn(
              "flex h-6 items-center gap-1 rounded-full border px-2 text-[9.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              memberFilter === null
                ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "border-[var(--line)] text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-soft)]",
            )}
          >
            <UsersThree className="size-3" />
            全员
          </button>
          {railMembers.map((member) => {
            const selected = memberFilter === member.id
            return (
              <button
                key={member.id}
                type="button"
                aria-label={`只看 ${member.name} 的会话`}
                aria-pressed={selected}
                onClick={() => setMemberFilter(selected ? null : member.id)}
                className={cn(
                  "relative rounded-full outline-none transition-transform duration-150 hover:scale-[1.08] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
                )}
              >
                <Image
                  src={member.avatar}
                  alt=""
                  width={40}
                  height={40}
                  className={cn(
                    "size-6 rounded-full object-cover transition-shadow duration-150",
                    selected ? "ring-2 ring-[var(--accent)]" : "opacity-75 hover:opacity-100",
                  )}
                />
              </button>
            )
          })}
        </div>
      ) : null}

      {/* 会话列表：标签组 → 标签 → 会话 */}
      <div className="mt-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--surface-subtle)] text-[var(--muted-strong)]">
              <CheckCircle className="size-4" />
            </span>
            <p className="mt-3 text-[10.5px] font-medium">没有匹配的会话</p>
            <p className="mt-1 text-[9px] text-[var(--muted)]">换个成员或切回全员视角看看。</p>
          </div>
        ) : (
          chatTagGroups.map((group) => {
            const groupTags = group.tags
              .map((tag) => ({ tag, items: visible.filter((item) => item.tags.includes(tag)) }))
              .filter((entry) => entry.items.length > 0)
            if (groupTags.length === 0) return null

            return (
              <section key={group.id} aria-label={`${group.label}标签分组`} className="mb-4 last:mb-0">
                <h3 className="px-1 text-[9px] font-semibold tracking-[0.08em] text-[var(--muted)]">{group.label}</h3>
                <div className="mt-1.5 space-y-2">
                  {groupTags.map(({ tag, items: tagItems }) => {
                    const meta = chatTags[tag]
                    const isCollapsed = collapsed[tag] ?? false

                    return (
                      <div key={tag}>
                        <button
                          type="button"
                          aria-expanded={!isCollapsed}
                          onClick={() => setCollapsed((current) => ({ ...current, [tag]: isCollapsed }))}
                          className="group flex h-6 w-full items-center gap-1.5 rounded-[7px] px-1 outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          {isCollapsed ? (
                            <CaretRight className="size-3 shrink-0 text-[var(--muted)]" />
                          ) : (
                            <CaretDown className="size-3 shrink-0 text-[var(--muted)]" />
                          )}
                          <Hash className={cn("size-3.5 shrink-0", toneIcons[meta.tone])} weight="bold" />
                          <span className="text-[10.5px] font-semibold text-[var(--ink-soft)]">{meta.label}</span>
                          <span className="ml-auto rounded-full bg-[var(--surface-subtle)] px-1.5 text-[9px] font-medium tabular-nums text-[var(--muted-strong)]">
                            {tagItems.length}
                          </span>
                        </button>

                        {!isCollapsed ? (
                          <div className="mt-0.5 space-y-px">
                            {tagItems.map((item) => {
                              const owner = railMembers.find((member) => member.id === item.owner)
                              const isActive = activeId === item.id

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => selectConversation(item.id)}
                                  aria-current={isActive ? "true" : undefined}
                                  className={cn(
                                    "flex min-h-[42px] w-full items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-left outline-none transition-[background-color] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
                                    isActive
                                      ? "bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)]"
                                      : "hover:bg-[var(--surface-hover)]",
                                  )}
                                >
                                  <Image
                                    src={owner?.avatar ?? "/avatars/member-1.png"}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="size-[26px] shrink-0 rounded-full object-cover"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                      <span className={cn("truncate text-[10.5px]", isActive ? "font-semibold text-[var(--accent-ink)]" : "font-medium text-[var(--ink)]")}>
                                        {item.title}
                                      </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[9px] text-[var(--muted)]">{item.meta}</span>
                                  </span>
                                  {item.unread ? (
                                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-semibold tabular-nums text-white">
                                      {item.unread}
                                    </span>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>

      {/* 选中会话的快速回复 */}
      {active ? (
        <div className="mt-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] p-3 focus-within:border-[var(--accent-soft-line)]">
          <p className="text-[10px] font-semibold text-[var(--ink)]">回复 · {active.title}</p>
          <textarea
            value={message}
            onChange={(event) => { setMessage(event.target.value); setSent(false) }}
            placeholder={view === "team" ? "发送到项目会话，成员与 Agent 都可回应…" : "仅自己可见的笔记与会话…"}
            aria-label={`回复 ${active.title}`}
            className="mt-1.5 min-h-16 w-full resize-none bg-transparent text-[10.5px] leading-5 outline-none placeholder:text-[var(--muted)]"
          />
          <div className="mt-1.5 flex items-center justify-between border-t border-[var(--line)] pt-2">
            <span className={cn("text-[9px]", sent ? "text-[var(--ok-ink)]" : "text-[var(--muted)]")}>
              {sent ? "消息已加入会话" : view === "team" ? "项目会话" : "个人记录"}
            </span>
            <button
              type="button"
              disabled={!message.trim()}
              onClick={sendMessage}
              className="flex size-7 items-center justify-center rounded-[7px] bg-[var(--accent)] text-white outline-none transition-[background-color,transform,opacity] hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <PaperPlaneTilt className="size-3.5" weight="fill" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
