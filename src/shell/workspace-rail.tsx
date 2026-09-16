"use client"

/**
 * 一级工作区轨道（双层侧栏第一层，Kiln 式 58px）：
 * 空间菜单（省略号下拉）/ 新建任务（深色胶囊）/ 空间彩色瓦片 / 底部全部项目入口。
 */

import { useState } from "react"
import { DotsThree, Plus, SquaresFour } from "@phosphor-icons/react"

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

import type { WorkbenchView } from "./navigation-sidebar"

type RailSpace = { id: string; label: string }

const DEFAULT_SPACES: RailSpace[] = [
  { id: "product-development", label: "产品研发" },
  { id: "personal-workspace", label: "个人工作台" },
]

export function WorkspaceRail({
  view,
  onViewChange,
  onNewMission,
}: {
  view: WorkbenchView
  onViewChange: (view: WorkbenchView) => void
  onNewMission: () => void
}) {
  const [spaces, setSpaces] = useState(DEFAULT_SPACES)
  const [activeSpaceId, setActiveSpaceId] = useState(DEFAULT_SPACES[0].id)

  function selectSpace(id: string) {
    setActiveSpaceId(id)
    if (view !== "projects") onViewChange("projects")
  }

  function createSpace() {
    setSpaces((items) => [...items, { id: `space-${Date.now()}`, label: "未命名空间" }])
  }

  return (
    <aside
      aria-label="工作区入口"
      className="relative flex h-full w-[58px] shrink-0 flex-col items-center border-r border-[var(--wt-sidebar-edge)] bg-transparent py-4"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="打开空间菜单"
            className="grid size-9 place-items-center rounded-md text-[var(--muted-strong)] outline-none transition-colors hover:bg-sidebar-hover hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <DotsThree aria-hidden className="size-4" weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-48">
          <DropdownMenuLabel>空间</DropdownMenuLabel>
          {spaces.map((space) => (
            <DropdownMenuItem key={space.id} onSelect={() => selectSpace(space.id)}>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              {space.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={createSpace}>
            <Plus aria-hidden className="size-4" weight="bold" />
            新建空间
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="新建任务"
            onClick={onNewMission}
            className="mt-4 grid size-8 place-items-center rounded-md border border-[var(--line-strong)] bg-ink text-background outline-none transition-colors hover:bg-ink-secondary focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Plus aria-hidden className="size-5" weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          新建任务
        </TooltipContent>
      </Tooltip>

      <div className="relative z-10 mt-5 flex min-h-0 flex-col items-center gap-2 overflow-visible">
        {spaces.map((space) => (
          <Tooltip key={space.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`切换到${space.label}`}
                onClick={() => selectSpace(space.id)}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold text-white transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  activeSpaceId === space.id
                    ? "outline-2 outline-offset-2 outline-ink"
                    : "opacity-80 hover:scale-[1.03] hover:opacity-100",
                )}
                style={{ backgroundColor: "var(--accent)" }}
              >
                {space.label.slice(0, 1)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {space.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2 border-t border-[var(--wt-sidebar-edge)] pt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="全部项目"
              onClick={() => onViewChange("projects")}
              className="grid size-9 place-items-center rounded-md text-[var(--muted-strong)] outline-none transition-colors hover:bg-sidebar-hover hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <SquaresFour aria-hidden className="size-[18px]" weight="duotone" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            全部项目
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
