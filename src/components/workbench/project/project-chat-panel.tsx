"use client"

/**
 * 项目会话侧栏：会话按 #标签 汇聚，标签分组由用户自定义——
 * 可新建 / 重命名 / 删除分组，并拖拽标签在分组间移动；
 * 顶部提供团队 / 个人视角、未读筛选与会话搜索，标签展开柄为右侧实心三角，
 * 标签下是逐条独立的会话；选中会话后在底部展开快速回复。
 */

import { useMemo, useState } from "react"
import {
  CaretDown,
  CheckCircle,
  DotsThree,
  Hash,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Trash,
  User,
  UsersThree,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { toneIcons, type IconTone } from "../icon-tones"

type ChatView = "team" | "personal"
type ChatTagId = string
type ChatGroupId = string

/** 未分组：不属于任何自定义分组的标签落脚处 */
const UNGROUPED: ChatGroupId = "ungrouped"

const chatTags: Record<ChatTagId, { label: string; tone: IconTone }> = {
  release: { label: "发布", tone: "blue" },
  review: { label: "评审", tone: "amber" },
  design: { label: "设计", tone: "violet" },
  api: { label: "接口", tone: "sky" },
  regression: { label: "回归", tone: "rose" },
  notify: { label: "通知", tone: "teal" },
}

const defaultGroups: Array<{ id: ChatGroupId; label: string }> = [
  { id: "product", label: "产品" },
  { id: "dev", label: "研发" },
]

/** 标签 → 分组的归属；null 表示未分组，分组删除后标签回落到这里 */
const defaultTagAssign: Record<ChatTagId, ChatGroupId | null> = {
  release: "product",
  review: "product",
  design: null,
  api: "dev",
  regression: "dev",
  notify: "dev",
}

type ChatConversation = {
  id: string
  title: string
  meta: string
  unread: number
  tags: ChatTagId[]
  /** 个人视角可见：我发起或仅与自己相关的会话 */
  mine: boolean
}

const conversations: ChatConversation[] = [
  { id: "release", title: "V1 发布准备", meta: "Nova · 8 分钟前", unread: 3, tags: ["release"], mine: false },
  { id: "release-risk", title: "发布风险与回滚预案", meta: "高翔 · 1 小时前", unread: 0, tags: ["release"], mine: true },
  { id: "release-scope", title: "V1 范围最终确认", meta: "小满 · 3 小时前", unread: 0, tags: ["release"], mine: false },
  { id: "permission", title: "权限模型评审", meta: "林默 · 42 分钟前", unread: 0, tags: ["review"], mine: false },
  { id: "rule-review", title: "项目规则评审记录", meta: "何静 · 昨天", unread: 1, tags: ["review"], mine: false },
  { id: "spec", title: "工作台交互规范", meta: "苏晴 · 2 小时前", unread: 0, tags: ["design"], mine: false },
  { id: "prototype", title: "用户中心原型走查", meta: "苏晴 · 昨天", unread: 2, tags: ["design"], mine: true },
  { id: "notify-api", title: "通知服务接口变更", meta: "周欣 · 5 小时前", unread: 0, tags: ["api", "notify"], mine: false },
  { id: "issue-128", title: "Issue-128 回归", meta: "陈安 · 昨天", unread: 0, tags: ["regression"], mine: false },
  { id: "regression-auto", title: "自动化回归接入", meta: "陈安 · 前天", unread: 0, tags: ["regression", "notify"], mine: true },
]

const viewOptions: Array<{ id: ChatView; label: string; icon: typeof UsersThree }> = [
  { id: "team", label: "团队", icon: UsersThree },
  { id: "personal", label: "个人", icon: User },
]

export function ChatPanel() {
  const [view, setView] = useState<ChatView>("team")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [query, setQuery] = useState("")
  const [groups, setGroups] = useState(defaultGroups)
  const [tagAssign, setTagAssign] = useState(defaultTagAssign)
  const [collapsed, setCollapsed] = useState<Record<ChatTagId, boolean>>({})
  const [renamingGroupId, setRenamingGroupId] = useState<ChatGroupId | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [items, setItems] = useState(conversations)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)
  // 拖拽中的标签与悬停的分组落点
  const [draggingTag, setDraggingTag] = useState<ChatTagId | null>(null)
  const [dropTarget, setDropTarget] = useState<ChatGroupId | null>(null)

  const active = items.find((item) => item.id === activeId) ?? null

  const visible = useMemo(() => {
    let pool = items.filter((item) => (view === "personal" ? item.mine : true))
    if (unreadOnly) pool = pool.filter((item) => item.unread > 0)
    return pool
  }, [items, view, unreadOnly])

  const usedTags = useMemo(() => {
    const used = new Set<ChatTagId>()
    visible.forEach((item) => item.tags.forEach((tag) => used.add(tag)))
    return used
  }, [visible])

  const searchResults = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    if (!keyword) return null
    return visible.filter((item) => item.title.toLocaleLowerCase().includes(keyword))
  }, [visible, query])

  function conversationsOf(tag: ChatTagId) {
    return visible.filter((item) => item.tags.includes(tag))
  }

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

  function createGroup() {
    const id = `group-${Date.now()}`
    setGroups((current) => [...current, { id, label: "新分组" }])
    setRenamingGroupId(id)
    setRenameDraft("新分组")
  }

  function commitGroupRename() {
    const next = renameDraft.trim()
    if (next && renamingGroupId) {
      setGroups((current) => current.map((group) => (group.id === renamingGroupId ? { ...group, label: next } : group)))
    }
    setRenamingGroupId(null)
  }

  function deleteGroup(id: ChatGroupId) {
    setGroups((current) => current.filter((group) => group.id !== id))
    // 分组内标签回落到未分组
    setTagAssign((current) => {
      const next = { ...current }
      Object.keys(next).forEach((tag) => {
        if (next[tag] === id) next[tag] = null
      })
      return next
    })
  }

  function moveTagTo(tag: ChatTagId, group: ChatGroupId) {
    setTagAssign((current) => ({ ...current, [tag]: group === UNGROUPED ? null : group }))
  }

  const searching = searchResults !== null

  return (
    <div>
      {/* 视角 + 搜索 */}
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="会话视角" className="flex h-8 shrink-0 rounded-[9px] bg-[var(--surface-subtle)] p-0.5">
          {viewOptions.map((option) => {
            const selected = view === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setView(option.id)}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-[7px] px-2.5 text-[10.5px] font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  selected
                    ? "bg-panel text-[var(--ink)] shadow-[0_1px_3px_rgba(24,30,42,0.1)]"
                    : "text-[var(--muted-strong)] hover:text-[var(--ink-soft)]",
                )}
              >
                <option.icon className="size-[13px]" weight={selected ? "fill" : "regular"} />
                {option.label}
              </button>
            )
          })}
        </div>
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[9px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 transition-[border-color,box-shadow] focus-within:border-[var(--accent-soft-line)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
          <MagnifyingGlass className="size-3.5 shrink-0 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="min-w-0 flex-1 bg-transparent text-[10.5px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          />
        </label>
      </div>

      {/* 未读筛选 + 会话计数 */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => setUnreadOnly((value) => !value)}
          className={cn(
            "flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[9.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            unreadOnly
              ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "border-[var(--line)] text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-soft)]",
          )}
        >
          <span className={cn("size-1.5 rounded-full", unreadOnly ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]")} />
          只看未读
        </button>
        <span className="ml-auto text-[9px] tabular-nums text-[var(--muted)]">{visible.length} 个会话</span>
      </div>

      {searching ? (
        /* 搜索态：跨分组的平铺结果 */
        searchResults.length ? (
          <div className="mt-3 space-y-px">
            {searchResults.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                active={activeId === item.id}
                showTags
                onSelect={() => selectConversation(item.id)}
              />
            ))}
          </div>
        ) : (
          <ChatEmptyState title="没有匹配的会话" detail="换个关键词，或清空搜索查看全部分组。" />
        )
      ) : (
        <div className="mt-3.5">
          {/* 分组区块：整块为拖拽落点，悬停时高亮提示 */}
          {[
            ...groups.map((group) => ({ ...group, kind: "group" as const })),
            { id: UNGROUPED, label: "未分组", kind: "ungrouped" as const },
          ].flatMap((group) => {
            const groupTags = Object.keys(chatTags).filter(
              (tag) => usedTags.has(tag) && (tagAssign[tag] ?? null) === (group.kind === "ungrouped" ? null : group.id),
            )
            if (groupTags.length === 0) return []

            const isDropTarget = dropTarget === group.id && draggingTag !== null
            return (
              <section
                key={group.id}
                aria-label={`${group.label}分组`}
                onDragOver={(event) => {
                  if (!draggingTag) return
                  event.preventDefault()
                  setDropTarget(group.id)
                }}
                onDragLeave={() => setDropTarget((current) => (current === group.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggingTag) moveTagTo(draggingTag, group.id)
                  setDraggingTag(null)
                  setDropTarget(null)
                }}
                className={cn(
                  "mb-3 rounded-[10px] transition-[background-color,box-shadow] last:mb-0",
                  isDropTarget && "bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)]",
                )}
              >
                {renamingGroupId === group.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitGroupRename()
                      if (event.key === "Escape") setRenamingGroupId(null)
                    }}
                    onBlur={commitGroupRename}
                    aria-label="重命名分组"
                    className="h-6 w-full max-w-[160px] rounded-[6px] border border-[var(--accent-soft-line)] bg-panel px-1.5 text-[10px] font-semibold outline-none"
                  />
                ) : (
                  <div className="flex h-6 items-center gap-1.5">
                    <h3 className="text-[9.5px] font-semibold tracking-[0.06em] text-[var(--muted-strong)]">{group.label}</h3>
                    <span className="text-[9px] tabular-nums text-[var(--muted)]">{groupTags.length}</span>
                    {group.kind === "group" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${group.label}分组操作`}
                            className="ml-auto flex size-5 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            <DotsThree className="size-[14px]" weight="bold" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onSelect={() => { setRenamingGroupId(group.id); setRenameDraft(group.label) }}>
                            <PencilSimple weight="fill" />重命名
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[var(--err-ink)]" onSelect={() => deleteGroup(group.id)}>
                            <Trash weight="fill" />删除分组
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                )}

                <div className="mt-1 space-y-1.5">
                  {groupTags.map((tag) => {
                    const meta = chatTags[tag]
                    const tagItems = conversationsOf(tag)
                    const isCollapsed = collapsed[tag] ?? false

                    return (
                      <div key={tag}>
                        <div
                          draggable
                          onDragStart={(event) => {
                            setDraggingTag(tag)
                            event.dataTransfer.effectAllowed = "move"
                          }}
                          onDragEnd={() => { setDraggingTag(null); setDropTarget(null) }}
                          className={cn("cursor-grab active:cursor-grabbing", draggingTag === tag && "opacity-40")}
                        >
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            onClick={() => setCollapsed((current) => ({ ...current, [tag]: isCollapsed }))}
                            className="group flex h-[30px] w-full items-center gap-2 rounded-[8px] px-1.5 outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            <Hash className={cn("size-[14px] shrink-0", toneIcons[meta.tone])} weight="bold" />
                            <span className="text-[11px] font-semibold text-[var(--ink-soft)]">{meta.label}</span>
                            <span className="rounded-full bg-[var(--surface-subtle)] px-1.5 text-[9px] font-medium tabular-nums text-[var(--muted-strong)]">
                              {tagItems.length}
                            </span>
                            {/* 展开柄固定在标签行右侧：实心三角，随折叠旋转 */}
                            <CaretDown
                              aria-hidden
                              className={cn(
                                "ml-auto size-[11px] shrink-0 text-[var(--muted)] transition-transform duration-150",
                                isCollapsed && "-rotate-90",
                              )}
                              weight="fill"
                            />
                          </button>
                        </div>

                        {!isCollapsed ? (
                          <div className="mt-0.5 space-y-px">
                            {tagItems.map((item) => (
                              <ConversationRow
                                key={item.id}
                                item={item}
                                active={activeId === item.id}
                                onSelect={() => selectConversation(item.id)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* 新建分组 */}
          <button
            type="button"
            onClick={createGroup}
            className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-[var(--line-strong)] text-[10px] font-medium text-[var(--muted-strong)] outline-none transition-[border-color,color,background-color] hover:border-[var(--accent-soft-line)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Plus className="size-3" weight="bold" />
            新建分组
          </button>
        </div>
      )}

      {/* 选中会话的快速回复 */}
      {active ? (
        <div className="mt-4 rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] p-3 focus-within:border-[var(--accent-soft-line)]">
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

/** 独立会话行：不按人汇聚，仅状态点 + 标题 + 时间 + 未读 */
function ConversationRow({
  item,
  active,
  showTags = false,
  onSelect,
}: {
  item: ChatConversation
  active: boolean
  showTags?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-[38px] w-full items-center gap-2 rounded-[8px] px-2 text-left outline-none transition-[background-color] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
        active
          ? "bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)]"
          : "hover:bg-[var(--surface-hover)]",
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", item.unread ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]")} />
      <span className={cn("min-w-0 flex-1 truncate text-[10.5px]", active ? "font-semibold text-[var(--accent-ink)]" : "font-medium text-[var(--ink)]")}>
        {item.title}
      </span>
      {showTags ? (
        <span className="flex shrink-0 items-center gap-1">
          {item.tags.map((tag) => (
            <Hash key={tag} aria-label={`#${chatTags[tag].label}`} className={cn("size-3", toneIcons[chatTags[tag].tone])} weight="bold" />
          ))}
        </span>
      ) : null}
      <span className="shrink-0 text-[9px] text-[var(--muted)]">{item.meta.split(" · ")[1] ?? item.meta}</span>
      {item.unread ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-semibold tabular-nums text-white">
          {item.unread}
        </span>
      ) : null}
    </button>
  )
}

function ChatEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--surface-subtle)] text-[var(--muted-strong)]">
        <CheckCircle className="size-4" />
      </span>
      <p className="mt-3 text-[10.5px] font-medium">{title}</p>
      <p className="mt-1 text-[9px] text-[var(--muted)]">{detail}</p>
    </div>
  )
}
