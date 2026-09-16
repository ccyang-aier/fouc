"use client"

import { CalendarDots, CaretRight, ChatCircleDots, ClockCounterClockwise, DotsThree, Folder, ShieldCheck } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import type { AutomationDefinition, AutomationStatus, RunRecord } from "./automation-data"

const rowIcons = [CalendarDots, ClockCounterClockwise, ChatCircleDots, CalendarDots]

const statusMeta: Record<AutomationStatus, { label: string; dot: string; text: string }> = {
  enabled: { label: "已启用", dot: "bg-[#2f9a69]", text: "text-[var(--ink-soft)]" },
  running: { label: "运行中", dot: "bg-[#3973c7]", text: "text-[#416ea9]" },
  attention: { label: "需要处理", dot: "bg-[#d0781b]", text: "text-[var(--warn-ink)]" },
  paused: { label: "已暂停", dot: "bg-[#9298a3]", text: "text-[var(--muted-strong)]" },
}

export function AutomationTable({ items, selectedId, onSelect }: { items: AutomationDefinition[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (items.length === 0) return <AutomationEmptyState />

  return (
    <div className="min-w-[720px] max-[1380px]:min-w-[650px]">
      <div className="grid h-10 grid-cols-[minmax(190px,1.5fr)_minmax(110px,.8fr)_90px_minmax(110px,.85fr)_minmax(160px,1fr)_94px_22px] items-center gap-3 border-b border-[var(--line)] bg-[#fafbfc] px-4 text-[9.5px] font-semibold text-[var(--muted)] max-[1380px]:grid-cols-[minmax(180px,1.4fr)_minmax(100px,.75fr)_82px_minmax(145px,1fr)_88px_20px]">
        <span>名称</span><span>触发条件</span><span>Agent</span><span className="max-[1380px]:hidden">工作空间</span><span>最近运行</span><span>状态</span><span />
      </div>
      <div role="list" aria-label="自动化列表" className="divide-y divide-[var(--line)] bg-panel">
        {items.map((item, index) => {
          const selected = selectedId === item.id
          const meta = statusMeta[item.status]
          const Icon = rowIcons[index % rowIcons.length]
          return (
            <button key={item.id} type="button" role="listitem" onClick={() => onSelect(item.id)} aria-current={selected ? "true" : undefined} className={cn("group relative grid h-[73px] w-full grid-cols-[minmax(190px,1.5fr)_minmax(110px,.8fr)_90px_minmax(110px,.85fr)_minmax(160px,1fr)_94px_22px] items-center gap-3 px-4 text-left outline-none transition-[background-color,box-shadow] duration-150 hover:bg-[#fafbfc] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] max-[1380px]:grid-cols-[minmax(180px,1.4fr)_minmax(100px,.75fr)_82px_minmax(145px,1fr)_88px_20px]", selected && "bg-[color-mix(in_srgb,var(--accent-soft)_48%,var(--panel))] shadow-[inset_2px_0_0_var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent-soft)_62%,var(--panel))]")}>
              <span className="flex min-w-0 items-center gap-3">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[#647492] transition-colors", selected ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "bg-[#f1f3f6] group-hover:bg-[#eaedf2]")}><Icon className="size-4" weight={selected ? "fill" : "regular"} /></span>
                <span className="min-w-0"><span className={cn("block truncate text-[11px] tracking-[-0.01em] text-[var(--ink)]", selected ? "font-semibold" : "font-medium")}>{item.title}</span><span className="mt-1 block truncate font-mono text-[8.5px] text-[var(--muted)]">{item.id}</span></span>
              </span>
              <span className="truncate text-[10.5px] text-[var(--ink-soft)]">{item.schedule}</span>
              <span className="flex items-center gap-1.5 text-[10px] text-[var(--ink-soft)]"><span className="flex size-[18px] items-center justify-center rounded-full bg-[#e9edfa] text-[8px] font-semibold text-[#6077ad]">{item.agentInitial}</span>{item.agent}</span>
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--ink-soft)] max-[1380px]:hidden"><Folder className="size-3.5 shrink-0 text-[var(--muted)]" /><span className="truncate">{item.workspace}</span></span>
              <span className="min-w-0"><span className="flex items-center gap-1.5 truncate text-[10px] text-[var(--ink-soft)]"><span className={cn("size-1.5 shrink-0 rounded-full", item.status === "attention" ? "bg-[#d0781b]" : item.status === "running" ? "bg-[#3973c7]" : "bg-[#2f9a69]")} />{item.lastRun}<span className="text-[var(--muted)]">·</span>{item.lastRunDetail}</span>{item.status === "running" ? <span className="mt-2 block h-[2px] w-[92px] overflow-hidden rounded-full bg-[#e2e6ed]"><span className="block h-full w-[63%] rounded-full bg-[#5378b6]" /></span> : null}</span>
              <span className={cn("flex items-center gap-1.5 text-[10px] font-medium", meta.text)}><span className={cn("size-1.5 rounded-full", meta.dot)} />{meta.label}</span>
              <span className="relative flex size-6 items-center justify-center text-[var(--muted)]"><CaretRight className="size-3.5 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-0" /><DotsThree className="absolute size-3.5 translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" weight="bold" /></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RunRecordsTable({ records }: { records: RunRecord[] }) {
  return (
    <div className="min-w-[650px]">
      <div className="grid h-10 grid-cols-[100px_minmax(180px,1fr)_130px_100px_110px_minmax(180px,1.2fr)] items-center gap-3 border-b border-[var(--line)] bg-[#fafbfc] px-4 text-[9.5px] font-semibold text-[var(--muted)]"><span>运行 ID</span><span>自动化</span><span>开始时间</span><span>耗时</span><span>结果</span><span>摘要</span></div>
      <div className="divide-y divide-[var(--line)] bg-panel">
        {records.map((record) => (
          <div key={record.id} className="grid h-[58px] grid-cols-[100px_minmax(180px,1fr)_130px_100px_110px_minmax(180px,1.2fr)] items-center gap-3 px-4 text-[10px] transition-colors hover:bg-[#fafbfc]">
            <span className="font-mono text-[8.5px] text-[var(--muted)]">{record.id}</span><span className="font-medium text-[var(--ink)]">{record.automation}</span><span className="tabular-nums text-[var(--ink-soft)]">{record.startedAt}</span><span className="tabular-nums text-[var(--muted-strong)]">{record.duration}</span><span className={cn("flex items-center gap-1.5", record.result === "需要处理" ? "text-[var(--warn-ink)]" : record.result === "运行中" ? "text-[#416ea9]" : "text-[#2f8a61]")}><span className="size-1.5 rounded-full bg-current" />{record.result}</span><span className="truncate text-[var(--muted-strong)]">{record.summary}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AutomationEmptyState() {
  return (
    <div className="flex min-h-[330px] flex-col items-center justify-center text-center">
      <span className="flex size-10 items-center justify-center rounded-[9px] border border-[var(--line)] bg-panel text-[var(--muted-strong)]"><ShieldCheck className="size-[18px]" /></span>
      <h2 className="mt-3 text-[11px] font-semibold text-[var(--ink)]">没有匹配的自动化</h2>
      <p className="mt-1 text-[9.5px] text-[var(--muted)]">调整搜索或筛选条件后再试。</p>
    </div>
  )
}
