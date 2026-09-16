"use client"

/**
 * 二级主导航（双层侧栏第二层，Kiln 式）：
 * 44px 品牌头 + 可滚动导航区 + 底部设置行；
 * 展开宽度 232–420px 可拖拽，收起为 64px 图标轨道（tooltip 提示）。
 * 进入项目视图时导航区整体切换为项目管理菜单。
 */

import { useState } from "react"
import Image from "next/image"
import {
  BookOpenText,
  CaretRight,
  ChatCircleDots,
  Desktop,
  FolderOpen,
  GearSix,
  Lightning,
  Planet,
  PlugsConnected,
  Star,
} from "@phosphor-icons/react"

import { NavButton, type SidebarRowItem } from "@/components/nav-button"
import { SidebarResizeHandle, useSidebarWidth } from "@/components/sidebar-resize"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { ProjectManagementPanelId } from "@/features/project/project-management-model"
import { ProjectSidebarPane } from "./sidebar-project-pane"

export type WorkbenchView =
  | "home"
  | "settings"
  | "projects"
  | "community"
  | "automation"
  | "knowledge"
  | "connectors"

/** 可折叠导航小节：标题本身即为开关，并保留轻量分隔线。 */
function CollapsibleNavSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-6 w-full items-center gap-1 rounded-[5px] px-1 text-2xs text-[var(--muted)] outline-none transition-colors hover:bg-sidebar-hover hover:text-[var(--muted-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <CaretRight
          aria-hidden
          className={cn("size-3 shrink-0 transition-transform duration-150", open && "rotate-90")}
          weight="bold"
        />
        <span className="shrink-0">{label}</span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-[var(--wt-sidebar-edge)]" />
      </button>
      {open ? <div className="mt-0.5 space-y-1">{children}</div> : null}
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
  { id: "home", label: "助理", icon: ChatCircleDots },
  { id: "projects", label: "项目", icon: FolderOpen },
  { id: "community", label: "社区", icon: Planet },
  { id: "automation", label: "自动化", icon: Lightning },
  { id: "knowledge", label: "知识库", icon: BookOpenText },
]

const connectorsItem: SidebarRowItem & { id: "connectors" } = {
  id: "connectors",
  label: "连接器",
  icon: PlugsConnected,
}

const favoriteItem: SidebarRowItem = {
  id: "favorite-project",
  label: "Fouc 桌面端 V1",
  icon: Star,
  iconClassName: "text-[#d79a3b] group-hover:text-[#d79a3b]",
  iconWeight: "fill",
}

const projectFolderItem: SidebarRowItem = {
  id: "project-folder-fouc",
  label: "Fouc 桌面端 V1",
  icon: FolderOpen,
}

const recentItem: SidebarRowItem = {
  id: "recent-project",
  label: "Fouc 桌面端",
  icon: Desktop,
  trailing: (
    <span aria-hidden className="shrink-0 text-2xs text-[var(--muted)]">
      2 小时前
    </span>
  ),
}

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
      style={{ width: open ? width : 64 }}
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
          "px-[11px] pb-4 pt-3",
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
            <CollapsibleNavSection label="更多">
              <NavButton
                item={connectorsItem}
                active={view === "connectors"}
                onSelect={() => onViewChange("connectors")}
              />
            </CollapsibleNavSection>
            <CollapsibleNavSection label="项目文件夹">
              <NavButton
                item={projectFavorited ? favoriteItem : projectFolderItem}
                active={false}
                onSelect={() => onViewChange("projects")}
              />
            </CollapsibleNavSection>
            <CollapsibleNavSection label="最近">
              <NavButton item={recentItem} active={false} onSelect={() => onViewChange("projects")} />
            </CollapsibleNavSection>
          </>
        )}
      </ScrollArea>

      {/* 展开态底行：应用设置（项目模式下由项目管理菜单自带底行，避免重复） */}
      {projectsMode ? null : (
        <div
          className={cn(
            "shrink-0 px-[11px] pb-[9px] pt-2 transition-opacity duration-150",
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

      {/* 收起态图标轨道：工作台导航 / 项目管理菜单（折叠形态） */}
      <ScrollArea
        aria-hidden={open}
        className={cn(
          "absolute inset-x-0 bottom-0 top-11 z-[5] min-h-0 transition-[opacity,transform] duration-200",
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
            {[...primaryItems, connectorsItem].map((item) => (
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

      {open ? <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} /> : null}
    </aside>
  )
}
