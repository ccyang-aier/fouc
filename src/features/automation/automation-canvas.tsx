"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowsDownUp, CaretDown, CheckCircle, Clock, Funnel, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { AutomationDetailPanel } from "./automation-detail-panel"
import { type AutomationDefinition, type AutomationStatus, initialAutomations, runRecords } from "./automation-data"
import { AutomationHeader, type AutomationTab } from "./automation-header"
import { AutomationTable, RunRecordsTable } from "./automation-table"

type Filter = "all" | "enabled" | "paused"
type Sort = "default" | "recent" | "name"

export function AutomationCanvas() {
  const [tab, setTab] = useState<AutomationTab>("automations")
  const [automations, setAutomations] = useState(initialAutomations)
  const [selectedId, setSelectedId] = useState<string | null>("AUTO-001")
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [workspace, setWorkspace] = useState("全部空间")
  const [sort, setSort] = useState<Sort>("default")
  const [query, setQuery] = useState("")
  const [runningId, setRunningId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = automations.find((item) => item.id === selectedId) ?? null
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN")
    const result = automations.filter((item) => {
      const enabledMatch = filter === "all" || (filter === "enabled" ? item.enabled : !item.enabled)
      const workspaceMatch = workspace === "全部空间" || item.workspace === workspace
      const searchMatch = !normalized || `${item.title} ${item.agent} ${item.workspace}`.toLocaleLowerCase("zh-CN").includes(normalized)
      return enabledMatch && workspaceMatch && searchMatch
    })
    if (sort === "name") return [...result].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"))
    if (sort === "recent") return [...result].sort((a, b) => a.lastRun.localeCompare(b.lastRun, "zh-CN"))
    return result
  }, [automations, filter, query, sort, workspace])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function openItem(id: string) {
    setCreating(false)
    setSelectedId(id)
  }

  function updateSelected(patch: Partial<AutomationDefinition>) {
    if (!selectedId) return
    setAutomations((items) => items.map((item) => item.id === selectedId ? { ...item, ...patch } : item))
  }

  function runAutomation(id: string) {
    const item = automations.find((automation) => automation.id === id)
    if (!item) return
    setRunningId(id)
    window.setTimeout(() => {
      setAutomations((items) => items.map((automation) => automation.id === id ? { ...automation, enabled: true, status: "running" as AutomationStatus, lastRun: "刚刚", lastRunDetail: "正在启动" } : automation))
      setRunningId(null)
      notify(`${item.title} 已开始运行`)
    }, 700)
  }

  const detailVisible = tab === "automations" && (selected !== null || creating)

  return (
    <section aria-label="自动化" className="relative flex h-full min-h-0 bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <AutomationHeader tab={tab} onTabChange={(next) => { setTab(next); if (next === "runs") setCreating(false) }} onCreate={() => { setTab("automations"); setCreating(true); setSelectedId(null) }} />

        <OperationalStrip onRunning={() => openItem("AUTO-002")} onNext={() => openItem("AUTO-001")} onAttention={() => openItem("AUTO-003")} />

        <AutomationToolbar
          tab={tab}
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          searchRef={searchRef}
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          sort={sort}
          onSortChange={setSort}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-panel px-3 pt-[10px]">
          <div className="min-h-full overflow-hidden rounded-t-[8px] border border-b-0 border-[var(--line)] bg-panel">
            {tab === "automations" ? <AutomationTable items={filtered} selectedId={selectedId} onSelect={openItem} /> : <RunRecordsTable records={runRecords} />}
          </div>
        </div>

        <footer className="flex h-10 shrink-0 items-center border-t border-[var(--line)] px-5 text-[9.5px] text-[var(--muted)]">
          {tab === "automations" ? `共 ${filtered.length} 个自动化` : `共 ${runRecords.length} 条运行记录`}
          <span className="ml-auto">数据仅保留于当前设备</span>
        </footer>
      </div>

      {detailVisible ? (
        <>
          <button type="button" aria-label="关闭自动化详情" onClick={() => { setSelectedId(null); setCreating(false) }} className="modal-backdrop absolute inset-0 z-20 hidden max-[1060px]:block" />
          <AutomationDetailPanel
            item={selected}
            creating={creating}
            running={runningId === selected?.id}
            onClose={() => { setSelectedId(null); setCreating(false) }}
            onToggle={(enabled) => { updateSelected({ enabled, status: enabled ? "enabled" : "paused" }); notify(enabled ? "自动化已启用" : "自动化已暂停") }}
            onRun={() => selected && runAutomation(selected.id)}
            onSave={() => notify("更改已保存")}
            onCreate={(draft) => {
              const id = `AUTO-${String(automations.length + 1).padStart(3, "0")}`
              const created: AutomationDefinition = { id, title: draft.title.trim(), description: draft.instruction.trim(), schedule: draft.schedule, timezone: draft.schedule === "有新内容时" ? "事件触发" : "Asia/Shanghai (UTC+08:00)", agent: draft.agent, agentInitial: draft.agent.slice(0, 1), workspace: draft.workspace, workspaceShort: draft.workspace === "产品研发" ? "PR" : draft.workspace === "客户成功" ? "CS" : "ME", lastRun: "尚未运行", lastRunDetail: "—", status: "enabled", enabled: true, notification: "失败时通知", timeout: "30 分钟" }
              setAutomations((items) => [created, ...items])
              setCreating(false)
              setSelectedId(id)
              setFilter("all")
              notify(`${created.title} 已创建`)
            }}
          />
        </>
      ) : null}

      <div role="status" aria-live="polite" className={cn("pointer-events-none absolute right-4 bottom-4 z-40 flex translate-y-2 items-center gap-2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--elevated)] px-3 py-2 text-[9.5px] font-medium text-[var(--ink)] opacity-0 shadow-[0_8px_24px_rgba(28,33,42,0.10)] transition-[opacity,transform]", toast && "translate-y-0 opacity-100")}><CheckCircle className="size-3.5 text-[#318b61]" weight="fill" />{toast}</div>
    </section>
  )
}

function OperationalStrip({ onRunning, onNext, onAttention }: { onRunning: () => void; onNext: () => void; onAttention: () => void }) {
  return (
    <section aria-label="当前运行状态" className="grid h-[44px] shrink-0 grid-cols-[1fr_1.15fr_.86fr] divide-x divide-[var(--line)] border-y border-[var(--line)] bg-[#fafbfc] max-[850px]:grid-cols-2">
      <button type="button" onClick={onRunning} className="group relative flex min-w-0 items-center gap-3 px-5 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"><span className="text-[9px] text-[var(--muted)]">正在运行</span><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[var(--ink-soft)]">项目风险巡检</span><span className="text-[9px] tabular-nums text-[#4d6fa7]">63%</span><span aria-hidden className="absolute inset-x-5 bottom-0 h-[2px] overflow-hidden rounded-full bg-[#dfe4ec]"><span className="block h-full w-[63%] bg-[#5577ae] transition-[width] group-hover:w-[67%]" /></span></button>
      <button type="button" onClick={onNext} className="flex min-w-0 items-center gap-3 px-5 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] max-[850px]:hidden"><Clock className="size-3.5 shrink-0 text-[var(--muted-strong)]" /><span className="text-[9px] text-[var(--muted)]">下一次</span><span className="truncate text-[10px] text-[var(--ink-soft)]">每日工作简报 · 明天 08:30</span></button>
      <button type="button" onClick={onAttention} className="flex items-center gap-2 px-5 text-left text-[10px] font-medium text-[var(--warn-ink)] outline-none transition-colors hover:bg-[var(--warn-soft)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"><WarningCircle className="size-3.5 shrink-0" /><span className="truncate">1 项需要处理</span><span className="ml-auto text-[9px]">查看</span></button>
    </section>
  )
}

function AutomationToolbar({ tab, filter, onFilterChange, query, onQueryChange, searchRef, workspace, onWorkspaceChange, sort, onSortChange }: { tab: AutomationTab; filter: Filter; onFilterChange: (filter: Filter) => void; query: string; onQueryChange: (query: string) => void; searchRef: React.RefObject<HTMLInputElement | null>; workspace: string; onWorkspaceChange: (workspace: string) => void; sort: Sort; onSortChange: (sort: Sort) => void }) {
  const filterOptions = [{ id: "all" as const, label: "全部", count: 4 }, { id: "enabled" as const, label: "已启用", count: 3 }, { id: "paused" as const, label: "已暂停", count: 1 }]
  return (
    <div className="flex h-[58px] shrink-0 items-center gap-3 px-5">
      {tab === "automations" ? <div role="tablist" aria-label="自动化状态" className="flex h-9 shrink-0 items-center overflow-hidden rounded-[7px] border border-[var(--line)] bg-panel">{filterOptions.map((option) => <button key={option.id} type="button" role="tab" aria-selected={filter === option.id} onClick={() => onFilterChange(option.id)} className={cn("flex h-full items-center gap-2 border-l border-[var(--line)] px-3 text-[10.5px] font-medium outline-none transition-colors first:border-l-0 hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]", filter === option.id ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--muted-strong)]")}><span>{option.label}</span><span className="text-[9px] opacity-65">{option.count}</span></button>)}</div> : <span className="text-[10.5px] font-medium text-[var(--ink-soft)]">最近 7 天</span>}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        <label className="flex h-9 w-[282px] items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10px] text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] max-[1380px]:w-[160px]"><MagnifyingGlass className="size-4 shrink-0" /><input ref={searchRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} aria-label="搜索自动化" placeholder="搜索名称 / Agent / 空间" className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" /><kbd className="whitespace-nowrap font-sans text-[9px] text-[var(--muted)] max-[1380px]:hidden">Ctrl K</kbd></label>
        {tab === "automations" ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="筛选" className={cn("flex h-9 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", workspace !== "全部空间" && "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]")}><Funnel className="size-4" /><span className="max-[1380px]:hidden">筛选</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuLabel>工作空间</DropdownMenuLabel><DropdownMenuSeparator />{["全部空间", "产品研发", "客户成功"].map((option) => <DropdownMenuCheckboxItem key={option} checked={workspace === option} onCheckedChange={() => onWorkspaceChange(option)}>{option}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu> : null}
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="排序" className="flex h-9 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><ArrowsDownUp className="size-4" /><span className="max-[1380px]:hidden">排序</span><CaretDown className="size-3 max-[1380px]:hidden" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-36"><DropdownMenuLabel>排序方式</DropdownMenuLabel><DropdownMenuSeparator />{([{ id: "default", label: "默认顺序" }, { id: "recent", label: "最近运行" }, { id: "name", label: "名称" }] as const).map((option) => <DropdownMenuCheckboxItem key={option.id} checked={sort === option.id} onCheckedChange={() => onSortChange(option.id)}>{option.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu>
      </div>
    </div>
  )
}
