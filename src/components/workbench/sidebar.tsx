"use client"

import { useState } from "react"
import {
  Bell,
  BookOpenText,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Desktop,
  DotsThreeCircle,
  FolderOpen,
  Folders,
  Funnel,
  GearSix,
  Lightning,
  Plus,
  PlusCircle,
  PlugsConnected,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { SidebarNavList, type SidebarNavItem } from "./sidebar-nav"
import { SidebarResizeHandle, useSidebarWidth } from "./sidebar-resize"

export type WorkbenchView = "home" | "settings" | "projects" | "agent-hub" | "automation" | "knowledge" | "more"

const navigation: Array<SidebarNavItem<WorkbenchView>> = [
  { id: "home", label: "助理", icon: ChatCircleDots, color: "text-[#58b7a2]" },
  { id: "projects", label: "项目", icon: FolderOpen, color: "text-[#6e9fe6]" },
  { id: "agent-hub", label: "Agent · 技能 · 连接器", icon: PlugsConnected, color: "text-[#9b80dc]" },
  { id: "automation", label: "自动化", icon: Lightning, color: "text-[#e6a64f]" },
  { id: "knowledge", label: "知识库", icon: BookOpenText, color: "text-[#63b99d]" },
  { id: "more", label: "更多", icon: DotsThreeCircle, color: "text-[#929aa3]" },
]

const SIDEBAR_VERSION = "v0.1.0"

function DenseCollapseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="3.5" height="10" rx="1.25" fill="currentColor" opacity="0.55" />
      <rect x="6.5" y="3" width="7.5" height="10" rx="1.5" fill="currentColor" />
    </svg>
  )
}

/** 精致版放大镜：细环 + 实心圆角手柄，笔触介于 Phosphor bold 与 fill 之间，小尺寸下更清爽。 */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="110" cy="110" r="68" stroke="currentColor" strokeWidth="24" />
      <path d="M163 163l49 49" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
    </svg>
  )
}

export function Sidebar({
  collapsed,
  onToggle,
  onNewMission,
  view,
  onViewChange,
}: {
  collapsed: boolean
  onToggle: () => void
  onNewMission: () => void
  view: WorkbenchView
  onViewChange: (view: WorkbenchView) => void
}) {
  const [spacesOpen, setSpacesOpen] = useState(true)
  const [recentOpen, setRecentOpen] = useState(true)
  const { width, dragging, startResize } = useSidebarWidth()

  return (
    <div
      /* zIndex 用内联：材质底座对直接子元素的非分层 z-index:1 会压过 z-20 工具类，
         内联才能保住拖拽手柄压在主面板圆角之上的层级 */
      style={{ width: collapsed ? 60 : width, zIndex: 20 }}
      className={cn(
        "h-full shrink-0",
        !dragging && "transition-[width] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      <aside
        className={cn(
          // 右缘分割线由主面板的 border-left 统一提供，此处不再自绘
          "relative flex h-full min-h-0 flex-col px-3 pb-3 transition-[padding] duration-200 max-[1080px]:px-2.5",
          collapsed && "sidebar-collapsed px-2 max-[1080px]:px-2",
        )}
      >
        <div className="flex h-[66px] shrink-0 items-center">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="展开侧边栏"
                  onClick={onToggle}
                  className="mx-auto flex size-8 items-center justify-center rounded-[7px] text-[var(--ink-soft)] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="scale-x-[-1]"><DenseCollapseIcon /></span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">展开侧边栏</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="sidebar-label min-w-0 flex-1 leading-none">
                <div className="truncate text-[15px] font-semibold tracking-[-0.025em] text-[var(--ink-soft)]">Fouc</div>
                <div className="mt-1.5 truncate text-[10px] font-medium text-[var(--muted)]">{SIDEBAR_VERSION}</div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="收起侧边栏"
                    onClick={onToggle}
                    className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <DenseCollapseIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">收起侧边栏</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="搜索"
                    className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <SearchIcon className="size-[17px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">搜索</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="筛选"
                    className="flex size-8 shrink-0 items-center justify-center rounded-[7px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Funnel className="size-[17px]" weight="fill" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">筛选</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onNewMission}
          aria-label="新建任务"
          className={cn(
            "mt-1 h-8 w-full justify-start rounded-[8px] border-black/[0.075] bg-white/30 px-2 text-[12px] font-semibold shadow-none hover:bg-white",
            collapsed && "justify-center px-0",
          )}
        >
          <PlusCircle className="size-[16px]" weight="bold" />
          <span className="sidebar-label">新建任务</span>
        </Button>

        <nav aria-label="主导航" className="mt-2.5">
          <SidebarNavList
            items={navigation}
            value={view}
            onChange={onViewChange}
            collapsible
            renderTrailing={(item) =>
              item.id === "more" ? (
                <CaretRight className="sidebar-label ml-auto size-3 text-[var(--muted)]" aria-hidden />
              ) : null
            }
          />
        </nav>

        <section className="mt-3" aria-label="工作空间">
          <div
            className={cn(
              "flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]",
              collapsed && "justify-center px-0",
            )}
          >
            <button
              type="button"
              onClick={() => setSpacesOpen((open) => !open)}
              className={cn(
                "flex items-center gap-1 rounded-md outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                collapsed && "hidden",
              )}
              aria-expanded={spacesOpen}
              aria-label="切换空间列表"
            >
              <span className="sidebar-label">空间 (2)</span>
              {spacesOpen ? (
                <CaretDown className="sidebar-label size-3" />
              ) : (
                <CaretRight className="sidebar-label size-3" />
              )}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="新建空间"
                  className={cn(
                    "ml-auto flex size-6 items-center justify-center rounded-md outline-none hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    collapsed && "ml-0",
                  )}
                >
                  <Plus className="size-3" weight="bold" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">新建空间</TooltipContent>
            </Tooltip>
          </div>

          {spacesOpen ? (
            <div className="mt-px space-y-px animate-in fade-in-0 slide-in-from-top-1">
              <SpaceRow label="产品研发" icon={Folders} color="text-[#58b7a2]" />
              <SpaceRow label="个人工作台" icon={UsersThree} color="text-[#6e9fe6]" />
            </div>
          ) : null}
        </section>

        <section className="mt-3" aria-label="最近访问">
          <div
            className={cn(
              "flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]",
              collapsed && "justify-center px-0",
            )}
          >
            <button
              type="button"
              onClick={() => setRecentOpen((open) => !open)}
              aria-controls="recent-items"
              aria-expanded={recentOpen}
              aria-label={recentOpen ? "收起最近访问" : "展开最近访问"}
              className={cn(
                "flex min-w-0 items-center gap-1 rounded-md outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                collapsed && "hidden",
              )}
            >
              <span className="sidebar-label">最近 (1)</span>
              {recentOpen ? (
                <CaretDown className="sidebar-label size-3" />
              ) : (
                <CaretRight className="sidebar-label size-3" />
              )}
            </button>
            <div className={cn("sidebar-label ml-auto flex items-center gap-0.5", collapsed && "ml-0")}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="新建任务"
                    onClick={onNewMission}
                    className="flex size-6 items-center justify-center rounded-md outline-none transition-colors hover:bg-black/[0.05] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Plus className="size-3" weight="bold" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">新建</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div
            id="recent-items"
            className={cn(recentOpen && "mt-1 animate-in fade-in-0 slide-in-from-top-1")}
          >
            {recentOpen ? (
              <button
                type="button"
                className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[11px] outline-none transition-[background-color,box-shadow] hover:bg-white hover:shadow-[0_1px_2px_rgba(21,30,34,0.05)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <Desktop className="size-[16px] shrink-0 text-[#89939d]" weight="fill" />
                <span className="sidebar-label truncate">Fouc 桌面端</span>
                <span className="sidebar-label ml-auto text-[9px] text-[var(--muted)]">2 小时前</span>
              </button>
            ) : null}
          </div>
        </section>

        <div className="mt-auto">
          <button
            type="button"
            aria-label="设置"
            onClick={() => onViewChange("settings")}
            className={cn(
              "mb-1.5 flex h-[32px] w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[12px] font-medium text-[var(--ink-soft)] outline-none transition-[background-color,color,box-shadow] hover:bg-white hover:text-[var(--ink)] hover:shadow-[0_1px_2px_rgba(21,30,34,0.05)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              collapsed && "justify-center px-0",
            )}
          >
            <GearSix className="size-[16px] shrink-0 text-[#89939d]" weight="fill" />
            <span className="sidebar-label">设置</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="打开个人菜单"
                className={cn(
                  "flex h-[42px] w-full items-center gap-2 rounded-[8px] border border-black/[0.065] bg-white/25 px-2 text-left outline-none transition-colors hover:bg-white/65 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e5f3ef] text-[#54ac96]">
                  <UserCircle className="size-[21px]" weight="fill" />
                  <span className="absolute right-0 bottom-0 size-1.5 rounded-full border border-[var(--shell)] bg-[#18b988]" />
                </span>
                <span className="sidebar-label min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold">林默</span>
                  <span className="block truncate text-[9px] text-[var(--muted)]">本地在线</span>
                </span>
                <CaretDown className="sidebar-label size-3 text-[var(--muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuLabel>林默 · 个人工作台</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onViewChange("settings")}>
                <GearSix weight="fill" /> 设置
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell weight="fill" /> 通知
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!collapsed ? <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} /> : null}
      </aside>
    </div>
  )
}

function SpaceRow({
  label,
  icon: Icon,
  color,
}: {
  label: string
  icon: typeof Folders
  color: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-medium outline-none transition-[background-color,box-shadow] hover:bg-white hover:shadow-[0_1px_2px_rgba(21,30,34,0.05)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <CaretRight className="sidebar-label size-3 text-[var(--muted)]" />
      <Icon className={cn("size-[16px] shrink-0", color)} weight="fill" />
      <span className="sidebar-label truncate">{label}</span>
    </button>
  )
}
