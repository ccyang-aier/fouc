"use client"

import { useState } from "react"
import { CaretRight, CheckCircle } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { HomeComposer } from "./home-composer"

export function HomeCanvas() {
  const [status, setStatus] = useState<string | null>(null)

  return (
    <ScrollArea
      as="section"
      aria-label="Fouc 首页"
      className="relative h-full min-h-0"
      viewportClassName="flex flex-col items-center bg-panel px-7 pt-[252px] max-[1180px]:pt-[176px] max-[760px]:px-4 max-[760px]:pt-[142px]"
    >
      <div className="w-full max-w-[880px] -translate-x-8 max-[1180px]:translate-x-0">
        <header className="text-center">
          <h1 className="text-[29px] leading-[1.2] font-semibold tracking-[-0.045em] text-[var(--ink)] max-[760px]:text-[25px]">
            今天想完成什么？
          </h1>
          <p className="mt-3 text-[12px] tracking-[-0.015em] text-[var(--muted-strong)]">
            从目标开始，与 Agent 在同一条工作流中协作。
          </p>
        </header>

        <div className="mt-[62px] max-[760px]:mt-[100px]">
          <HomeComposer onStatusChange={setStatus} />
        </div>

        <button
          type="button"
          className={cn(
            "mx-auto mt-10 flex h-8 items-center gap-2 rounded-[7px] px-3 text-[10.5px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            status && "text-accent-ink",
          )}
        >
          <CheckCircle className="size-[15px] text-[#438dcc]" weight={status ? "fill" : "regular"} />
          <span>{status ?? "2 个任务已完成 · 1 个任务等待审阅"}</span>
          <CaretRight className="size-3" />
        </button>
      </div>
    </ScrollArea>
  )
}
