"use client"

/**
 * 项目会话侧栏：会话按 #标签 汇聚，标签分组由用户自定义——
 * 可新建 / 重命名 / 删除分组，并拖拽标签在分组间移动；
 * 分组与标签均可折叠（分组为右侧实心三角，标签为左侧描边三角，形态互异），
 * 行内「+」支持在分组下新建标签、在标签下新建会话；
 * 顶部依次为团队 / 个人视角与搜索（含行内筛选漏斗）。
 */

import { useMemo, useState } from "react"
import {
  CaretDown,
  DotsThree,
  Funnel,
  Hash,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  User,
  UsersThree,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

type ChatTag = { label: string; tone: IconTone }

const defaultTags: Record<ChatTagId, ChatTag> = {
  release: { label: "发布", tone: "blue" },
  review: { label: "评审", tone: "amber" },
  design: { label: "设计", tone: "violet" },
  api: { label: "接口", tone: "sky" },
  regression: { label: "回归", tone: "rose" },
  notify: { label: "通知", tone: "teal" },
}

/** 新建标签时轮换的语义色 */
const tonePool: IconTone[] = ["blue", "teal", "violet", "amber", "rose", "sky", "indigo"]

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

const initialConversations: ChatConversation[] = [
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

/** 运行时对象 id：模块顶层生成，避免渲染路径中的不纯调用 */
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}`
}

export function ChatPanel() {
  const [view, setView] = useState<ChatView>("team")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [initiatedOnly, setInitiatedOnly] = useState(false)
  const [query, setQuery] = useState("")
  const [tags, setTags] = useState(defaultTags)
  const [groups, setGroups] = useState(defaultGroups)
  const [tagAssign, setTagAssign] = useState(defaultTagAssign)
  const [collapsed, setCollapsed] = useState<Record<ChatTagId, boolean>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<ChatGroupId, boolean>>({})
  const [renamingGroupId, setRenamingGroupId] = useState<ChatGroupId | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [renamingTagId, setRenamingTagId] = useState<ChatTagId | null>(null)
  const [tagDraft, setTagDraft] = useState("")
  const [items, setItems] = useState(initialConversations)
  const [activeId, setActiveId] = useState<string | null>(null)
  // 拖拽中的标签与悬停的分组落点
  const [draggingTag, setDraggingTag] = useState<ChatTagId | null>(null)
  const [dropTarget, setDropTarget] = useState<ChatGroupId | null>(null)

  const visible = useMemo(() => {
    let pool = items.filter((item) => (view === "personal" ? item.mine : true))
    if (unreadOnly) pool = pool.filter((item) => item.unread > 0)
    if (initiatedOnly) pool = pool.filter((item) => item.mine)
    return pool
  }, [items, view, unreadOnly, initiatedOnly])

  /** 当前视角下各标签的可见会话 */
  function conversationsOf(tag: ChatTagId) {
    return visible.filter((item) => item.tags.includes(tag))
  }

  const searchResults = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    if (!keyword) return null
    return visible.filter((item) => item.title.toLocaleLowerCase().includes(keyword))
  }, [visible, query])

  function selectConversation(id: string) {
    setActiveId(id)
    setItems((current) => current.map((item) => (item.id === id ? { ...item, unread: 0 } : item)))
  }

  function createGroup() {
    const id = nextId("group")
    setGroups((current) => [...current, { id, label: "新分组" }])
    setRenamingGroupId(id)
    setRenameDraft("新分组")
    // 空分组立即可见：滚动进入视野并高亮，配合行内重命名构成创建反馈
    requestAnimationFrame(() => {
      document.getElementById(`chat-group-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
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

  function createTag(group: ChatGroupId) {
    const id = nextId("tag")
    const tone = tonePool[Object.keys(tags).length % tonePool.length]
    setTags((current) => ({ ...current, [id]: { label: "新标签", tone } }))
    setTagAssign((current) => ({ ...current, [id]: group === UNGROUPED ? null : group }))
    setCollapsedGroups((current) => ({ ...current, [group]: false }))
    setRenamingTagId(id)
    setTagDraft("新标签")
  }

  function commitTagRename() {
    const next = tagDraft.trim()
    if (next && renamingTagId) {
      setTags((current) => (current[renamingTagId] ? { ...current, [renamingTagId]: { ...current[renamingTagId], label: next } } : current))
    }
    setRenamingTagId(null)
  }

  function createConversation(tag: ChatTagId) {
    const id = nextId("conv")
    setItems((current) => [...current, { id, title: "新会话", meta: "你 · 刚刚", unread: 0, tags: [tag], mine: true }])
    setCollapsed((current) => ({ ...current, [tag]: false }))
    selectConversation(id)
  }

  const searching = searchResults !== null
  /** 视角过滤后仍有会话，或从未有过会话（新建的空标签）的标签才渲染 */
  const globalTags = useMemo(() => {
    const used = new Set<ChatTagId>()
    items.forEach((item) => item.tags.forEach((tag) => used.add(tag)))
    return used
  }, [items])

  function tagShouldRender(tag: ChatTagId, visibleCount: number) {
    return visibleCount > 0 || !globalTags.has(tag)
  }

  return (
    <div>
      {/* 视角切换 */}
      <div role="tablist" aria-label="会话视角" className="flex h-8 w-full rounded-[9px] bg-[var(--surface-subtle)] p-0.5">
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
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[10.5px] font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
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

      {/* 搜索 + 行内筛选：聚焦仅高亮边框，无任何扩散 */}
      <div className="mt-2.5 flex h-9 items-center gap-1 rounded-[9px] border border-[var(--line)] bg-[var(--surface-subtle)] pl-3 pr-1.5 transition-colors focus-within:border-[var(--accent)]">
        <MagnifyingGlass className="size-[15px] shrink-0 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索会话"
          aria-label="搜索会话"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        <span aria-hidden className="h-4 w-px shrink-0 bg-[var(--line)]" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="筛选会话"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-[7px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                unreadOnly || initiatedOnly
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-soft)] aria-expanded:bg-[var(--surface-hover)] aria-expanded:text-[var(--ink)]",
              )}
            >
              <Funnel className="size-[14px]" weight="fill" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuLabel>会话筛选</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={unreadOnly} onCheckedChange={() => setUnreadOnly((value) => !value)}>
              只看未读
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={initiatedOnly} onCheckedChange={() => setInitiatedOnly((value) => !value)}>
              我发起的
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {searching ? (
        /* 搜索态：跨分组的平铺结果 */
        searchResults.length ? (
          <div className="mt-3 space-y-px">
            {searchResults.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                tags={tags}
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
        <div className="mt-3">
          {/* 分组区块：整块为拖拽落点，悬停时高亮提示；空分组保留渲染以承接拖入 */}
          {[
            ...groups.map((group) => ({ ...group, kind: "group" as const })),
            { id: UNGROUPED, label: "未分组", kind: "ungrouped" as const },
          ].flatMap((group) => {
            const groupTags = Object.keys(tags).filter((tag) => {
              if ((tagAssign[tag] ?? null) !== (group.kind === "ungrouped" ? null : group.id)) return false
              return group.kind === "ungrouped" ? tagShouldRender(tag, conversationsOf(tag).length) : true
            })
            // 未分组仅在非空时出现；自定义分组始终渲染（新建/腾空后可继续拖入标签）
            if (groupTags.length === 0 && group.kind === "ungrouped") return []

            const isDropTarget = dropTarget === group.id && draggingTag !== null
            const isGroupCollapsed = collapsedGroups[group.id] ?? false

            return (
              <section
                key={group.id}
                id={`chat-group-${group.id}`}
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
                  "mb-1 animate-in fade-in slide-in-from-top-1 rounded-[12px] px-1 pb-2 pt-0.5 transition-[background-color,box-shadow]",
                  isDropTarget && "bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)]",
                )}
              >
                {renamingGroupId === group.id ? (
                  /* 行内分组命名器：卡片化的输入行，回车确认 / Esc 取消 */
                  <div className="my-1 flex h-[34px] animate-in fade-in slide-in-from-top-1 items-center gap-2 rounded-[9px] border border-[var(--accent-soft-line)] bg-panel pl-2.5 pr-2 shadow-[0_1px_5px_rgba(24,30,42,0.06)]">
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitGroupRename()
                        if (event.key === "Escape") setRenamingGroupId(null)
                      }}
                      onBlur={commitGroupRename}
                      aria-label="分组名称"
                      placeholder="分组名称"
                      className="h-full min-w-0 flex-1 bg-transparent text-[11.5px] font-semibold tracking-[-0.01em] outline-none placeholder:text-[var(--muted)]"
                    />
                    <kbd className="shrink-0 rounded-[5px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--muted)]">↵</kbd>
                  </div>
                ) : (
                  /* 分组行是一个整体：标题区可折叠（三角紧随计数），行内悬停浮现「新建标签」与「更多」 */
                  <div className="group/grp relative flex h-[34px] items-center rounded-[9px] pl-2.5 pr-1 transition-colors hover:bg-[var(--surface-hover)]">
                    <button
                      type="button"
                      aria-expanded={!isGroupCollapsed}
                      onClick={() => setCollapsedGroups((current) => ({ ...current, [group.id]: !isGroupCollapsed }))}
                      className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[9px] pr-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      <h3 className="truncate text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{group.label}</h3>
                      {groupTags.length ? (
                        <span className="text-[9.5px] font-medium tabular-nums text-[var(--muted)]">{groupTags.length}</span>
                      ) : null}
                      <CaretDown
                        aria-hidden
                        className={cn(
                          "size-[11px] shrink-0 text-[var(--muted)] transition-transform duration-150",
                          isGroupCollapsed && "-rotate-90",
                        )}
                        weight="fill"
                      />
                    </button>
                    {/* 下拉展开期间保持可见，避免触发器图标消失 */}
                    <div className="absolute right-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/grp:opacity-100 has-data-[state=open]:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label={`在${group.label}中新建标签`}
                        onClick={() => createTag(group.id)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <Plus className="size-[13px]" weight="bold" />
                      </button>
                      {group.kind === "group" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${group.label}分组操作`}
                              className="flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] data-[state=open]:bg-wash data-[state=open]:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            >
                              <DotsThree className="size-[15px]" weight="bold" />
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
                  </div>
                )}

                {!isGroupCollapsed ? (
                  groupTags.length === 0 ? (
                    /* 空分组：提示拖入或新建标签 */
                    <p className="px-2.5 py-2 text-[9.5px] text-[var(--muted)]">拖拽标签到此处，或点「＋」新建标签</p>
                  ) : (
                    <div className="space-y-1.5">
                      {groupTags.map((tag) => {
                        const meta = tags[tag]
                        const tagItems = conversationsOf(tag)
                        const isCollapsed = collapsed[tag] ?? false

                        if (renamingTagId === tag) {
                          return (
                            /* 行内标签命名器：彩色 # 前缀 + 回车提示，与标签行同尺度 */
                            <div
                              key={tag}
                              className="ml-1 flex h-[32px] animate-in fade-in slide-in-from-top-1 items-center gap-2 rounded-[8px] border border-[var(--accent-soft-line)] bg-panel pl-2 pr-1.5 shadow-[0_1px_5px_rgba(24,30,42,0.06)]"
                            >
                              <Hash className={cn("size-[14px] shrink-0", toneIcons[meta.tone])} weight="bold" />
                              <input
                                autoFocus
                                value={tagDraft}
                                onChange={(event) => setTagDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") commitTagRename()
                                  if (event.key === "Escape") setRenamingTagId(null)
                                }}
                                onBlur={commitTagRename}
                                aria-label="标签名称"
                                placeholder="标签名称"
                                className="h-full min-w-0 flex-1 bg-transparent text-[10.5px] font-medium outline-none placeholder:text-[var(--muted)]"
                              />
                              <kbd className="shrink-0 rounded-[5px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--muted)]">↵</kbd>
                            </div>
                          )
                        }

                        return (
                          <div key={tag} className="group/tag relative ml-1">
                            <div
                              draggable
                              onDragStart={(event) => {
                                setDraggingTag(tag)
                                event.dataTransfer.effectAllowed = "move"
                              }}
                              onDragEnd={() => { setDraggingTag(null); setDropTarget(null) }}
                              className={cn("cursor-grab rounded-[8px] transition-opacity active:cursor-grabbing group-hover/tag:cursor-grab", draggingTag === tag && "opacity-40")}
                            >
                              {/* 标签行：左侧描边三角展开柄，行内悬停浮现「新建会话」 */}
                              <button
                                type="button"
                                aria-expanded={!isCollapsed}
                                onClick={() => setCollapsed((current) => ({ ...current, [tag]: !isCollapsed }))}
                                className="flex h-[30px] w-full items-center gap-2 rounded-[8px] py-1 pl-1.5 pr-7 outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                              >
                                <CaretDown
                                  aria-hidden
                                  className={cn(
                                    "size-[12px] shrink-0 text-[var(--muted)] transition-transform duration-150",
                                    isCollapsed && "-rotate-90",
                                  )}
                                />
                                <Hash className={cn("size-[14px] shrink-0", toneIcons[meta.tone])} weight="bold" />
                                <span className="text-[10.5px] font-medium text-[var(--ink-soft)]">{meta.label}</span>
                                <span className="rounded-full bg-[var(--surface-subtle)] px-1.5 text-[9px] font-medium tabular-nums text-[var(--muted-strong)]">
                                  {tagItems.length}
                                </span>
                              </button>
                            </div>
                            <button
                              type="button"
                              aria-label={`在${meta.label}中新建会话`}
                              onClick={() => createConversation(tag)}
                              className="absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none opacity-0 transition-opacity duration-150 group-hover/tag:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:opacity-100"
                            >
                              <Plus className="size-[12px]" weight="bold" />
                            </button>

                            {!isCollapsed ? (
                              tagItems.length === 0 ? (
                                /* 空标签展开态：明确告知下一步，避免「点了没反应」的观感 */
                                <p className="ml-4 px-2 py-1 text-[9px] text-[var(--muted)]">暂无会话，点「＋」在此标签下新建</p>
                              ) : (
                                <div className="ml-3.5 mt-0.5 space-y-px">
                                  {tagItems.map((item) => (
                                    <ConversationRow
                                      key={item.id}
                                      item={item}
                                      tags={tags}
                                      active={activeId === item.id}
                                      onSelect={() => selectConversation(item.id)}
                                    />
                                  ))}
                                </div>
                              )
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : null}
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
    </div>
  )
}

/** 独立会话行：不按人汇聚，仅状态点 + 标题 + 时间 + 未读 */
function ConversationRow({
  item,
  tags,
  active,
  showTags = false,
  onSelect,
}: {
  item: ChatConversation
  tags: Record<ChatTagId, ChatTag>
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
        "flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left outline-none transition-[background-color] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
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
            <Hash key={tag} aria-label={`#${tags[tag]?.label ?? tag}`} className={cn("size-3", toneIcons[tags[tag]?.tone ?? "slate"])} weight="bold" />
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
        <MagnifyingGlass className="size-4" />
      </span>
      <p className="mt-3 text-[10.5px] font-medium">{title}</p>
      <p className="mt-1 text-[9px] text-[var(--muted)]">{detail}</p>
    </div>
  )
}
