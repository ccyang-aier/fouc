"use client"

/**
 * 系统底层行：位于双层侧栏右侧的主区顶部，与主导航 header 等高（44px）。
 * 整行充当窗口拖拽区，右端保留最小化 / 最大化 / 关闭控制。
 */

import { Minus, Square, X } from "@phosphor-icons/react"

import { performWindowAction } from "@/lib/tauri-window"
import { cn } from "@/lib/utils"

export function SystemBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex h-11 shrink-0 select-none items-center border-b border-[var(--wt-sidebar-glass-edge)] bg-panel"
    >
      <div className="ml-auto flex items-center gap-1 pr-1">
        <WindowControl
          label="最小化"
          icon={Minus}
          onClick={() => void performWindowAction("minimize")}
        />
        <WindowControl
          label="最大化或还原"
          icon={Square}
          onClick={() => void performWindowAction("toggleMaximize")}
          iconClassName="size-[13px]"
        />
        <WindowControl
          label="关闭"
          icon={X}
          onClick={() => void performWindowAction("close")}
          danger
        />
      </div>
    </div>
  )
}

function WindowControl({
  label,
  icon: Icon,
  onClick,
  danger,
  iconClassName,
}: {
  label: string
  icon: typeof Minus
  onClick: () => void
  danger?: boolean
  iconClassName?: string
}) {
  return (
    <button
      data-tauri-drag-region="false"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-[7px] text-[var(--ink)] outline-none transition-colors focus-visible:bg-wash",
        danger
          ? "hover:bg-[#f5e0de] hover:text-[#b8493f]"
          : "hover:bg-wash",
      )}
    >
      <Icon className={cn("size-[14px]", iconClassName)} />
    </button>
  )
}
