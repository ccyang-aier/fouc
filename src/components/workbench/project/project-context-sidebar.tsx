"use client"

import { useState } from "react"
import { ArrowRight, ArrowsClockwise, CaretRight, GearSix } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { contextGroups, freshnessItems } from "./project-data"

export function ProjectContextSidebar() {
  const [syncing, setSyncing] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)

  function sync(label: string) {
    setSyncing(label)
    window.setTimeout(() => setSyncing(null), 720)
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-[var(--line)] bg-panel max-[1120px]:hidden" aria-label="项目上下文">
      <div className="flex h-[72px] shrink-0 translate-y-1.5 items-center px-6">
        <h2 className="text-[13px] font-semibold">项目上下文</h2>
      </div>

      <div className="px-6">
        {contextGroups.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={selected === item.label}
            onClick={() => setSelected((value) => value === item.label ? null : item.label)}
            className={cn(
              "group grid h-[82px] w-full grid-cols-[38px_minmax(0,1fr)_20px_14px] items-center gap-3 border-b border-[var(--line)] text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
              selected === item.label ? "text-[var(--accent-ink)]" : "hover:text-[var(--accent-ink)]",
            )}
          >
            <span className={cn("flex size-[38px] items-center justify-center rounded-[9px] border border-[var(--line)] bg-panel text-[var(--muted-strong)] transition-colors", selected === item.label && "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]") }>
              <item.icon className="size-[20px]" weight="regular" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] font-semibold text-[var(--ink)]">{item.label}</span>
              <span className="mt-1 block truncate text-[9.5px] text-[var(--muted)]">{item.description}</span>
            </span>
            <span className="text-right text-[10px] text-[var(--muted-strong)]">{item.count}</span>
            <CaretRight className="size-3.5 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>

      <div className="mt-6 border-t border-[var(--line)] px-6 pt-6">
        <h3 className="text-[13px] font-semibold">上下文新鲜度</h3>
        <div className="mt-3">
          {freshnessItems.map((item) => (
            <div key={item.label} className="grid h-[64px] grid-cols-[30px_minmax(0,1fr)_30px] items-center gap-2">
              <item.icon className="size-[17px] text-[var(--muted-strong)]" />
              <div className="min-w-0">
                <p className="text-[10.5px] font-medium text-[var(--ink)]">{item.label}</p>
                <p className="mt-1 truncate text-[9.5px] text-[var(--muted)]">{syncing === item.label ? "正在同步…" : item.description}</p>
              </div>
              <button type="button" aria-label={`同步${item.label}`} onClick={() => sync(item.label)} className="flex size-7 items-center justify-center rounded-md text-[var(--muted-strong)] outline-none transition-colors hover:bg-wash hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <ArrowsClockwise className={cn("size-4", syncing === item.label && "animate-spin text-[var(--accent-ink)]")} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button type="button" aria-pressed={managing} onClick={() => setManaging((value) => !value)} className="mx-6 mt-2 flex h-9 items-center gap-2 border-t border-[var(--line)] pt-4 text-[10.5px] font-medium text-[var(--accent-ink)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
        <GearSix className="size-4" />{managing ? "退出管理模式" : "管理项目上下文"}<ArrowRight className={cn("ml-0.5 size-3.5 transition-transform", managing && "rotate-90")} />
      </button>
    </aside>
  )
}
