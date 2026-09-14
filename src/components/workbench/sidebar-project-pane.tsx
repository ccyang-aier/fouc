"use client"

/**
 * 项目模式侧栏菜单：进入项目视图后接管主导航区，
 * 承接原项目视图右侧管理轨道的全部入口（会话 / 提及 / 资产 / 成员 / 设置）。
 * 顶部项目身份卡支持下拉（返回工作台入口收纳于此）；
 * 侧栏折叠时呈现为图标轨道：工具图标、Agent、成员头像纵向排列。
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
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

import { presenceMeta, railMembers, type ProjectManagementPanelId } from "./project/project-management-model"
import { toneIcons } from "./icon-tones"
import { IDENTITY_CHIP_LAYOUT_ID, paneIdentityVariants, paneItemVariants } from "./sidebar-pane-motion"
import { SidebarNavList, type SidebarNavItem } from "./sidebar-nav"

const projectTools: Array<SidebarNavItem<ProjectManagementPanelId>> = [
  { id: "summary", label: "项目概览", icon: SquaresFour, iconClass: toneIcons.sky },
  { id: "chat", label: "项目会话", icon: Chat, iconClass: toneIcons.teal },
  { id: "mentions", label: "提及我的", icon: At, iconClass: toneIcons.amber },
  { id: "notifications", label: "通知", icon: BellSimple, iconClass: toneIcons.rose },
  { id: "ai-assets", label: "项目 AI 资产", icon: Cube, iconClass: toneIcons.violet },
  { id: "project-assets", label: "代码仓与文档资产", icon: FolderOpen, iconClass: toneIcons.blue },
  { id: "tasks", label: "项目任务", icon: CheckSquare, iconClass: toneIcons.indigo },
]

type ProjectSidebarPaneProps = {
  collapsed: boolean
  activePanel: ProjectManagementPanelId | null
  onPanelChange: (panel: ProjectManagementPanelId | null) => void
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  onExit: () => void
}

export function ProjectSidebarPane({
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

  const toolActive = projectTools.some((tool) => tool.id === activePanel)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 项目身份卡：下拉承载返回工作台；徽章与来源行动图标共享元素形变 */}
      <motion.div
        variants={paneIdentityVariants}
        className={cn("flex items-center gap-1 px-1", collapsed && "h-9 justify-center px-0")}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="项目菜单"
              className={cn(
                "group/id flex min-w-0 items-center gap-2.5 rounded-[9px] text-left outline-none transition-colors hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-wash",
                // 折叠轨道：hit 区收成围绕徽章的正方形，避免竖长 hover 底在徽章上下露出色带
                collapsed ? "size-9 flex-none justify-center p-0" : "flex-1 px-1.5 py-1.5",
              )}
            >
              <motion.span
                layoutId={IDENTITY_CHIP_LAYOUT_ID}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
                className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.72)]"
              >
                <span className="text-[10px] font-bold tracking-[-0.02em]">F1</span>
              </motion.span>
              <span className="sidebar-label min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold tracking-[-0.015em] text-[var(--ink)]">Fouc 桌面端 V1</span>
                <span className="mt-0.5 block truncate text-[9.5px] text-[var(--muted)]">产品研发空间 · 3 个任务运行中</span>
              </span>
              <CaretDown
                aria-hidden
                className="sidebar-label size-3 shrink-0 text-[var(--muted)] transition-transform duration-200 group-data-[state=open]/id:rotate-180"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Fouc 桌面端 V1</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onExit}>
              <CaretLeft weight="bold" />返回工作台
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          aria-label={favorited ? "取消收藏项目" : "收藏项目"}
          aria-pressed={favorited}
          onClick={() => onFavoriteChange(!favorited)}
          className={cn(
            "sidebar-label flex size-7 shrink-0 items-center justify-center rounded-[7px] outline-none transition-[background-color,color,transform] hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-90",
            favorited ? "text-[#d79a3b]" : "text-[var(--muted-strong)] hover:text-[var(--ink-soft)]",
          )}
        >
          <Star className="size-[15px]" weight={favorited ? "fill" : "regular"} />
        </button>
      </motion.div>

      <div aria-hidden className="my-2 h-px shrink-0 bg-[var(--line)]" />

      <motion.nav variants={paneItemVariants} aria-label="项目管理入口">
        <SidebarNavList
          items={projectTools}
          value={toolActive ? activePanel : null}
          onChange={toggle}
          collapsible
          collapsed={collapsed}
          renderTrailing={(item, { collapsed: isCollapsed }) =>
            item.id === "notifications" ? (
              isCollapsed ? (
                // 折叠轨道：红点降级为铃铛右上角角标，避免把图标挤离中心
                <span
                  aria-hidden
                  className="absolute right-[calc(50%-13px)] top-[7px] size-2 rounded-full border-[1.5px] border-[var(--panel)] bg-[#df5660]"
                />
              ) : (
                <span aria-hidden className="ml-auto size-[5px] shrink-0 rounded-full bg-[#df5660]" />
              )
            ) : null
          }
        />
      </motion.nav>

      <div aria-hidden className="my-2 h-px shrink-0 bg-[var(--line)]" />

      <motion.button
        variants={paneItemVariants}
        type="button"
        aria-label="Nova · 项目 Agent"
        aria-expanded={activePanel === "agent"}
        aria-controls="project-management-drawer"
        onClick={() => toggle("agent")}
        className={cn(paneRowClasses(activePanel === "agent"), collapsed && "justify-center px-0")}
      >
        <span
          className={cn(
            "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] transition-colors duration-150",
            activePanel === "agent"
              ? "bg-[rgb(255_255_255/0.18)] text-white"
              : "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
          )}
        >
          <Robot className="size-[13px]" weight="fill" />
        </span>
        <span className="sidebar-label truncate">Nova · 项目 Agent</span>
      </motion.button>

      <motion.section variants={paneItemVariants} aria-label="项目成员" className="mt-2">
        <div
          className={cn(
            "flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]",
            collapsed && "hidden",
          )}
        >
          <span className="sidebar-label">成员 · {railMembers.length}</span>
        </div>
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
        </div>
        {/* 邀请入口固定在成员列表末尾，与头像同尺度 */}
        <div className={cn("mt-1.5 flex", collapsed ? "justify-center" : "px-1.5")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="邀请协作成员"
                aria-expanded={activePanel === "invite"}
                aria-controls="project-management-drawer"
                onClick={() => toggle("invite")}
                className={cn(
                  "flex size-[27px] items-center justify-center rounded-full border border-dashed outline-none transition-[background-color,color,transform] hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-90",
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
      </motion.section>

      <div className="mt-auto">
        <div aria-hidden className="mb-1.5 h-px bg-[var(--line)]" />
        <motion.button
          variants={paneItemVariants}
          type="button"
          aria-label="项目设置"
          aria-expanded={activePanel === "settings"}
          aria-controls="project-management-drawer"
          onClick={() => toggle("settings")}
          className={cn(paneRowClasses(activePanel === "settings"), collapsed && "justify-center px-0")}
        >
          <GearSix
            className={cn(
              "size-[17px] shrink-0 transition-colors",
              activePanel === "settings" ? "text-white" : "text-[var(--muted-strong)]",
            )}
            weight={activePanel === "settings" ? "fill" : "regular"}
            aria-hidden
          />
          <span className="sidebar-label truncate">项目设置</span>
        </motion.button>
      </div>
    </div>
  )
}

function paneRowClasses(active: boolean) {
  return cn(
    "flex h-[36px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[12px] font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
    active
      ? "bg-[var(--accent)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]"
      : "text-[var(--ink-soft)] hover:bg-raise hover:text-[var(--ink)]",
  )
}
