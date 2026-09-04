"use client"

/**
 * 项目模式侧栏菜单：进入项目视图后接管主导航区，
 * 承接原项目视图右侧管理轨道的全部入口（会话 / 提及 / 资产 / 成员 / 设置）。
 * 面板开合由 WorkbenchShell 持有的 managementPanel 状态驱动，抽屉覆盖在主区左缘。
 */

import Image from "next/image"
import {
  At,
  BellSimple,
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

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { presenceMeta, railMembers, type ProjectManagementPanelId } from "./project/project-management-model"
import { SidebarNavList, type SidebarNavItem } from "./sidebar-nav"

const projectTools: Array<SidebarNavItem<ProjectManagementPanelId>> = [
  { id: "summary", label: "项目概览", icon: SquaresFour },
  { id: "chat", label: "项目会话", icon: Chat },
  { id: "mentions", label: "提及我的", icon: At },
  { id: "notifications", label: "通知", icon: BellSimple },
  { id: "ai-assets", label: "项目 AI 资产", icon: Cube },
  { id: "project-assets", label: "代码仓与文档资产", icon: FolderOpen },
  { id: "tasks", label: "项目任务", icon: CheckSquare },
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
      <button
        type="button"
        onClick={onExit}
        className="flex h-8 w-full items-center gap-1.5 rounded-[8px] px-2 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <CaretLeft className="size-[13px] shrink-0" weight="bold" aria-hidden />
        <span className="sidebar-label truncate">返回工作台</span>
      </button>

      <div className="mt-1.5 flex min-h-[44px] items-center gap-2.5 px-2">
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.72)]">
          <span className="text-[10px] font-bold tracking-[-0.02em]">F1</span>
        </span>
        <div className="sidebar-label min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold tracking-[-0.015em] text-[var(--ink)]">Fouc 桌面端 V1</div>
          <div className="mt-0.5 truncate text-[9.5px] text-[var(--muted)]">产品研发空间 · 3 个任务运行中</div>
        </div>
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
      </div>

      <div aria-hidden className="my-2 h-px shrink-0 bg-[var(--line)]" />

      <nav aria-label="项目管理入口">
        <SidebarNavList
          items={projectTools}
          value={toolActive ? activePanel : null}
          onChange={toggle}
          collapsible
          renderTrailing={(item) =>
            item.id === "notifications" ? (
              <span aria-hidden className="ml-auto size-[5px] shrink-0 rounded-full bg-[#df5660]" />
            ) : null
          }
        />
      </nav>

      <div aria-hidden className="my-2 h-px shrink-0 bg-[var(--line)]" />

      <button
        type="button"
        onClick={() => toggle("agent")}
        aria-expanded={activePanel === "agent"}
        aria-controls="project-management-drawer"
        className={paneRowClasses(activePanel === "agent")}
      >
        <span
          className={cn(
            "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] transition-colors duration-150",
            activePanel === "agent"
              ? "bg-[var(--accent-ink)] text-[var(--panel)]"
              : "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
          )}
        >
          <Robot className="size-[13px]" weight="fill" />
        </span>
        <span className="sidebar-label truncate">Nova · 项目 Agent</span>
      </button>

      <section aria-label="项目成员" className={cn("mt-2", collapsed && "hidden")}>
        <div className="flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]">
          <span className="sidebar-label">成员 · {railMembers.length}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="邀请协作成员"
                aria-expanded={activePanel === "invite"}
                aria-controls="project-management-drawer"
                onClick={() => toggle("invite")}
                className="ml-auto flex size-6 items-center justify-center rounded-md outline-none transition-colors hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <Plus className="size-3" weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">邀请协作成员</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-1 flex flex-wrap gap-1 px-1.5">
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
      </section>

      <div className="mt-auto">
        <div aria-hidden className="mb-1.5 h-px bg-[var(--line)]" />
        <button
          type="button"
          onClick={() => toggle("settings")}
          aria-expanded={activePanel === "settings"}
          aria-controls="project-management-drawer"
          className={paneRowClasses(activePanel === "settings")}
        >
          <GearSix
            className={cn(
              "size-[17px] shrink-0 transition-colors",
              activePanel === "settings" ? "text-[var(--accent-ink)]" : "text-[var(--muted-strong)]",
            )}
            weight={activePanel === "settings" ? "fill" : "regular"}
            aria-hidden
          />
          <span className="sidebar-label truncate">项目设置</span>
        </button>
      </div>
    </div>
  )
}

function paneRowClasses(active: boolean) {
  return cn(
    "flex h-[36px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[12px] font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
    active
      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent-soft-line)]"
      : "text-[var(--ink-soft)] hover:bg-raise hover:text-[var(--ink)]",
  )
}
