"use client"

/**
 * 二级主导航（双层侧栏第二层，Kiln 式）：
 * 44px 品牌头 + 可滚动导航区 + 底部设置行；
 * 展开宽度 232–420px 可拖拽，收起为 64px 图标轨道（tooltip 提示）。
 * 进入项目视图时导航区整体切换为项目管理菜单。
 */

import { useState } from "react"
import { AccountItem } from "@/features/identity/components/account-item"
import Image from "next/image"
import {
  BookOpenText,
  CaretDown,
  ChatCircleDots,
  ClockCounterClockwise,
  DotsThree,
  FolderOpen,
  GearSix,
  Lightning,
  PencilSimple,
  Planet,
  PlugsConnected,
  Plus,
  PushPin,
  Stack,
  Star,
  Trash,
} from "@phosphor-icons/react"

import { NavButton, type SidebarRowItem } from "@/components/nav-button"
import { SidebarResizeHandle, useSidebarWidth } from "@/components/sidebar-resize"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { ProjectManagementPanelId } from "@/features/project/project-management-model"
import { SidebarAgentSection } from "./sidebar-agent-section"
import { ProjectSidebarPane } from "./sidebar-project-pane"

export type WorkbenchView =
  | "home"
  | "settings"
  | "project-home"
  | "projects"
  | "community"
  | "automation"
  | "knowledge"
  | "connectors"

/** 项目集合导航：标题、数量与操作收敛在同一行。 */
function ProjectNavSection({
  label,
  count,
  icon,
  children,
  onNew,
  compact = false,
  defaultOpen = true,
}: {
  label: string
  count: number
  icon: React.ReactNode
  children: React.ReactNode
  onNew?: () => void
  compact?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn(compact ? "mt-0.5" : "mt-3.5")}>
      <div className="sidebar-nav-row group/project flex h-8 w-full items-center justify-between gap-2 rounded-[6px] px-1.5 text-[12px] text-[var(--muted-strong)]">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[5px] text-left outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <span className="flex size-4 shrink-0 items-center justify-center self-center text-[var(--muted)]">{icon}</span>
          <span className="truncate leading-4">{label}</span>
          <span className="text-[10.5px] tabular-nums text-[var(--muted)]">({count})</span>
          <CaretDown aria-hidden className={cn("size-2.5 shrink-0 transition-transform duration-150", !open && "-rotate-90")} weight="fill" />
        </button>
        {onNew ? <div className="pointer-events-none flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover/project:pointer-events-auto group-hover/project:opacity-100 group-focus-within/project:pointer-events-auto group-focus-within/project:opacity-100"><button type="button" aria-label={`新建${label}`} title={`新建${label}`} onClick={() => { setOpen(true); onNew() }} className="flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Plus className="size-3.5" /></button></div> : null}
      </div>
      {open ? <div className="mt-0.5 space-y-1 pl-3.5">{children}</div> : null}
    </div>
  )
}

function SidebarSectionCaption({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-6 items-center gap-2 px-1.5 text-[11px] font-medium tracking-[0.02em] text-[var(--muted)]">
      <span className="shrink-0">{children}</span>
      <span aria-hidden className="h-px min-w-0 flex-1 bg-[var(--wt-sidebar-edge)] opacity-70" />
    </div>
  )
}

function QuickAccessCategory({
  label,
  count,
  icon,
  children,
}: {
  label: string
  count: number
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="sidebar-nav-row flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[12px] text-[var(--muted-strong)] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
        <span className="min-w-0 truncate">{label}</span>
        <span className="text-[10.5px] tabular-nums text-[var(--muted)]">({count})</span>
        <CaretDown aria-hidden className={cn("size-2.5 shrink-0 text-[var(--muted)] transition-transform duration-150", !open && "-rotate-90")} weight="fill" />
      </button>
      {open && count > 0 ? <div className="mt-0.5 space-y-1 pl-3.5">{children}</div> : null}
    </div>
  )
}

type ManagedSidebarEntry = {
  id: string
  name: string
  kind: "project" | "chat"
  marked: boolean
  time?: string
}

function ManagedSidebarRow({ entry, active, editing, onSelect, onBeginRename, onRename, onDelete, onToggleMark }: {
  entry: ManagedSidebarEntry
  active: boolean
  editing: boolean
  onSelect: () => void
  onBeginRename: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onToggleMark: () => void
}) {
  const [draft, setDraft] = useState(entry.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const ItemIcon = entry.kind === "project" ? FolderOpen : ChatCircleDots
  const MarkIcon = entry.kind === "project" ? Star : PushPin
  const markLabel = entry.kind === "project" ? (entry.marked ? "取消星标" : "标记为星标项目") : (entry.marked ? "取消置顶" : "置顶该聊天")

  if (editing) {
    return <div className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[var(--surface-subtle)] px-2 text-[11.5px] font-normal"><ItemIcon className="size-3.5 shrink-0 text-[var(--muted)]" /><input autoFocus aria-label={`重命名${entry.name}`} value={draft} onChange={(event) => setDraft(event.target.value)} onFocus={(event) => event.currentTarget.select()} onBlur={() => onRename(draft)} onKeyDown={(event) => { if (event.key === "Enter") onRename(draft); if (event.key === "Escape") onRename(entry.name) }} className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none [font:inherit]" /></div>
  }

  return (
    <div data-active={active} className="sidebar-nav-row group/entry relative flex h-[30px] items-center rounded-[6px] text-[11.5px] text-[var(--muted-strong)]">
      <button type="button" aria-label={entry.name} aria-current={active ? "page" : undefined} onClick={onSelect} className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[6px] pl-2 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
        <ItemIcon className="size-3.5 shrink-0 text-[var(--muted)]" weight="duotone" />
        <span className="truncate">{entry.name}</span>
        {entry.time ? <span className={cn("ml-auto shrink-0 text-[10.5px] text-[var(--muted)] transition-opacity group-hover/entry:opacity-0 group-focus-within/entry:opacity-0", menuOpen && "opacity-0")}>{entry.time}</span> : null}
      </button>
      <div className={cn("absolute right-1 flex items-center gap-0.5 transition-opacity", menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0 group-hover/entry:pointer-events-auto group-hover/entry:opacity-100 group-focus-within/entry:pointer-events-auto group-focus-within/entry:opacity-100")}>
        <button type="button" aria-label={markLabel} title={markLabel} aria-pressed={entry.marked} onClick={onToggleMark} className={cn("flex size-6 items-center justify-center rounded-[5px] outline-none hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", entry.marked ? (entry.kind === "project" ? "text-[#d79a3b]" : "text-[var(--muted-strong)]") : "text-[var(--muted)] hover:text-[var(--ink)]")}><MarkIcon className="size-3.5" weight={entry.marked ? "fill" : "regular"} /></button>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><DropdownMenuTrigger asChild><button type="button" aria-label={`${entry.name}更多操作`} title="更多操作" className={cn("flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", menuOpen && "bg-[var(--surface-hover)] text-[var(--ink)]")}><DotsThree className="size-4" weight="bold" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={4} className="w-28 min-w-0"><DropdownMenuItem onSelect={onBeginRename}><PencilSimple />重命名</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={onDelete} className="text-[var(--err-ink)]"><Trash />删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </div>
  )
}

/** 品牌标：直接展示 logo，不叠加容器或底色。 */
function FoucMark({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      src="/brand/fouc-mark.png"
      alt=""
      width={compact ? 26 : 24}
      height={compact ? 26 : 24}
      draggable={false}
      className="shrink-0 object-contain"
    />
  )
}

/** 收起按钮：左窄右宽双矩形示意侧栏面板 */
function CollapseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-[14px]" fill="none">
      <rect x="2" y="3" width="3.5" height="10" rx="1.25" fill="currentColor" opacity=".55" />
      <rect x="6.5" y="3" width="7.5" height="10" rx="1.5" fill="currentColor" />
    </svg>
  )
}

const primaryItems: Array<SidebarRowItem & { id: WorkbenchView }> = [
  { id: "home", label: "新对话", icon: ChatCircleDots },
  { id: "project-home", label: "项目", icon: FolderOpen },
  { id: "automation", label: "自动化", icon: Lightning },
  { id: "connectors", label: "连接器", icon: PlugsConnected },
  { id: "community", label: "社区", icon: Planet },
  { id: "knowledge", label: "知识库", icon: BookOpenText },
]

export function NavigationSidebar({
  open,
  onCollapse,
  onExpand,
  view,
  onViewChange,
  projectFavorited,
  onProjectFavoriteChange,
  managementPanel,
  onManagementPanelChange,
}: {
  open: boolean
  onCollapse: () => void
  onExpand: () => void
  view: WorkbenchView
  onViewChange: (view: WorkbenchView) => void
  projectFavorited: boolean
  onProjectFavoriteChange: (favorited: boolean) => void
  managementPanel: ProjectManagementPanelId | null
  onManagementPanelChange: (panel: ProjectManagementPanelId | null) => void
}) {
  const { width, dragging, startResize } = useSidebarWidth()
  const projectsMode = view === "projects"
  const [projects, setProjects] = useState<ManagedSidebarEntry[]>([{ id: "fouc-desktop-v1", name: "Fouc 桌面端 V1", kind: "project", marked: projectFavorited }])
  const [recentChats, setRecentChats] = useState<ManagedSidebarEntry[]>([{ id: "fouc-desktop-chat", name: "Fouc 桌面端", kind: "chat", marked: false, time: "2 小时前" }])
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectDraft, setNewProjectDraft] = useState("")
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null)
  const favoriteProjects = projects.filter((entry) => entry.marked)
  const pinnedChats = recentChats.filter((entry) => entry.marked)

  function updateEntry(entry: ManagedSidebarEntry, update: (current: ManagedSidebarEntry) => ManagedSidebarEntry) {
    const setter = entry.kind === "project" ? setProjects : setRecentChats
    setter((current) => current.map((item) => item.id === entry.id ? update(item) : item))
  }

  function toggleMarked(entry: ManagedSidebarEntry) {
    updateEntry(entry, (current) => ({ ...current, marked: !current.marked }))
    if (entry.kind === "project" && entry.id === "fouc-desktop-v1") onProjectFavoriteChange(!entry.marked)
  }

  function renameEntry(entry: ManagedSidebarEntry, name: string) {
    const nextName = name.trim()
    if (nextName) updateEntry(entry, (current) => ({ ...current, name: nextName }))
    setEditingEntryId(null)
  }

  function deleteEntry(entry: ManagedSidebarEntry) {
    const setter = entry.kind === "project" ? setProjects : setRecentChats
    setter((current) => current.filter((item) => item.id !== entry.id))
    setEditingEntryId(null)
  }

  function createProject() {
    const name = newProjectDraft.trim()
    if (!name) return
    setProjects((current) => [...current, { id: `project-${Date.now()}`, name, kind: "project", marked: false }])
    setNewProjectDraft("")
    setCreatingProject(false)
  }

  function renderManagedEntry(entry: ManagedSidebarEntry, keyPrefix = "") {
    const itemKey = `${keyPrefix}${entry.kind}-${entry.id}`
    return <ManagedSidebarRow key={itemKey} entry={entry} active={activeItemKey === itemKey} editing={editingEntryId === entry.id && !keyPrefix} onSelect={() => { setActiveItemKey(itemKey); if (!keyPrefix && entry.kind === "project") onViewChange("projects") }} onBeginRename={() => setEditingEntryId(entry.id)} onRename={(name) => renameEntry(entry, name)} onDelete={() => deleteEntry(entry)} onToggleMark={() => toggleMarked(entry)} />
  }

  const paneProps = {
    activePanel: managementPanel,
    onPanelChange: onManagementPanelChange,
    favorited: projectFavorited,
    onFavoriteChange: onProjectFavoriteChange,
    onExit: () => onViewChange("home"),
  }

  return (
    <aside
      aria-label={open ? "主导航" : "主导航（已收起）"}
      style={{ width: open ? width : 52 }}
      className={cn(
        "relative flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--wt-sidebar-edge)]",
        !dragging && "will-change-[width] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      {/* 收起态头部：点击品牌标展开 */}
      <button
        type="button"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        aria-label="展开主导航"
        title="展开主导航"
        onClick={onExpand}
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-center border-b border-[var(--wt-sidebar-edge)] outline-none transition-[opacity,transform] duration-200 hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
          open ? "pointer-events-none -translate-x-1 opacity-0" : "delay-100 opacity-100",
        )}
      >
        <FoucMark compact />
      </button>

      {/* 展开态头部：品牌标 + 名称 + 收起按钮 */}
      <div
        className={cn(
          "flex h-11 shrink-0 items-center border-b border-[var(--wt-sidebar-edge)] px-[11px] transition-[opacity,transform] duration-150",
          open ? "delay-100 opacity-100" : "pointer-events-none translate-x-1 opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <FoucMark />
          <span className="truncate text-[13px] font-semibold text-[var(--ink)]">Fouc</span>
        </div>
        <button
          type="button"
          aria-label="收起主导航"
          title="收起主导航"
          onClick={onCollapse}
          className="ml-auto inline-flex h-6 min-w-7 items-center justify-center rounded-[5px] px-1.5 text-[var(--muted-strong)] outline-none transition-colors hover:bg-surface-hover hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <CollapseIcon />
        </button>
      </div>

      {/* 展开态导航区：工作台导航 / 项目管理菜单 */}
      <ScrollArea
        aria-hidden={!open}
        className={cn(
          "min-h-0 flex-1 transition-[opacity,transform] duration-150",
          open ? "delay-100 opacity-100" : "pointer-events-none -translate-x-1 opacity-0",
        )}
        viewportClassName={cn(
          "pb-4 pl-[11px] pr-[10px] pt-3",
          projectsMode && "flex h-full flex-col",
        )}
      >
        {projectsMode ? (
          <ProjectSidebarPane collapsed={false} {...paneProps} />
        ) : (
          <>
            <nav className="space-y-1" aria-label="主导航">
              {primaryItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={view === item.id}
                  onSelect={(id) => onViewChange(id as WorkbenchView)}
                />
              ))}
            </nav>
            {favoriteProjects.length > 0 || pinnedChats.length > 0 ? (
              <div className="mt-3">
                <SidebarSectionCaption>快捷访问</SidebarSectionCaption>
                <div className="mt-0.5 space-y-0.5">
                  {favoriteProjects.length > 0 ? <QuickAccessCategory label="项目" count={favoriteProjects.length} icon={<Star className="size-3.5 text-[#d79a3b]" weight="fill" />}>
                    {favoriteProjects.map((entry) => renderManagedEntry(entry, "favorite-"))}
                  </QuickAccessCategory> : null}
                  {pinnedChats.length > 0 ? <QuickAccessCategory label="对话" count={pinnedChats.length} icon={<PushPin className="size-3.5 text-[var(--muted-strong)]" weight="fill" />}>
                    {pinnedChats.map((entry) => renderManagedEntry(entry, "pinned-"))}
                  </QuickAccessCategory> : null}
                </div>
              </div>
            ) : null}

            <div className="mt-3">
              <SidebarSectionCaption>工作台</SidebarSectionCaption>
              <ProjectNavSection compact defaultOpen={false} label="项目库" count={projects.length} icon={<Stack className="size-3.5" weight="duotone" />} onNew={() => { setCreatingProject(true); setNewProjectDraft("") }}>
                {creatingProject ? <div className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[var(--surface-subtle)] px-2 text-[11.5px] font-normal"><FolderOpen className="size-3.5 shrink-0 text-[var(--muted)]" /><input autoFocus aria-label="新项目名称" value={newProjectDraft} onChange={(event) => setNewProjectDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createProject(); if (event.key === "Escape") { setCreatingProject(false); setNewProjectDraft("") } }} onBlur={() => { if (!newProjectDraft.trim()) setCreatingProject(false) }} placeholder="项目名称" className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)] [font:inherit]" /></div> : null}
                {projects.map((entry) => renderManagedEntry(entry))}
              </ProjectNavSection>
              <SidebarAgentSection
                compact
                activeAgentId={activeItemKey?.startsWith("agent-") ? activeItemKey.slice(6) : null}
                onAgentSelect={(agentId) => setActiveItemKey(`agent-${agentId}`)}
              />
            </div>
            <ProjectNavSection label="最近" count={recentChats.length} icon={<ClockCounterClockwise className="size-3.5" weight="duotone" />}>
              {recentChats.map((entry) => renderManagedEntry(entry))}
            </ProjectNavSection>
          </>
        )}
      </ScrollArea>

      {/* 展开态底行：应用设置（项目模式下由项目管理菜单自带底行，避免重复） */}
      {projectsMode ? null : (
        <div
          className={cn(
            "shrink-0 pb-[9px] pl-[11px] pr-[10px] pt-2 transition-opacity duration-150",
            open ? "delay-100 opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="grid gap-1">
            <NavButton
              item={{ id: "settings", label: "设置", icon: GearSix }}
              active={view === "settings"}
              onSelect={() => onViewChange("settings")}
            />
          </div>
        </div>
      )}
      {open ? <div className="shrink-0 border-t border-[var(--wt-sidebar-edge)] px-2 py-1"><AccountItem /></div> : null}

      {/* 收起态图标轨道：工作台导航 / 项目管理菜单（折叠形态） */}
      <ScrollArea
        aria-hidden={open}
        className={cn(
          "absolute inset-x-0 bottom-12 top-11 z-[5] min-h-0 transition-[opacity,transform] duration-200",
          open ? "pointer-events-none translate-x-1 opacity-0" : "delay-100 translate-x-0 opacity-100",
        )}
        viewportClassName={cn(
          "flex flex-col pb-3 pt-3",
          projectsMode ? "h-full px-1.5" : "items-center",
        )}
      >
        {projectsMode ? (
          <ProjectSidebarPane collapsed {...paneProps} />
        ) : (
          <nav className="flex w-full flex-col items-center gap-1" aria-label="主导航">
            {primaryItems.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <NavButton
                    item={item}
                    active={view === item.id}
                    compact
                    onSelect={(id) => onViewChange(id as WorkbenchView)}
                  />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>
        )}
      </ScrollArea>

      {!open ? <div className="absolute inset-x-0 bottom-0 z-10 border-t border-[var(--wt-sidebar-edge)] bg-[var(--shell)] p-1"><AccountItem compact /></div> : null}
      {open ? <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} /> : null}
    </aside>
  )
}
