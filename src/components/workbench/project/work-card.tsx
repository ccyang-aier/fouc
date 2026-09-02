"use client"

import { CircleNotch, Diamond, Target } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import type { WorkItem } from "./project-work-data"
import { WorkAssigneeAvatar } from "./work-assignee"

const priorityMeta = {
  low: { label: "低", className: "text-[#587db9]" },
  medium: { label: "中", className: "text-[#b66d26]" },
  high: { label: "高", className: "text-[#d94a4a]" },
} as const

export function WorkCard({ item, selected, onSelect, onDragStart }: { item: WorkItem; selected: boolean; onSelect: () => void; onDragStart: () => void }) {
  const priority = priorityMeta[item.priority]

  return (
    <article
      role="button"
      tabIndex={0}
      draggable
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", item.id)
        onDragStart()
      }}
      className={cn(
        "group cursor-grab rounded-[8px] border bg-panel px-3 py-3 outline-none transition-[border-color,box-shadow,transform] active:cursor-grabbing active:scale-[0.99]",
        selected
          ? "border-[#5f8ff7] shadow-[0_0_0_1px_rgba(95,143,247,0.12),0_7px_18px_rgba(66,103,175,0.09)]"
          : "border-[var(--line)] shadow-[0_1px_2px_rgba(30,35,45,0.025)] hover:-translate-y-px hover:border-[var(--line-strong)] hover:shadow-[0_7px_18px_rgba(36,41,50,0.07)]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[8.5px] font-medium tracking-[0.01em] text-[var(--muted)]">
        <Target className="size-3.5" />
        {item.id}
      </div>
      <h3 className="mt-3 min-h-9 text-[12.5px] font-medium leading-[1.45] tracking-[-0.01em] text-[var(--ink)]">{item.title}</h3>
      <div className="mt-3 flex items-center gap-2.5 text-[10px] text-[var(--muted-strong)]">
        <span className={cn("flex items-center gap-1 font-medium", priority.className)}><Diamond className="size-3" weight="fill" />{priority.label}</span>
        <span className="ml-auto flex items-center gap-1.5"><WorkAssigneeAvatar assignee={item.assignee} size="sm" /><span>{item.assignee.name}</span></span>
        <span className="flex items-center gap-1 whitespace-nowrap"><CircleNotch className={cn("size-5", item.completed === item.total ? "text-[#6f7e93]" : "text-[#3973e8]")} weight="bold" />{item.completed}/{item.total}</span>
      </div>
      <p className="mt-3 border-t border-[var(--line)] pt-2.5 text-[9.5px] text-[var(--muted)]">{item.updated}</p>
      {item.blocker ? (
        <div className="mt-2 flex w-fit max-w-full items-center gap-1 rounded-[4px] bg-[#fff0ef] px-2 py-1 text-[9px] font-medium text-[#d34b48]">
          <Target className="size-3 shrink-0" weight="fill" /><span className="truncate">阻塞：{item.blocker}</span>
        </div>
      ) : null}
    </article>
  )
}
