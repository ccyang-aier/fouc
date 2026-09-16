"use client"

import { ArrowDown, ArrowUp, CaretDown, FileText } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { outputStatusMeta, outputTypeMeta, workStatus, type OutputEntry, type OutputPerson, type WorkObjectStatus } from "./project-outputs-data"
import { WorkAssigneeAvatar } from "./work-assignee"

/** 与参考稿对齐的六列栅格：产物弹性列 + 五个量度列（比例取自参考稿实测列宽，随面板宽度等比伸缩） */
const GRID_COLS = "grid grid-cols-[minmax(320px,381fr)_125fr_139fr_116fr_121fr_126fr] items-center"

/** 工作对象分组（按工作对象视图） */
export type WorkObjectSection = {
  id: string
  title: string
  owner: OutputPerson
  status: WorkObjectStatus
  acceptance: number
  outputs: OutputEntry[]
}

/** 生命周期阶段分组（按生命周期视图） */
export type StageSection = {
  id: string
  title: string
  outputs: OutputEntry[]
}

export type OutputSection = WorkObjectSection | StageSection

type OutputsTableProps = {
  sections: OutputSection[]
  expandedIds: ReadonlySet<string>
  onToggleGroup: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  sortDesc: boolean
  onToggleSort: () => void
  emptyLabel: string
  unitLabel: string
}

export function OutputsTable({ sections, expandedIds, onToggleGroup, selectedId, onSelect, sortDesc, onToggleSort, emptyLabel, unitLabel }: OutputsTableProps) {
  return (
    <div className="min-w-[860px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-panel">
      <div className={cn(GRID_COLS, "h-10 border-b border-[var(--line)] text-[11px] text-[var(--muted-strong)]")}>
        <span className="pl-[29px]">产物</span>
        <span>类型</span>
        <span>状态</span>
        <span>版本</span>
        <span>验证</span>
        <button
          type="button"
          onClick={onToggleSort}
          aria-label={sortDesc ? "切换为按更新时间升序" : "切换为按更新时间降序"}
          className="flex items-center gap-1 rounded outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          更新时间
          {sortDesc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="flex h-[160px] items-center justify-center text-[12px] text-[var(--muted)]">{emptyLabel}</div>
      ) : (
        sections.map((section) => {
          const expanded = expandedIds.has(section.id)
          const isWorkObject = "owner" in section

          return (
            <section key={section.id} className="border-b border-[var(--line)] last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => onToggleGroup(section.id)}
                className={cn(GRID_COLS, "h-14 w-full text-left outline-none transition-colors hover:bg-[#fafbfc] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]")}
              >
                <span className="flex min-w-0 items-center">
                  <CaretDown className={cn("size-3.5 shrink-0 text-[var(--muted-strong)] transition-transform duration-200", !expanded && "-rotate-90")} />
                  {isWorkObject ? (
                    <>
                      <FileText className="ml-3 size-[17px] shrink-0 text-[#33497c]" />
                      <span className="ml-4 truncate text-[12.5px] font-medium text-[var(--ink)]">{section.id} · {section.title}</span>
                    </>
                  ) : (
                    <span className="ml-3 truncate text-[12.5px] font-medium text-[var(--ink)]">{section.title}</span>
                  )}
                </span>
                {isWorkObject ? (
                  <>
                    <span className="flex items-center gap-2 text-[12px] text-[var(--ink-soft)]">
                      <WorkAssigneeAvatar assignee={section.owner} />
                      {section.owner.name}
                    </span>
                    <span className="text-[12px]">{workStatus[section.status].label}</span>
                    <span className="text-[12px] text-[var(--ink-soft)]">验收 <span className="font-medium text-[var(--ink)]">{section.acceptance}%</span></span>
                  </>
                ) : (
                  <>
                    <span />
                    <span />
                    <span />
                  </>
                )}
                <span className="text-[12px] text-[var(--ink-soft)]">产物 <span className="font-medium text-[var(--ink)]">{section.outputs.length}</span> 个</span>
                <span />
              </button>

              {expanded ? (
                <div>
                  {section.outputs.map((output) => (
                    <OutputRow key={output.id} output={output} selected={selectedId === output.id} onSelect={onSelect} />
                  ))}
                </div>
              ) : null}
            </section>
          )
        })
      )}

      <div className="flex h-[46px] items-center justify-center border-t border-[var(--line)] text-[12px] text-[var(--muted-strong)]">
        共 {sections.length} 个{unitLabel}
      </div>
    </div>
  )
}

function OutputRow({ output, selected, onSelect }: { output: OutputEntry; selected: boolean; onSelect: (id: string) => void }) {
  const TypeIcon = outputTypeMeta[output.type].icon

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(output.id)}
      className={cn(
        GRID_COLS,
        "h-12 w-full pl-[44px] text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
        selected ? "bg-[#f1f4f9]" : "hover:bg-[#f7f9fc]",
      )}
    >
      <span className="flex min-w-0 items-center gap-[15px]">
        <TypeIcon className="size-[17px] shrink-0 text-[#4674ab]" />
        <span className={cn("truncate text-[12px] text-[var(--ink)]", selected && "font-medium")}>{output.name}</span>
      </span>
      <span className="text-[12px] text-[var(--muted-strong)]">{outputTypeMeta[output.type].label}</span>
      <span className="text-[12px] text-[var(--muted-strong)]">{outputStatusMeta[output.status].label}</span>
      <span className="text-[12px] text-[var(--ink)]">{output.version}</span>
      <span className={cn("text-[12px]", output.verification === null ? "text-[var(--muted)]" : "font-medium text-[var(--ink)]")}>
        {output.verification === null ? "—" : `${output.verification}%`}
      </span>
      <span className="text-[12px] text-[var(--muted-strong)]">{output.updated}</span>
    </button>
  )
}
