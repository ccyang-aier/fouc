"use client"

import Image from "next/image"
import { useState } from "react"
import { CalendarBlank, CaretRight, DotsThree, GearSix, SidebarSimple } from "@phosphor-icons/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { ProjectActivity } from "./project-activity"
import { ProjectAttention } from "./project-attention"
import { ProjectComposer } from "./project-composer"
import { ProjectContextSidebar } from "./project-context-sidebar"
import { projectTabs, type ProjectTab } from "./project-data"
import { ProjectWorkCanvas } from "./project-work-canvas"

export function ProjectHomeCanvas() {
  const [tab, setTab] = useState<ProjectTab>("overview")
  const [contextOpen, setContextOpen] = useState(true)
  const showContext = contextOpen && tab === "overview"

  if (tab === "work") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-panel">
        <div className="mx-auto w-full max-w-[1080px] shrink-0 px-9 pt-[22px] max-[1100px]:px-6">
          <ProjectHeader onToggleContext={() => setContextOpen((value) => !value)} contextOpen={false} />
          <ProjectTabs value={tab} onChange={setTab} />
          <div className="h-[18px]" />
        </div>
        <ProjectWorkCanvas />
      </div>
    )
  }

  return (
    <div className={cn("grid h-full min-h-0", showContext ? "grid-cols-[minmax(0,1fr)_308px] max-[1160px]:grid-cols-[minmax(0,1fr)_272px] max-[1120px]:grid-cols-1" : "grid-cols-1")}>
      <ScrollArea
        as="section"
        aria-label="项目首页"
        className="min-h-0"
        viewportClassName="bg-panel"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[1080px] flex-col px-9 pb-6 pt-[22px] max-[1100px]:px-6">
          <ProjectHeader onToggleContext={() => setContextOpen((value) => !value)} contextOpen={contextOpen} />
          <ProjectTabs value={tab} onChange={setTab} />
          {tab === "overview" ? (
            <div className="mt-[22px] space-y-[18px]">
              <ProjectAttention />
              <ProjectActivity onOpenWork={() => setTab("work")} onOpenOutputs={() => setTab("outputs")} />
              <ProjectComposer />
            </div>
          ) : (
            <ProjectSectionPlaceholder
              tab={tab}
              onCreate={() => {
                setTab("overview")
                requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("[aria-label='任务描述']")?.focus())
              }}
            />
          )}
        </div>
      </ScrollArea>
      {showContext ? <ProjectContextSidebar onCollapse={() => setContextOpen(false)} /> : null}
    </div>
  )
}

function ProjectHeader({ onToggleContext, contextOpen }: { onToggleContext: () => void; contextOpen: boolean }) {
  return (
    <header>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10.5px] text-[var(--muted-strong)]">
          <button type="button" className="rounded outline-none hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">项目</button>
          <span className="text-[var(--muted)]">/</span>
          <span className="font-medium text-[var(--ink-soft)]">Fouc 桌面端 V1</span>
        </div>
        <div className="flex items-center gap-1">
          {!contextOpen ? (
            <button type="button" aria-label="展开项目上下文" onClick={onToggleContext} className="flex size-8 items-center justify-center rounded-md text-[var(--muted-strong)] outline-none hover:bg-wash hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><SidebarSimple className="size-[18px]" /></button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="更多项目操作" className="flex size-8 items-center justify-center rounded-md text-[var(--muted-strong)] outline-none hover:bg-wash hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><DotsThree className="size-[19px]" weight="bold" /></button>
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

      <h1 className="mt-[25px] text-[31px] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)]">Fouc 桌面端 V1</h1>
      <div className="mt-[17px] flex items-center gap-6 text-[10.5px] text-[var(--muted-strong)]">
        <span className="flex items-center gap-2"><Image src="/avatars/lin-mo.png" alt="林默" width={28} height={28} className="size-7 rounded-full object-cover" /><span className="font-medium">林默</span></span>
        <span className="flex items-center gap-1.5"><CalendarBlank className="size-[15px]" />目标日期<span>2026年10月</span></span>
        <button type="button" onClick={onToggleContext} className="flex items-center gap-1.5 rounded outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><GearSix className="size-[15px]" />项目控制中心</button>
      </div>
    </header>
  )
}

function ProjectTabs({ value, onChange }: { value: ProjectTab; onChange: (value: ProjectTab) => void }) {
  return (
    <div role="tablist" aria-label="项目分区" className="mt-5 grid h-[52px] grid-cols-5 overflow-hidden rounded-[28px] border border-[var(--line)] bg-panel p-[3px]">
      {projectTabs.map((item, index) => {
        const selected = item.id === value
        return (
          <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => onChange(item.id)} className={cn("relative flex min-w-0 items-center justify-center gap-2 rounded-[23px] text-[11.5px] font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", selected ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]")}>
            {index > 0 ? <span aria-hidden className="absolute -left-[2px] top-1/2 h-4 w-px -translate-y-1/2 bg-[var(--line)]" /> : null}
            <item.icon className="size-[19px]" weight={selected ? "fill" : "regular"} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ProjectSectionPlaceholder({ tab, onCreate }: { tab: ProjectTab; onCreate: () => void }) {
  const label = projectTabs.find((item) => item.id === tab)?.label ?? "项目"
  return (
    <section className="mt-8 flex min-h-[420px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-subtle)] text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)]"><CaretRight className="size-5" /></span>
      <h2 className="mt-4 text-[13px] font-semibold">{label}</h2>
      <p className="mt-1.5 text-[10.5px] text-[var(--muted)]">该分区已连接到项目上下文，内容将在后续任务中逐步沉淀。</p>
      <button type="button" onClick={onCreate} className="mt-4 rounded-[7px] border border-[var(--line)] bg-panel px-3 py-2 text-[10.5px] text-[var(--muted-strong)] outline-none hover:border-[var(--line-strong)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">创建{label}任务</button>
    </section>
  )
}
