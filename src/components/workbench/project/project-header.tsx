"use client"

import Image from "next/image"
import {
  Circle,
  DotsThree,
  GearSix,
  SidebarSimple,
  Sparkle,
  Star,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { projectTabs, type ProjectTab } from "./project-data"

type ProjectHeaderProps = {
  tab: ProjectTab
  onTabChange: (tab: ProjectTab) => void
  favorited: boolean
  onFavoriteChange: (favorited: boolean) => void
  panelOpen: boolean
  onTogglePanel: () => void
}

export function ProjectHeader({
  tab,
  onTabChange,
  favorited,
  onFavoriteChange,
  panelOpen,
  onTogglePanel,
}: ProjectHeaderProps) {
  return (
    <header className="shrink-0 bg-panel px-5 pt-[14px] max-[900px]:px-4">
      <div className="flex min-h-[68px] items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-[22px] font-semibold leading-7 tracking-[-0.035em] text-[var(--ink)]">
              Fouc 桌面端 V1
            </h1>
            <button
              type="button"
              aria-label={favorited ? "取消收藏项目" : "收藏项目"}
              aria-pressed={favorited}
              onClick={() => onFavoriteChange(!favorited)}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-[7px] outline-none transition-[background-color,color,transform] hover:bg-wash focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
                favorited ? "text-[#d79a3b]" : "text-[var(--muted-strong)] hover:text-[var(--ink-soft)]",
              )}
            >
              <Star className="size-[18px]" weight={favorited ? "fill" : "regular"} />
            </button>
          </div>

          <div className="mt-2 flex h-7 items-center gap-4 text-[10.5px] text-[var(--muted-strong)]">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Circle className="size-[11px] text-[#68748a]" weight="fill" />
              <span>当前运行中任务</span>
              <span className="font-semibold text-[var(--ink-soft)]">3</span>
            </span>
            <span aria-hidden className="h-4 w-px bg-[var(--line)]" />
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="flex -space-x-1.5">
                <Image src="/avatars/lin-mo.png" alt="林默" width={22} height={22} className="size-[22px] rounded-full border-2 border-panel object-cover" />
                <Image src="/avatars/zhou-xin.png" alt="周欣" width={22} height={22} className="size-[22px] rounded-full border-2 border-panel object-cover" />
              </span>
              <span>所有者</span>
              <span className="font-semibold text-[var(--ink-soft)]">林默</span>
            </span>
            <span aria-hidden className="h-4 w-px bg-[var(--line)]" />
            <button
              type="button"
              className="flex h-7 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-3 text-[10px] outline-none transition-[border-color,background-color] hover:border-[var(--line-strong)] hover:bg-panel focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="flex size-[18px] items-center justify-center rounded-full bg-[#7977d7] text-white">
                <Sparkle className="size-2.5" weight="fill" />
              </span>
              <span>Agent&nbsp; Nova · Sage</span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={panelOpen ? "收起右侧面板" : "展开右侧面板"}
            aria-pressed={panelOpen}
            onClick={onTogglePanel}
            className={cn(
              "flex size-9 items-center justify-center rounded-[8px] text-[#566888] outline-none transition-[background-color,color,transform] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-95",
              panelOpen ? "bg-[#f4f4f5]" : "bg-transparent hover:bg-[#f4f4f5]",
            )}
          >
            <SidebarSimple className="size-[18px]" weight="regular" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="更多项目操作"
                className="flex size-9 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[#f4f4f5] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <DotsThree className="size-[18px]" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><GearSix />项目设置</DropdownMenuItem>
              <DropdownMenuItem>复制项目链接</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[var(--err-ink)]">归档项目</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav role="tablist" aria-label="项目分区" className="mt-1.5 flex h-10 w-fit max-w-full items-end gap-10 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {projectTabs.map((item) => {
          const selected = item.id === tab

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "relative flex h-10 shrink-0 items-end pb-1.5 text-[13px] font-semibold outline-none transition-colors after:absolute after:-inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-[var(--accent)] after:transition-transform focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                selected
                  ? "text-[var(--ink)] after:scale-x-100"
                  : "text-[var(--muted-strong)] after:scale-x-0 hover:text-[var(--ink-soft)]",
              )}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
