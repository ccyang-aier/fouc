"use client"

import { useEffect, useId, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  CircleNotch,
  FolderOpen,
  GearSix,
  PencilSimple,
  Plus,
  PushPinSlash,
  SquaresFour,
  Trash,
  WarningCircle,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useWorkspace } from "./workspace-provider"
import { DEFAULT_SPACE, type RailSpace } from "./workspace-store"

const WORKSPACE_COLORS = ["#5367D8", "#B36D50", "#408C7A", "#9465B6", "#AA8241", "#477EA8"] as const

type WorkspacePanel =
  | { mode: "directory" }
  | { mode: "manage" | "rename" | "delete"; spaceId: string }

type Feedback = { message: string; error?: boolean }

export type WorkspaceSwitcherProps = {
  compact?: boolean
  onSelected: () => void
  onCreated: () => void
  onOpenProjects: () => void
}

export function WorkspaceSwitcher({
  compact = false,
  onSelected,
  onCreated,
  onOpenProjects,
}: WorkspaceSwitcherProps) {
  const { spaces, activeSpace, updateSpaces, selectWorkspace, createWorkspace } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<WorkspacePanel>({ mode: "directory" })
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const space = panel.mode === "directory" ? undefined : spaces.find((item) => item.id === panel.spaceId)

  useEffect(() => {
    if (panel.mode === "rename" || panel.mode === "delete") return
    contentRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')?.focus()
  }, [panel])

  function showManagement(target: RailSpace) {
    if (target.id === DEFAULT_SPACE.id) return
    setFeedback(null)
    setPanel({ mode: "manage", spaceId: target.id })
  }

  async function createSpace() {
    if (creating) return
    setCreating(true)
    setFeedback(null)
    try {
      const label = await createWorkspace()
      setFeedback({ message: `已创建「${label}」` })
      onCreated()
    } catch {
      setFeedback({ message: "创建工作空间失败，请检查账户权限和服务状态后重试", error: true })
    } finally {
      setCreating(false)
    }
  }

  function finishManagement(message: string) {
    setPanel({ mode: "directory" })
    setFeedback({ message })
  }

  function renameSpace(label: string) {
    if (!space || space.id === DEFAULT_SPACE.id || space.kind !== "local") return
    updateSpaces((items) => items.map((item) => item.id === space.id ? { ...item, label } : item))
    finishManagement(`已重命名为「${label}」`)
  }

  function unpinSpace() {
    if (!space || space.id === DEFAULT_SPACE.id) return
    updateSpaces((items) => items.map((item) => item.id === space.id ? { ...item, pinned: false } : item))
    finishManagement(`已取消置顶「${space.label}」`)
  }

  function deleteSpace() {
    if (!space || space.id === DEFAULT_SPACE.id || space.kind !== "local") return
    const remaining = spaces.filter((item) => item.id !== space.id)
    if (!remaining.length) {
      setFeedback({ message: "请保留至少一个工作空间", error: true })
      return
    }
    updateSpaces(remaining)
    if (activeSpace.id === space.id) {
      selectWorkspace(remaining[0].id)
    }
    finishManagement(`已删除「${space.label}」`)
  }

  function showDirectory() {
    setPanel({ mode: "directory" })
    setFeedback(null)
  }

  return (
    <DropdownMenu open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (nextOpen) showDirectory()
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`切换或管理工作空间，当前为${activeSpace.label}`}
              className="grid size-[30px] shrink-0 place-items-center rounded-md text-[var(--muted-strong)] outline-none"
            >
              <SquaresFour aria-hidden className="size-[18px]" weight="regular" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side={compact ? "right" : "top"}>
          工作空间：{activeSpace.label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        ref={contentRef}
        side={compact ? "right" : "top"}
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-64 max-w-[calc(100vw-24px)] overflow-y-auto"
        onKeyDown={(event) => {
          if (panel.mode !== "manage" || !space || space.kind !== "local") return
          if (event.key === "F2" || event.key === "Delete") {
            event.preventDefault()
            setPanel({ mode: event.key === "F2" ? "rename" : "delete", spaceId: space.id })
          }
        }}
      >
        {panel.mode === "directory" || !space ? (
          <>
            <DropdownMenuLabel>工作空间</DropdownMenuLabel>
            {spaces.map((item, index) => (
              <DropdownMenuItem
                key={item.id}
                role="menuitemradio"
                aria-checked={activeSpace.id === item.id}
                textValue={item.label}
                className="h-auto min-h-8 py-2"
                onSelect={() => {
                  selectWorkspace(item.id)
                  onSelected()
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  showManagement(item)
                }}
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: WORKSPACE_COLORS[index % WORKSPACE_COLORS.length] }} />
                <span className="min-w-0 flex-1 break-words">{item.label}</span>
                {activeSpace.id === item.id ? <Check aria-hidden style={{ color: "var(--accent-ink)" }} weight="bold" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={creating} onSelect={(event) => {
              event.preventDefault()
              void createSpace()
            }}>
              {creating ? <CircleNotch aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
              {creating ? "正在创建…" : "新建工作空间"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={activeSpace.id === DEFAULT_SPACE.id} onSelect={(event) => {
              event.preventDefault()
              showManagement(activeSpace)
            }}>
              <GearSix aria-hidden />管理当前空间
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenProjects}>
              <FolderOpen aria-hidden />全部项目
            </DropdownMenuItem>
          </>
        ) : panel.mode === "rename" ? (
          <WorkspaceRenameForm space={space} onSave={renameSpace} onCancel={() => setPanel({ mode: "manage", spaceId: space.id })} />
        ) : panel.mode === "delete" ? (
          <WorkspaceDeletePanel space={space} onDelete={deleteSpace} onCancel={() => setPanel({ mode: "manage", spaceId: space.id })} />
        ) : (
          <>
            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              showDirectory()
            }}>
              <ArrowLeft aria-hidden />返回工作空间
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="break-words">{space.label}</DropdownMenuLabel>
            {space.kind === "local" ? (
              <DropdownMenuItem onSelect={(event) => {
                event.preventDefault()
                setPanel({ mode: "rename", spaceId: space.id })
              }}>
                <PencilSimple aria-hidden />重命名
                <kbd className="ml-auto text-[10px] text-[var(--muted)]">F2</kbd>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={!space.pinned} onSelect={(event) => {
              event.preventDefault()
              unpinSpace()
            }}>
              <PushPinSlash aria-hidden />取消置顶
            </DropdownMenuItem>
            {space.kind === "local" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={(event) => {
                  event.preventDefault()
                  setPanel({ mode: "delete", spaceId: space.id })
                }}>
                  <Trash aria-hidden />删除
                  <kbd className="ml-auto text-[10px]">Del</kbd>
                </DropdownMenuItem>
              </>
            ) : null}
          </>
        )}
        {feedback ? (
          <div
            role={feedback.error ? "alert" : "status"}
            className="flex items-start gap-2 border-t border-[var(--line)] px-2.5 py-2 text-[11px] leading-4"
          >
            {feedback.error
              ? <WarningCircle aria-hidden className="size-3.5 shrink-0 text-[var(--err-ink)]" />
              : <Check aria-hidden className="size-3.5 shrink-0 text-[var(--ok-ink)]" weight="bold" />}
            <span className={`min-w-0 flex-1 break-words ${feedback.error ? "text-[var(--err-ink)]" : "text-[var(--muted-strong)]"}`}>{feedback.message}</span>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkspaceRenameForm({ space, onSave, onCancel }: {
  space: RailSpace
  onSave: (label: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(space.label)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <form className="p-2" onKeyDown={(event) => {
      if (event.key !== "Escape") event.stopPropagation()
    }} onSubmit={(event) => {
      event.preventDefault()
      if (value.trim()) onSave(value.trim())
    }}>
      <label htmlFor={inputId} className="text-[11px] font-medium">工作空间名称</label>
      <input
        ref={inputRef}
        id={inputId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 h-[30px] w-full rounded-md border border-[var(--control-border)] bg-panel px-2 text-[12px] outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-3 flex justify-end gap-1.5">
        <Button type="button" variant="ghost" className="h-[30px] px-3 text-[11px]" onClick={onCancel}>取消</Button>
        <Button type="submit" disabled={!value.trim()} className="h-[30px] px-3 text-[11px]">保存</Button>
      </div>
    </form>
  )
}

function WorkspaceDeletePanel({ space, onDelete, onCancel }: {
  space: RailSpace
  onDelete: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { cancelRef.current?.focus() }, [])

  return (
    <div className="p-2" onKeyDown={(event) => {
      if (event.key !== "Escape") event.stopPropagation()
    }}>
      <p className="break-words font-semibold">删除「{space.label}」？</p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">该操作会从当前工作区列表移除它。</p>
      <div className="mt-3 flex justify-end gap-1.5">
        <Button ref={cancelRef} type="button" variant="ghost" className="h-[30px] px-3 text-[11px]" onClick={onCancel}>取消</Button>
        <button
          type="button"
          data-variant="destructive"
          onClick={onDelete}
          className="fouc-action inline-flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[11px] font-medium text-[var(--menu-danger-ink)] outline-none"
        >
          <Trash aria-hidden className="size-3.5" />删除
        </button>
      </div>
    </div>
  )
}
