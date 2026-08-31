"use client"

import Image from "next/image"
import {
  ArrowLeft,
  CopySimple,
  Minus,
  Question,
  Square,
  X,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { performWindowAction } from "@/lib/tauri-window"
import { cn } from "@/lib/utils"

const menuGroups = {
  "编辑(E)": ["撤销", "重做", "剪切", "复制", "粘贴"],
  "窗口(W)": ["最小化", "切换全屏", "重新加载界面"],
  "帮助(H)": ["快捷键", "产品文档", "关于 Fouc"],
}

export function TitleBar({
  settings = false,
  onBack,
}: {
  settings?: boolean
  onBack?: () => void
}) {
  if (settings) {
    return <SettingsTitleBar onBack={onBack} />
  }

  return (
    <header
      data-tauri-drag-region
      className="relative z-40 flex h-[38px] shrink-0 select-none items-center bg-[var(--shell)] px-3 text-[11px] text-[var(--ink)]"
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1"
      >
        <div
          data-tauri-drag-region
          className="mr-2 flex items-center gap-1 font-medium"
        >
          <span className="relative size-5 shrink-0 overflow-hidden">
            <Image
              src="/brand/fouc-mark.png"
              alt=""
              fill
              sizes="20px"
              draggable={false}
              className="scale-[1.6] object-contain"
            />
          </span>
          <span data-tauri-drag-region className="text-[12px]">
            Fouc
          </span>
        </div>

        {Object.entries(menuGroups).map(([label, items]) => (
          <DropdownMenu key={label}>
            <DropdownMenuTrigger asChild>
              <button
                data-tauri-drag-region="false"
                className="h-6 rounded-md px-2 text-[11px] outline-none transition-colors hover:bg-black/[0.045] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {label}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {items.map((item, index) => (
                <div key={item}>
                  {index === 2 && label === "帮助(H)" ? (
                    <DropdownMenuSeparator />
                  ) : null}
                  <DropdownMenuItem>
                    {label === "帮助(H)" && index === 1 ? (
                      <Question weight="fill" />
                    ) : null}
                    {item}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

      <div className="ml-auto flex h-[38px] items-stretch">
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
    </header>
  )
}

function SettingsTitleBar({ onBack }: { onBack?: () => void }) {
  return (
    <header
      data-tauri-drag-region
      className="relative z-40 flex h-[44px] shrink-0 select-none items-center border-b border-black/[0.075] bg-white pl-4 text-[12px] text-[var(--ink)]"
    >
      <button
        data-tauri-drag-region="false"
        type="button"
        aria-label="返回工作台"
        onClick={onBack}
        className="flex size-8 items-center justify-center rounded-[7px] text-[#6f7478] outline-none transition-colors hover:bg-black/[0.045] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <ArrowLeft className="size-[17px]" weight="bold" aria-hidden />
      </button>
      <span className="mx-[14px] h-5 w-px bg-black/[0.09]" aria-hidden />
      <span data-tauri-drag-region className="font-semibold tracking-[-0.01em]">
        设置
      </span>
      <span data-tauri-drag-region className="ml-2 font-mono text-[10px] text-[#a0a5a9]">
        v0.1.0
      </span>

      <div className="ml-auto flex h-[44px] items-stretch">
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
    </header>
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
  icon: typeof CopySimple
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
        "flex w-[40px] items-center justify-center text-[var(--ink)] outline-none transition-colors focus-visible:bg-black/[0.07]",
        danger ? "hover:bg-[#e5484d] hover:text-white" : "hover:bg-black/[0.055]",
      )}
    >
      <Icon className={cn("size-[15px]", iconClassName)} />
    </button>
  )
}
