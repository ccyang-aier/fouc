"use client"

/**
 * 一级工作区轨道（双层侧栏第一层，紧凑 48px）：
 * 空间菜单（省略号下拉）/ 新建工作空间 / 置顶空间瓦片 / 底部全部项目入口。
 */

import { useEffect, useRef, useState } from "react"
import {
  Check,
  DotsThree,
  PencilSimple,
  Plus,
  PushPinSlash,
  SquaresFour,
  Trash,
  X,
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

import type { WorkbenchView } from "./navigation-sidebar"

type RailSpace = { id: string; label: string; pinned: boolean }
type SpaceMenuState = {
  spaceId: string
  x: number
  y: number
  mode: "menu" | "rename" | "delete"
}

const DEFAULT_SPACES: RailSpace[] = [
  { id: "product-development", label: "产品研发", pinned: true },
  { id: "personal-workspace", label: "个人工作台", pinned: true },
]

export function WorkspaceRail({
  view,
  onViewChange,
}: {
  view: WorkbenchView
  onViewChange: (view: WorkbenchView) => void
}) {
  const [spaces, setSpaces] = useState(DEFAULT_SPACES)
  const [activeSpaceId, setActiveSpaceId] = useState(DEFAULT_SPACES[0].id)
  const [spaceMenu, setSpaceMenu] = useState<SpaceMenuState | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [feedback, setFeedback] = useState("")
  const renameRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const menuSpace = spaceMenu ? spaces.find((space) => space.id === spaceMenu.spaceId) : undefined

  useEffect(() => {
    if (!spaceMenu) return
    const close = (event?: PointerEvent) => {
      if (event?.target instanceof Node && menuRef.current?.contains(event.target)) return
      setSpaceMenu(null)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
      if (spaceMenu.mode === "menu" && event.key === "F2") {
        event.preventDefault()
        setRenameValue(menuSpace?.label ?? "")
        setSpaceMenu((current) => current ? { ...current, mode: "rename" } : null)
      }
      if (spaceMenu.mode === "menu" && event.key === "Delete") {
        event.preventDefault()
        setSpaceMenu((current) => current ? { ...current, mode: "delete" } : null)
      }
    }
    document.addEventListener("pointerdown", close)
    window.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("pointerdown", close)
      window.removeEventListener("keydown", handleKey)
    }
  }, [menuSpace?.label, spaceMenu])

  useEffect(() => {
    if (spaceMenu?.mode !== "rename") return
    renameRef.current?.focus()
    renameRef.current?.select()
  }, [spaceMenu?.mode])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(""), 2200)
    return () => window.clearTimeout(timer)
  }, [feedback])

  function selectSpace(id: string) {
    setActiveSpaceId(id)
    if (view !== "projects") onViewChange("projects")
  }

  function createSpace() {
    const id = `space-${Date.now()}`
    const label = `新工作空间 ${spaces.length + 1}`
    setSpaces((items) => [...items, { id, label, pinned: true }])
    setActiveSpaceId(id)
    setFeedback(`已创建「${label}」`)
    onViewChange("projects")
  }

  function openSpaceMenu(event: React.MouseEvent, space: RailSpace) {
    event.preventDefault()
    setRenameValue(space.label)
    setSpaceMenu({
      spaceId: space.id,
      x: Math.min(event.clientX, window.innerWidth - 210),
      y: Math.min(event.clientY, window.innerHeight - 190),
      mode: "menu",
    })
  }

  function renameSpace() {
    if (!menuSpace || !renameValue.trim()) return
    const label = renameValue.trim()
    setSpaces((items) => items.map((space) => space.id === menuSpace.id ? { ...space, label } : space))
    setFeedback(`已重命名为「${label}」`)
    setSpaceMenu(null)
  }

  function unpinSpace() {
    if (!menuSpace) return
    setSpaces((items) => items.map((space) => space.id === menuSpace.id ? { ...space, pinned: false } : space))
    setFeedback(`已取消置顶「${menuSpace.label}」`)
    setSpaceMenu(null)
  }

  function deleteSpace() {
    if (!menuSpace) return
    const remaining = spaces.filter((space) => space.id !== menuSpace.id)
    setSpaces(remaining)
    if (activeSpaceId === menuSpace.id) setActiveSpaceId(remaining[0]?.id ?? "")
    setFeedback(`已删除「${menuSpace.label}」`)
    setSpaceMenu(null)
  }

  return (
    <aside
      aria-label="工作区入口"
      className="relative z-40 flex h-full w-12 shrink-0 flex-col items-center border-r border-[var(--wt-sidebar-edge)] bg-transparent py-3"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="打开空间菜单"
            className="grid size-8 place-items-center rounded-md text-[var(--muted-strong)] outline-none transition-colors hover:bg-sidebar-hover hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
            aria-label="新建工作空间"
            onClick={createSpace}
            className="mt-3 grid size-7 place-items-center rounded-md border border-[var(--line-strong)] bg-ink text-background outline-none transition-[background-color,transform] hover:bg-ink-secondary focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:scale-90"
          >
            <Plus aria-hidden className="size-4" weight="bold" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          新建工作空间
        </TooltipContent>
      </Tooltip>

      <div className="relative z-10 mt-4 flex min-h-0 flex-col items-center gap-2 overflow-visible">
        {spaces.filter((space) => space.pinned).map((space) => (
          <Tooltip key={space.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`切换到${space.label}`}
                onClick={() => selectSpace(space.id)}
                onContextMenu={(event) => openSpaceMenu(event, space)}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md text-[12px] font-semibold text-white transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
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

      {feedback ? (
        <div
          role="status"
          className="overlay-surface absolute left-[42px] top-12 z-50 flex h-8 w-max items-center gap-2 rounded-[8px] border bg-elevated px-2.5 text-[10.5px] font-medium text-[var(--ink)] animate-in fade-in-0 slide-in-from-left-1"
        >
          <Check aria-hidden className="size-3.5 text-[var(--ok-ink)]" weight="bold" />
          {feedback}
        </div>
      ) : null}

      {spaceMenu && menuSpace ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${menuSpace.label}操作`}
          onPointerDown={(event) => event.stopPropagation()}
          style={{ left: spaceMenu.x, top: spaceMenu.y }}
          className="overlay-surface fixed z-50 w-48 overflow-hidden rounded-[10px] border bg-elevated p-1.5 text-[11.5px] text-[var(--ink)] animate-in fade-in-0 zoom-in-95"
        >
          {spaceMenu.mode === "rename" ? (
            <form
              className="p-1.5"
              onSubmit={(event) => {
                event.preventDefault()
                renameSpace()
              }}
            >
              <label className="text-[10px] font-medium text-[var(--muted)]" htmlFor="workspace-rename">工作空间名称</label>
              <input
                ref={renameRef}
                id="workspace-rename"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className="mt-2 h-8 w-full rounded-[6px] border border-[var(--line)] bg-panel px-2 text-[11px] outline-none focus:border-[var(--accent)]"
              />
              <div className="mt-2 flex justify-end gap-1.5">
                <MenuAction label="取消" icon={X} onClick={() => setSpaceMenu(null)} compact />
                <MenuAction label="保存" icon={Check} onClick={renameSpace} compact primary />
              </div>
            </form>
          ) : spaceMenu.mode === "delete" ? (
            <div className="p-2">
              <p className="font-semibold">删除「{menuSpace.label}」？</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">该操作会从当前工作区列表移除它。</p>
              <div className="mt-3 flex justify-end gap-1.5">
                <MenuAction label="取消" icon={X} onClick={() => setSpaceMenu(null)} compact />
                <MenuAction label="删除" icon={Trash} onClick={deleteSpace} compact danger />
              </div>
            </div>
          ) : (
            <>
              <div className="px-2.5 py-2">
                <p className="truncate font-semibold">{menuSpace.label}</p>
                <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">工作空间快捷操作</p>
              </div>
              <div className="my-1 h-px bg-[var(--line)]" />
              <MenuAction
                label="重命名"
                shortcut="F2"
                icon={PencilSimple}
                onClick={() => setSpaceMenu((current) => current ? { ...current, mode: "rename" } : null)}
              />
              <MenuAction label="取消置顶" icon={PushPinSlash} onClick={unpinSpace} />
              <div className="my-1 h-px bg-[var(--line)]" />
              <MenuAction
                label="删除"
                shortcut="Del"
                icon={Trash}
                onClick={() => setSpaceMenu((current) => current ? { ...current, mode: "delete" } : null)}
                danger
              />
            </>
          )}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-2 border-t border-[var(--wt-sidebar-edge)] pt-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="全部项目"
              onClick={() => onViewChange("projects")}
              className="grid size-8 place-items-center rounded-md text-[var(--muted-strong)] outline-none transition-colors hover:bg-sidebar-hover hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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

function MenuAction({
  label,
  icon: Icon,
  onClick,
  shortcut,
  compact = false,
  primary = false,
  danger = false,
}: {
  label: string
  icon: typeof X
  onClick: () => void
  shortcut?: string
  compact?: boolean
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role={compact ? undefined : "menuitem"}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-[6px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        compact ? "h-7 px-2 text-[10.5px]" : "h-8 w-full px-2.5",
        primary && "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
        danger && !primary && "text-[var(--err-ink)] hover:bg-[#fff2f1]",
        !primary && !danger && "hover:bg-wash",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span>{label}</span>
      {shortcut ? <kbd className="ml-auto font-sans text-[9px] text-[var(--muted)]">{shortcut}</kbd> : null}
    </button>
  )
}
