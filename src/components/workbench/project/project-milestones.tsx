"use client"

import { useState } from "react"
import {
  ArrowRight,
  CheckCircle,
  Circle,
  CircleNotch,
  Record,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

type MilestoneStatus = "done" | "active" | "upcoming"

const milestones = [
  { id: "M1", label: "需求澄清", status: "done", statusLabel: "完成" },
  { id: "M2", label: "架构与设计", status: "active", statusLabel: "进行中" },
  { id: "M3", label: "核心开发", status: "upcoming", statusLabel: "未开始" },
  { id: "M4", label: "测试与验证", status: "upcoming", statusLabel: "未开始" },
  { id: "M5", label: "发布准备", status: "upcoming", statusLabel: "未开始" },
  { id: "M6", label: "正式发布", status: "upcoming", statusLabel: "未开始" },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  status: MilestoneStatus
  statusLabel: string
}>

const statusStyles: Record<MilestoneStatus, string> = {
  done: "text-[#418ac5]",
  active: "text-[#418ac5]",
  upcoming: "text-[#a3adb8]",
}

export function ProjectMilestones() {
  const [selectedId, setSelectedId] = useState("M2")
  const [expanded, setExpanded] = useState(false)

  const selected = milestones.find((milestone) => milestone.id === selectedId) ?? milestones[1]

  return (
    <section aria-labelledby="milestone-title">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="milestone-title" className="text-[13px] font-semibold text-[var(--ink)]">里程碑进度</h2>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className="flex h-6 items-center gap-1 text-[10px] text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {expanded ? "收起里程碑" : "查看全部里程碑"}
          <ArrowRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
        </button>
      </div>

      <div className="overflow-x-auto rounded-[8px] border border-[var(--line)] bg-panel px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative grid h-[100px] min-w-[620px] grid-cols-6">
          <span aria-hidden className="absolute left-[8.333%] right-[8.333%] top-[49px] h-px bg-[var(--line-strong)]" />

          {milestones.map((milestone) => (
            <button
              key={milestone.id}
              type="button"
              aria-pressed={selectedId === milestone.id}
              onClick={() => setSelectedId(milestone.id)}
              className="group relative z-10 grid grid-rows-[34px_24px_28px] justify-items-start px-3 pt-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="whitespace-nowrap text-[11px] font-medium text-[var(--ink-soft)]">
                <span className="mr-2 text-[var(--muted-strong)]">{milestone.id}</span>
                {milestone.label}
              </span>

              <span className="flex h-6 w-full items-center">
                <MilestoneMarker status={milestone.status} />
              </span>

              <span className={cn("flex items-center gap-1.5 whitespace-nowrap text-[10px]", statusStyles[milestone.status])}>
                <MilestoneStatusIcon status={milestone.status} />
                {milestone.statusLabel}
              </span>
            </button>
          ))}
        </div>

        {expanded ? (
          <div className="mb-3 flex items-center justify-between gap-4 rounded-[6px] bg-[var(--surface-subtle)] px-3 py-2 text-[10px] animate-in fade-in-0 slide-in-from-top-1">
            <span className="font-medium text-[var(--ink-soft)]">{selected.id} · {selected.label}</span>
            <span className={statusStyles[selected.status]}>{selected.statusLabel}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function MilestoneMarker({ status }: { status: MilestoneStatus }) {
  if (status === "done") return <Circle className="size-[11px] text-[#418ac5]" weight="fill" />
  if (status === "active") return <Record className="size-[17px] text-[#418ac5]" weight="regular" />
  return <Circle className="size-[16px] bg-panel text-[#bdc5cd]" weight="regular" />
}

function MilestoneStatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === "done") return <CheckCircle className="size-[12px]" weight="bold" />
  if (status === "active") return <CircleNotch className="size-[12px]" weight="bold" />
  return <Circle className="size-[12px]" weight="regular" />
}
