"use client"

import Image from "next/image"
import { useState } from "react"
import {
  Bell,
  BookOpenText,
  CaretDoubleLeft,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Desktop,
  DotsThreeCircle,
  FolderOpen,
  Folders,
  GearSix,
  Lightning,
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

export type WorkbenchView = "home" | "settings" | "projects" | "agent-hub" | "automation" | "knowledge" | "more"

const navigation: Array<{ label: string; icon: typeof ChatCircleDots; color: string; view: WorkbenchView }> = [
  { label: "助理", icon: ChatCircleDots, color: "text-[#58b7a2]", view: "home" },
  { label: "项目", icon: FolderOpen, color: "text-[#6e9fe6]", view: "projects" },
  { label: "Agent · 技能 · 连接器", icon: PlugsConnected, color: "text-[#9b80dc]", view: "agent-hub" },
  { label: "自动化", icon: Lightning, color: "text-[#e6a64f]", view: "automation" },
  { label: "知识库", icon: BookOpenText, color: "text-[#63b99d]", view: "knowledge" },
  { label: "更多", icon: DotsThreeCircle, color: "text-[#929aa3]", view: "more" },
]

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

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-[var(--shell)] px-3 pb-3 transition-[padding] duration-200 max-[1080px]:px-2.5",
        collapsed && "sidebar-collapsed px-2 max-[1080px]:px-2",
      )}
    >
      <div className="flex h-[50px] shrink-0 items-center">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="展开侧边栏"
                onClick={onToggle}
                className="mx-auto flex size-9 items-center justify-center rounded-[9px] outline-none transition-colors hover:bg-black/[0.045] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <span className="relative size-6 shrink-0 overflow-hidden">
                  <Image
                    src="/brand/fouc-mark.png"
                    alt=""
                    fill
                    sizes="24px"
                    draggable={false}
                    className="scale-[1.5] object-contain"
                    priority
                  />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">展开侧边栏</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <span className="relative size-6 shrink-0 overflow-hidden">
              <Image
                src="/brand/fouc-mark.png"
                alt=""
                fill
                sizes="24px"
                draggable={false}
                className="scale-[1.5] object-contain"
                priority
              />
            </span>
            <div className="sidebar-label ml-1 min-w-0 flex-1 leading-none">
              <div className="truncate text-[12px] font-semibold tracking-[-0.01em]">Fouc</div>
              <div className="mt-1 truncate text-[9px] text-[var(--muted)]">智能工作台</div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="收起侧边栏"
                  onClick={onToggle}
                  className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <CaretDoubleLeft className="size-3.5" weight="bold" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">收起侧边栏</TooltipContent>
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
          "mt-1 h-8 w-full justify-start rounded-[8px] border-black/[0.075] bg-white/30 px-2 text-[12px] font-semibold shadow-none hover:bg-white/70",
          collapsed && "justify-center px-0",
        )}
      >
        <PlusCircle className="size-[16px]" weight="bold" />
        <span className="sidebar-label">新建任务</span>
      </Button>

      <nav aria-label="主导航" className="mt-2 space-y-px">
        {navigation.map((item) => {
          const selected = view === item.view
          const Icon = item.icon

          return (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              aria-current={selected ? "page" : undefined}
              onClick={() => onViewChange(item.view)}
              className={cn(
                "group flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[12px] font-medium outline-none transition-[background-color,color,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected
                  ? "bg-black/[0.045] text-[var(--ink)]"
                  : "text-[var(--ink-soft)] hover:bg-black/[0.035] hover:text-[var(--ink)]",
              )}
            >
              <Icon className={cn("size-[17px] shrink-0", item.color)} weight="fill" />
              <span className="sidebar-label truncate">{item.label}</span>
              {item.label === "更多" ? (
                <CaretRight className="sidebar-label ml-auto size-3 text-[var(--muted)]" />
              ) : null}
            </button>
          )
        })}
      </nav>

      <section className="mt-2.5" aria-label="工作空间">
        <div
          className={cn(
            "flex h-6 items-center px-2 text-[10px] font-medium text-[var(--muted)]",
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
                <PlusCircle className="size-3.5" />
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

      <section className="mt-2.5" aria-label="最近访问">
        <div className="px-2 text-[10px] font-medium text-[var(--muted)]">
          <span className="sidebar-label">最近</span>
        </div>
        <button
          type="button"
          className="mt-1 flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[11px] outline-none transition-colors hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Desktop className="size-[16px] shrink-0 text-[#89939d]" weight="fill" />
          <span className="sidebar-label truncate">Fouc 桌面端</span>
          <span className="sidebar-label ml-auto text-[9px] text-[var(--muted)]">2 小时前</span>
        </button>
      </section>

      <div className="mt-auto">
        <button
          type="button"
          aria-label="设置"
          aria-current={view === "settings" ? "page" : undefined}
          onClick={() => onViewChange("settings")}
          className={cn(
            "mb-1.5 flex h-[32px] w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[12px] font-medium outline-none transition-[background-color,color] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            view === "settings"
              ? "bg-black/[0.045] text-[var(--ink)]"
              : "text-[var(--ink-soft)] hover:bg-black/[0.035] hover:text-[var(--ink)]",
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
    </aside>
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
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-medium outline-none transition-colors hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <CaretRight className="sidebar-label size-3 text-[var(--muted)]" />
      <Icon className={cn("size-[16px] shrink-0", color)} weight="fill" />
      <span className="sidebar-label truncate">{label}</span>
    </button>
  )
}
