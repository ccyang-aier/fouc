"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDots,
  CheckCircle,
  CircleNotch,
  CirclesFour,
  Funnel,
  GitMerge,
  Kanban,
  ListBullets,
  MagnifyingGlass,
  Plus,
  SealWarning,
  SpinnerGap,
  Target,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { initialWorkItems, workStatusMeta, type WorkItem, type WorkPriority, type WorkStatus } from "./project-work-data"
import { WorkAssigneeAvatar } from "./work-assignee"
import { WorkCard } from "./work-card"
import { WorkDetailPanel } from "./work-detail-panel"

type WorkView = "list" | "board" | "timeline" | "dependencies"
type GroupBy = "status" | "assignee"

const viewOptions = [
  { id: "list", label: "列表", icon: ListBullets },
  { id: "board", label: "看板", icon: Kanban },
  { id: "timeline", label: "时间线", icon: CalendarDots },
  { id: "dependencies", label: "依赖图", icon: GitMerge },
] as const

export function ProjectWorkCanvas({ detailOpen, onDetailOpenChange }: { detailOpen: boolean; onDetailOpenChange: (open: boolean) => void }) {
  const [items, setItems] = useState<WorkItem[]>(initialWorkItems)
  const [view, setView] = useState<WorkView>("board")
  const [query, setQuery] = useState("")
  const [priority, setPriority] = useState<WorkPriority | "all">("all")
  const [groupBy, setGroupBy] = useState<GroupBy>("status")
  const [selectedId, setSelectedId] = useState("ISSUE-128")
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const filteredItems = useMemo(() => items.filter((item) => {
    const normalized = query.trim().toLocaleLowerCase()
    const matchesQuery = !normalized || `${item.id} ${item.title}`.toLocaleLowerCase().includes(normalized)
    return matchesQuery && (priority === "all" || item.priority === priority)
  }), [items, priority, query])

  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  function selectItem(id: string) {
    setSelectedId(id)
    onDetailOpenChange(true)
  }

  function updateItem(id: string, patch: Partial<WorkItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  function addGroupedItem(key: string) {
    const status = groupBy === "status" ? key as WorkStatus : "todo"
    const index = items.length + 142
    const assigneeName = groupBy === "assignee" ? key as WorkItem["assignee"]["name"] : "林默"
    const item: WorkItem = {
      id: `TASK-${index}`,
      title: "新建工作项",
      status,
      priority: "medium",
      assignee: { name: assigneeName, ...(assigneeName === "林默" ? { avatar: "/avatars/lin-mo.png" } : {}) },
      completed: 0,
      total: 3,
      updated: "刚刚创建",
    }
    setItems((current) => [...current, item])
    selectItem(item.id)
  }

  return (
    <section aria-label="项目工作" className="relative flex min-h-0 flex-1 bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkToolbar view={view} onViewChange={setView} query={query} onQueryChange={setQuery} priority={priority} onPriorityChange={setPriority} groupBy={groupBy} onGroupByChange={setGroupBy} />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-panel px-5 py-[11px]">
            {view === "board" ? (
              <WorkBoard items={filteredItems} groupBy={groupBy} showSourceTotals={query.trim() === "" && priority === "all"} selectedId={selectedId} draggingId={draggingId} onSelect={selectItem} onDragStart={setDraggingId} onDrop={(id, key) => {
                if (groupBy === "status") updateItem(id, { status: key as WorkStatus })
                else updateItem(id, { assignee: { name: key as WorkItem["assignee"]["name"], ...(key === "林默" ? { avatar: "/avatars/lin-mo.png" } : {}) } })
                setDraggingId(null)
              }} onAdd={addGroupedItem} />
            ) : view === "list" ? <WorkList items={filteredItems} selectedId={selectedId} onSelect={selectItem} /> : view === "timeline" ? <WorkTimeline items={filteredItems} onSelect={selectItem} /> : <WorkDependencies items={filteredItems} onSelect={selectItem} />}
        </div>
      </div>
      {detailOpen && selectedItem ? <WorkDetailPanel key={selectedItem.id} item={selectedItem} onClose={() => onDetailOpenChange(false)} onStatusChange={(status) => updateItem(selectedItem.id, { status })} /> : null}
    </section>
  )
}

function WorkToolbar({ view, onViewChange, query, onQueryChange, priority, onPriorityChange, groupBy, onGroupByChange }: { view: WorkView; onViewChange: (view: WorkView) => void; query: string; onQueryChange: (query: string) => void; priority: WorkPriority | "all"; onPriorityChange: (priority: WorkPriority | "all") => void; groupBy: GroupBy; onGroupByChange: (groupBy: GroupBy) => void }) {
  const searchRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="flex h-[58px] shrink-0 items-center gap-3 px-5">
      <div role="tablist" aria-label="工作视图" className="flex h-9 shrink-0 items-center overflow-hidden rounded-[7px] border border-[var(--line)] bg-panel">
        {viewOptions.map((option) => <button key={option.id} type="button" role="tab" aria-selected={view === option.id} onClick={() => onViewChange(option.id)} className={cn("flex h-full shrink-0 items-center gap-2 whitespace-nowrap border-l border-[var(--line)] px-3 text-[10.5px] font-medium outline-none transition-colors first:border-l-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]", view === option.id ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]")}><option.icon className="size-4" weight={view === option.id ? "fill" : "regular"} />{option.label}</button>)}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <label className="flex h-9 w-[250px] items-center gap-2 rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10px] text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] max-[1180px]:w-[190px]"><MagnifyingGlass className="size-4 shrink-0" /><input ref={searchRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} aria-label="搜索工作" placeholder="搜索工作 ID / 名称 / 描述" className="min-w-0 flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" /><kbd className="whitespace-nowrap font-sans text-[9px] text-[var(--muted)]">Ctrl K</kbd></label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className={cn("flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", priority === "all" && "data-[state=open]:bg-[var(--surface-subtle)]", priority !== "all" && "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]")}><Funnel className="size-4" />筛选</button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40"><DropdownMenuLabel>优先级</DropdownMenuLabel><DropdownMenuSeparator />{(["all", "high", "medium", "low"] as const).map((value) => <DropdownMenuCheckboxItem key={value} checked={priority === value} onCheckedChange={() => onPriorityChange(value)}>{{ all: "全部", high: "高优先级", medium: "中优先级", low: "低优先级" }[value]}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[7px] border border-[var(--line)] bg-panel px-3 text-[10.5px] outline-none transition-colors hover:bg-[var(--surface-subtle)] data-[state=open]:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><CirclesFour className="size-4" />分组</button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36"><DropdownMenuLabel>分组方式</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuCheckboxItem checked={groupBy === "status"} onCheckedChange={() => onGroupByChange("status")}>按状态</DropdownMenuCheckboxItem><DropdownMenuCheckboxItem checked={groupBy === "assignee"} onCheckedChange={() => onGroupByChange("assignee")}>按负责人</DropdownMenuCheckboxItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function WorkBoard({ items, groupBy, showSourceTotals, selectedId, draggingId, onSelect, onDragStart, onDrop, onAdd }: { items: WorkItem[]; groupBy: GroupBy; showSourceTotals: boolean; selectedId: string; draggingId: string | null; onSelect: (id: string) => void; onDragStart: (id: string) => void; onDrop: (id: string, key: string) => void; onAdd: (key: string) => void }) {
  const groups = groupBy === "status"
    ? (Object.keys(workStatusMeta) as WorkStatus[]).map((status) => ({ key: status, label: workStatusMeta[status].label, tint: workStatusMeta[status].tint, accent: workStatusMeta[status].accent, items: items.filter((item) => item.status === status) }))
    : (["林默", "小满", "陈安", "Nova"] as const).map((name) => ({ key: name, label: name, tint: "bg-[#f7f8fa]", accent: "text-[#6f7b8e]", items: items.filter((item) => item.assignee.name === name) }))

  return (
    <div className="grid min-h-full min-w-[850px] grid-cols-4 gap-3">
      {groups.map((group) => (
        <section key={group.key} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move" }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || draggingId; if (id) onDrop(id, group.key) }} className={cn("min-w-0 rounded-[8px] px-2 py-3 transition-[box-shadow,background-color]", group.tint, draggingId && "ring-1 ring-inset ring-[var(--accent-soft-line)]")}>
          <div className="flex h-9 items-center px-1.5">
            <GroupIcon groupBy={groupBy} groupKey={group.key} className={cn("size-4", group.accent)} /><h2 className={cn("ml-2 text-[11px] font-semibold", group.accent)}>{group.label}</h2><span className="ml-3 text-[9.5px] text-[var(--muted-strong)]">{groupBy === "status" && showSourceTotals ? { todo: 5, doing: 4, review: 3, done: 6 }[group.key as WorkStatus] : group.items.length}</span>
            <button type="button" aria-label={`在${group.label}中新建工作`} onClick={() => onAdd(group.key)} className="ml-auto flex size-7 items-center justify-center rounded-md text-[var(--muted-strong)] outline-none transition-colors hover:bg-black/[0.04] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Plus className="size-4" /></button>
          </div>
          <div className="mt-2.5 space-y-2.5">{group.items.map((item) => <WorkCard key={item.id} item={item} selected={selectedId === item.id} onSelect={() => onSelect(item.id)} onDragStart={() => onDragStart(item.id)} />)}{group.items.length === 0 ? <div className="flex h-24 items-center justify-center rounded-[8px] border border-dashed border-[var(--line-strong)] text-[9.5px] text-[var(--muted)]">拖动工作到这里</div> : null}</div>
        </section>
      ))}
    </div>
  )
}

function GroupIcon({ groupBy, groupKey, className }: { groupBy: GroupBy; groupKey: string; className: string }) {
  if (groupBy === "assignee") return <CirclesFour className={className} weight="fill" />
  if (groupKey === "todo") return <CircleNotch className={className} weight="bold" />
  if (groupKey === "review") return <SealWarning className={className} weight="bold" />
  if (groupKey === "done") return <CheckCircle className={className} weight="bold" />
  return <SpinnerGap className={className} weight="bold" />
}

function WorkList({ items, selectedId, onSelect }: { items: WorkItem[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="overflow-hidden rounded-[9px] border border-[var(--line)] bg-panel"><div className="grid h-10 grid-cols-[110px_minmax(260px,1fr)_110px_100px_90px] items-center border-b border-[var(--line)] bg-[#f7f8fa] px-4 text-[9.5px] font-semibold text-[var(--muted)]"><span>工作 ID</span><span>名称</span><span>状态</span><span>负责人</span><span>进度</span></div>{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={cn("grid h-12 w-full grid-cols-[110px_minmax(260px,1fr)_110px_100px_90px] items-center border-b border-[var(--line)] px-4 text-left text-[10.5px] outline-none last:border-b-0 hover:bg-[#fafbfc] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]", selectedId === item.id && "bg-[var(--accent-soft)]")}><span className="text-[var(--muted)]">{item.id}</span><span className="truncate font-medium">{item.title}</span><span className={workStatusMeta[item.status].accent}>{workStatusMeta[item.status].label}</span><span className="flex items-center gap-2"><WorkAssigneeAvatar assignee={item.assignee} size="sm" />{item.assignee.name}</span><span>{item.completed}/{item.total}</span></button>)}</div>
}

function WorkTimeline({ items, onSelect }: { items: WorkItem[]; onSelect: (id: string) => void }) {
  return <div className="rounded-[9px] border border-[var(--line)] bg-panel p-5"><div className="mb-4 flex items-center gap-2 text-[11px] font-semibold"><CalendarDots className="size-4 text-[var(--accent-ink)]" />本周推进时间线</div><div className="relative ml-2 border-l border-[var(--line-strong)] pl-5">{items.map((item, index) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="relative mb-3 flex w-full items-center gap-4 rounded-[7px] border border-[var(--line)] bg-panel p-3 text-left outline-none transition-shadow hover:shadow-[0_5px_16px_rgba(35,40,48,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><span className="absolute -left-[27px] size-3 rounded-full border-2 border-panel bg-[#7185ab]" /><span className="w-16 text-[9.5px] text-[var(--muted)]">{index < 3 ? "今天" : "明天"}</span><span className="min-w-0 flex-1 truncate text-[10.5px] font-medium">{item.title}</span><span className={cn("text-[9.5px]", workStatusMeta[item.status].accent)}>{workStatusMeta[item.status].label}</span></button>)}</div></div>
}

function WorkDependencies({ items, onSelect }: { items: WorkItem[]; onSelect: (id: string) => void }) {
  return <div className="flex min-h-[430px] items-center justify-center rounded-[9px] border border-[var(--line)] bg-panel p-8"><div className="grid w-full max-w-[720px] grid-cols-3 items-center gap-8">{items.slice(0, 6).map((item, index) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="relative rounded-[8px] border border-[var(--line)] bg-panel p-4 text-left outline-none transition-[border-color,box-shadow] hover:border-[var(--accent-soft-line)] hover:shadow-[0_7px_18px_rgba(35,40,48,0.07)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><Target className="mb-2 size-4 text-[var(--accent-ink)]" /><span className="block text-[9px] text-[var(--muted)]">{item.id}</span><span className="mt-1 block text-[10.5px] font-medium leading-4">{item.title}</span>{index < 3 ? <GitMerge className="absolute -right-6 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" /> : null}</button>)}</div></div>
}
