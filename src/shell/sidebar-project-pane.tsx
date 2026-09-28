"use client"

/**
 * 项目模式侧栏菜单：进入项目视图后接管二级导航区，
 * 承接项目会话 / 提及 / 资产 / 成员 / 设置等管理入口。
 * 顶部项目身份卡下拉承载返回工作台；折叠时整体降级为图标轨道。
 */

import Image from "next/image"
import {
  At,
  BellSimple,
  CaretDown,
  CaretLeft,
  Chat,
  CheckSquare,
  Cube,
  FolderOpen,
  GearSix,
  Plus,
  Robot,
  SquaresFour,
  Star,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { NavButton, type SidebarRowItem } from "@/components/nav-button"
import { presenceMeta, railMembers, type ProjectManagementPanelId } from "@/features/project/project-management-model"

type ProjectTool = SidebarRowItem & { id: ProjectManagementPanelId }

const projectTools: ProjectTool[] = [
  { id: "summary", label: "项目概览", icon: SquaresFour },
  { id: "chat", label: "项目会话", icon: Chat },
  { id: "mentions", label: "提及我的", icon: At },
  {
    id: "notifications",
    label: "通知",
    icon: BellSimple,
    trailing: <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-[#df5660]" />,
  },
  { id: "ai-assets", label: "项目 AI 资产", icon: Cube },
  { id: "project-assets", label: "代码仓与文档资产", icon: FolderOpen },
  { id: "tasks", label: "项目任务", icon: CheckSquare },
]

const agentItem: SidebarRowItem & { id: "agent" } = {
  id: "agent",
  label: "Nova · 项目 Agent",
  icon: Robot,
}

type ProjectSidebarPaneProps = {
  projectName: string
  workspaceName: string
  hasDemoContent: boolean
  collapsed: boolean
  activePanel: ProjectManagementPanelId | null
  onPanelChange: (panel: ProjectManagementPanelId | null) => void
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  onExit: () => void
}

export function ProjectSidebarPane({
  projectName,
  workspaceName,
  hasDemoContent,
  collapsed,
  activePanel,
  onPanelChange,
  favorited,
  onFavoriteChange,
  onExit,
}: ProjectSidebarPaneProps) {
  function toggle(panel: ProjectManagementPanelId) {
    onPanelChange(activePanel === panel ? null : panel)
  }

  /** 折叠轨道下导航行统一带 tooltip */
  function toolRow(item: SidebarRowItem, active: boolean, onSelect: () => void, key: string) {
    const button = (
      <NavButton
        key={key}
        item={item}
        active={active}
        compact={collapsed}
        onSelect={onSelect}
      />
    )
    if (!collapsed) return button
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 项目身份卡：下拉承载返回工作台 */}
      <div className={cn("flex items-center gap-1 px-1", collapsed && "justify-center px-0")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="项目菜单"
              className={cn(
                "group/id flex min-w-0 items-center gap-2.5 rounded-[8px] text-left outline-none transition-colors hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-[var(--hover-fill)]",
                collapsed ? "size-8 flex-none justify-center p-0" : "flex-1 px-1.5 py-1",
              )}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-[12px] font-bold tracking-[-0.02em] text-white"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {hasDemoContent ? "F1" : projectName.slice(0, 2).toUpperCase()}
              </span>
              {collapsed ? null : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
                      {projectName}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">
                      {workspaceName} · 项目工作台
                    </span>
                  </span>
                  <CaretDown
                    aria-hidden
                    className="size-3 shrink-0 text-[var(--muted)] transition-transform duration-200 group-data-[state=open]/id:rotate-180"
                  />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>{projectName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onExit}>
              <CaretLeft weight="bold" />返回工作台
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {collapsed ? null : (
          <button
            type="button"
            aria-label={favorited ? "取消收藏项目" : "收藏项目"}
            aria-pressed={favorited}
            onClick={() => onFavoriteChange(!favorited)}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-[7px] outline-none transition-[background-color,color,transform] hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-90",
              favorited ? "text-[#d79a3b]" : "text-[var(--muted-strong)] hover:text-[var(--ink-soft)]",
            )}
          >
            <Star className="size-[15px]" weight={favorited ? "fill" : "regular"} />
          </button>
        )}
      </div>

      <div aria-hidden className="my-2 h-px shrink-0 bg-[var(--wt-sidebar-edge)]" />

      {hasDemoContent ? <>

      <nav
        className={cn(collapsed ? "flex flex-col gap-1" : "space-y-1")}
        aria-label="项目管理入口"
      >
        {projectTools.map((tool) =>
          toolRow(tool, activePanel === tool.id, () => toggle(tool.id), tool.id),
        )}
      </nav>

      <div aria-hidden className="my-2 h-px shrink-0 bg-[var(--wt-sidebar-edge)]" />

      {toolRow(agentItem, activePanel === "agent", () => toggle("agent"), "agent")}

      <section aria-label="项目成员" className="mt-2">
        {collapsed ? null : (
          <div className="flex h-6 items-center px-2 text-2xs text-[var(--muted)]">
            成员 · {railMembers.length}
          </div>
        )}
        <div className={cn("flex gap-1 px-1.5", collapsed ? "flex-col items-center px-0" : "mt-1 flex-wrap")}>
          {railMembers.map((member) => {
            const panelId = `member:${member.id}` as const
            const presence = presenceMeta[member.presence]
            const active = activePanel === panelId

            return (
              <Tooltip key={member.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${member.name} · ${presence.label}`}
                    aria-expanded={active}
                    aria-controls="project-management-drawer"
                    onClick={() => toggle(panelId)}
                    className="relative flex size-[27px] shrink-0 rounded-full outline-none transition-transform duration-200 hover:scale-[1.08] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95"
                  >
                    <Image
                      src={member.avatar}
                      alt=""
                      width={56}
                      height={56}
                      className={cn(
                        "size-[27px] rounded-full object-cover transition-shadow duration-200",
                        active && "ring-2 ring-[var(--accent)]",
                      )}
                    />
                    <span
                      aria-hidden
                      className="absolute -right-px -bottom-px size-2 rounded-full border-[1.5px] border-[var(--panel)]"
                      style={{ backgroundColor: presence.color }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{member.name} · {presence.label}</TooltipContent>
              </Tooltip>
            )
          })}
          {/* 邀请入口固定在成员列表末尾，与头像同尺度 */}
          <div className={cn("flex", collapsed && "justify-center")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="邀请协作成员"
                  aria-expanded={activePanel === "invite"}
                  aria-controls="project-management-drawer"
                  onClick={() => toggle("invite")}
                  className={cn(
                    "flex size-[27px] items-center justify-center rounded-full border border-dashed outline-none transition-[background-color,color,transform] hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-90",
                    activePanel === "invite"
                      ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : "border-[var(--line-strong)] text-[var(--muted-strong)] hover:text-[var(--ink)]",
                  )}
                >
                  <Plus className="size-3" weight="bold" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">邀请协作成员</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </section>

      <div className="mt-auto">
        <div aria-hidden className="mb-1.5 h-px bg-[var(--wt-sidebar-edge)]" />
        {toolRow(
          { id: "settings", label: "项目设置", icon: GearSix },
          activePanel === "settings",
          () => toggle("settings"),
          "project-settings",
        )}
      </div>
      </> : collapsed ? null : <p className="px-2 py-2 text-[11px] leading-5 text-[var(--muted)]">这个项目还没有工作项。</p>}
    </div>
  )
}
