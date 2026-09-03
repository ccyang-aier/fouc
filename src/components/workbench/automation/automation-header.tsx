"use client"

import { Circle, DotsThree, Plus } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type AutomationTab = "automations" | "runs"

export function AutomationHeader({ tab, onTabChange, onCreate }: { tab: AutomationTab; onTabChange: (tab: AutomationTab) => void; onCreate: () => void }) {
  return (
    <header className="shrink-0 bg-panel px-5 pt-[14px] max-[900px]:px-4">
      <div className="flex min-h-[68px] items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] leading-7 font-semibold tracking-[-0.035em] text-[var(--ink)]">自动化</h1>
          <div className="mt-2 flex h-7 items-center gap-2 text-[10.5px] text-[var(--muted-strong)]">
            <Circle className="size-[11px] text-[#59719d]" weight="fill" />
            <span>3 个已启用</span>
            <span aria-hidden className="text-[var(--muted)]">·</span>
            <span>今日运行 8 次</span>
            <span aria-hidden className="text-[var(--muted)]">·</span>
            <span className="text-[var(--warn-ink)]">1 个需要处理</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={onCreate} className="flex h-9 items-center gap-1.5 rounded-[7px] bg-[var(--accent)] px-3.5 text-[10.5px] font-semibold text-white outline-none transition-[background-color,transform,box-shadow] hover:-translate-y-px hover:bg-[var(--accent-strong)] hover:shadow-[0_5px_14px_color-mix(in_srgb,var(--accent)_20%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:translate-y-0">
            <Plus className="size-3.5" weight="bold" />新建自动化
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="更多自动化操作" className="flex size-9 items-center justify-center rounded-[8px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[#f4f4f5] hover:text-[var(--ink)] data-[state=open]:bg-[#f4f4f5] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <DotsThree className="size-[18px]" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>暂停全部</DropdownMenuItem>
              <DropdownMenuItem>导出运行记录</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>自动化设置</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav role="tablist" aria-label="自动化分区" className="mt-1.5 flex h-10 w-fit items-end gap-10">
        {([{ id: "automations", label: "自动化" }, { id: "runs", label: "运行记录" }] as const).map((item) => {
          const selected = tab === item.id
          return (
            <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => onTabChange(item.id)} className={cn("relative flex h-10 items-end pb-1.5 text-[13px] font-semibold outline-none transition-colors after:absolute after:-inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-[var(--accent)] after:transition-transform focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", selected ? "text-[var(--ink)] after:scale-x-100" : "text-[var(--muted-strong)] after:scale-x-0 hover:text-[var(--ink-soft)]")}>
              {item.label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
