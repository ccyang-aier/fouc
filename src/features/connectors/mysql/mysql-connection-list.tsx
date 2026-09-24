"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, CaretDown, CaretRight, Check, DotsThree, MagnifyingGlass, Plus, UploadSimple } from "@phosphor-icons/react"

import { AppAlert, type AppAlertMessage } from "@/components/app-alert"
import { backendFetch } from "@/lib/backend"
import type { DatabaseCapabilitySnapshot } from "@fouc/shared"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { MysqlConnectionDialog, type MysqlConnectionDraft } from "./mysql-connection-dialog"
import { MysqlConnectionTable } from "./mysql-connection-table"
import { MysqlLiveWorkbench } from "./workbench/mysql-live-workbench"
import { MYSQL_ENVIRONMENTS, MYSQL_PROJECTS, MYSQL_STATUSES, type MysqlConnection, type MysqlConnectionEnvironment, type MysqlConnectionProject, type MysqlConnectionStatus } from "./mysql-connections-data"

type MysqlSort = "recent" | "name" | "favorite"

const SORT_OPTIONS: ReadonlyArray<{ value: MysqlSort; label: string }> = [
  { value: "recent", label: "最近使用" },
  { value: "name", label: "名称排序" },
  { value: "favorite", label: "收藏优先" },
]

export function MysqlConnectionList({ onBack, onWorkbenchFocus }: { onBack: () => void; onWorkbenchFocus?: () => void }) {
  const [connections, setConnections] = useState<MysqlConnection[]>([])
  const [activeConnection, setActiveConnection] = useState<MysqlConnection | null>(null)
  const [query, setQuery] = useState("")
  const [environments, setEnvironments] = useState<MysqlConnectionEnvironment[]>([])
  const [projects, setProjects] = useState<MysqlConnectionProject[]>([])
  const [statuses, setStatuses] = useState<MysqlConnectionStatus[]>([])
  const [sort, setSort] = useState<MysqlSort>("recent")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [testingId, setTestingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [alert, setAlert] = useState<AppAlertMessage | null>(null)
  const liveSessions = useRef(new Set<string>())
  const closeAlert = useCallback(() => setAlert(null), [])

  useEffect(() => () => {
    for (const id of liveSessions.current) void backendFetch(`/api/database/mysql/sessions/${id}`, { method: "DELETE" }).catch(() => undefined)
    liveSessions.current.clear()
  }, [])

  const notify = useCallback((title: string, description?: string, tone: AppAlertMessage["tone"] = "success") => {
    setAlert({ id: Date.now(), title, description, tone })
  }, [])

  const visibleConnections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN")
    const filtered = connections.filter((connection) => {
      const matchesQuery = !normalized || `${connection.name} ${connection.description} ${connection.project} ${connection.host} ${connection.database} ${connection.username}`.toLocaleLowerCase("zh-CN").includes(normalized)
      const matchesEnvironment = environments.length === 0 || environments.includes(connection.environment)
      const matchesProject = projects.length === 0 || projects.includes(connection.project)
      const matchesStatus = statuses.length === 0 || statuses.includes(connection.status)
      return matchesQuery && matchesEnvironment && matchesProject && matchesStatus
    })

    return filtered.toSorted((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN")
      if (sort === "favorite" && a.favorite !== b.favorite) return a.favorite ? -1 : 1
      const delta = a.lastUsedOrder - b.lastUsedOrder
      return sortDirection === "desc" ? delta : -delta
    })
  }, [connections, environments, projects, query, sort, sortDirection, statuses])

  function clearFilters() {
    setQuery("")
    setEnvironments([])
    setProjects([])
    setStatuses([])
  }

  async function testConnection(connection: MysqlConnection) {
    if (testingId) return
    if (!connection.liveSessionId) return
    setTestingId(connection.id)
    try {
      await backendFetch<DatabaseCapabilitySnapshot>(`/api/database/connections/${connection.liveSessionId}/capabilities`)
      setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "healthy" } : item))
      notify(`${connection.name} 连接正常`, `已成功连接 ${connection.host}`)
    } catch (error) {
      setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "offline" } : item))
      notify("连接测试失败", error instanceof Error ? error.message : "连接已断开", "error")
    } finally {
      setTestingId(null)
    }
  }

  function deleteConnection(connection: MysqlConnection) {
    if (!window.confirm(`确定删除「${connection.name}」吗？`)) return
    if (connection.liveSessionId) {
      liveSessions.current.delete(connection.liveSessionId)
      void backendFetch(`/api/database/mysql/sessions/${connection.liveSessionId}`, { method: "DELETE" }).catch(() => undefined)
    }
    setConnections((current) => current.filter((item) => item.id !== connection.id))
    notify("连接已删除", connection.name, "info")
  }

  async function createConnection(draft: MysqlConnectionDraft) {
    const snapshot = await backendFetch<DatabaseCapabilitySnapshot>("/api/database/mysql/sessions", {
      method: "POST",
      body: JSON.stringify({ host: draft.host, port: draft.port, username: draft.username, password: draft.password,
        database: draft.database || null, readOnly: true, production: draft.environment === "生产" }),
    })
    liveSessions.current.add(snapshot.connectionId)
    const connection: MysqlConnection = {
      id: snapshot.connectionId, liveSessionId: snapshot.connectionId, name: draft.name,
      description: "本次会话", project: "Fouc 桌面端 V1", environment: draft.environment,
      host: `${draft.host}:${draft.port}`, database: draft.database || "—", username: draft.username,
      status: "healthy", lastUsed: "刚刚", lastUsedOrder: -1, favorite: false,
    }
    setConnections((current) => [connection, ...current])
    setCreateOpen(false)
    setActiveConnection(connection)
    onWorkbenchFocus?.()
  }

  if (activeConnection?.liveSessionId) return <MysqlLiveWorkbench connection={activeConnection} onBack={() => setActiveConnection(null)} onConnectorBack={onBack} />

  return (
    <section aria-label="MySQL 连接" className="relative flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <header className="flex h-[42px] shrink-0 items-center gap-3 border-b border-[var(--line)] px-[18px]">
        <div className="flex min-w-0 items-center gap-1.5">
          <button type="button" onClick={onBack} aria-label="返回连接器列表" className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <ArrowLeft className="size-3.5" />
          </button>
          <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-[var(--muted-strong)]">
            <button type="button" onClick={onBack} className="rounded-[4px] outline-none hover:text-[var(--accent-ink)] focus-visible:text-[var(--accent-ink)]">连接器</button>
            <CaretRight className="size-2.5 shrink-0 text-[var(--muted)]" />
            <span aria-current="page" className="truncate font-medium text-[var(--ink-soft)]">MySQL</span>
          </nav>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setCreateOpen(true)} className="flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-2.5 text-[10.5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <Plus className="size-3" weight="bold" />新建连接
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="更多操作" title="更多操作" className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                <DotsThree className="size-4" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 min-w-0">
              <DropdownMenuItem onSelect={() => notify("导入连接", "批量导入能力将在连接配置模块中提供", "info")}><UploadSimple />导入连接</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => notify("连接设置", "已进入 MySQL 连接配置入口", "info")}>连接设置</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <MultiSelectFilter title="状态" allLabel="全部状态" options={MYSQL_STATUSES.filter((option) => option.value !== "all").map((option) => ({ value: option.value as MysqlConnectionStatus, label: option.label }))} selected={statuses} onChange={setStatuses} />
            <label className="flex h-8 w-[280px] items-center gap-2 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)]">
              <MagnifyingGlass className="size-3.5 shrink-0" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、地址或标签" aria-label="搜索 MySQL 连接" className="min-w-0 flex-1 bg-transparent text-[10px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <MultiSelectFilter title="项目" allLabel="全部项目" options={MYSQL_PROJECTS.filter((option) => option !== "全部项目").map((option) => ({ value: option as MysqlConnectionProject, label: option }))} selected={projects} onChange={setProjects} />
            <MultiSelectFilter title="环境" allLabel="全部环境" options={MYSQL_ENVIRONMENTS.filter((option) => option !== "全部环境").map((option) => ({ value: option as MysqlConnectionEnvironment, label: option }))} selected={environments} onChange={setEnvironments} />
            <FilterMenu label={SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "最近使用"} width="w-[100px]">
              {SORT_OPTIONS.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={sort === option.value} onCheckedChange={() => setSort(option.value)}>{option.label}</DropdownMenuCheckboxItem>)}
            </FilterMenu>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto pb-1">
          {visibleConnections.length > 0 ? (
            <MysqlConnectionTable
              connections={visibleConnections}
              testingId={testingId}
              sortDirection={sortDirection}
              onOpen={(connection) => { setActiveConnection(connection); onWorkbenchFocus?.() }}
              onTest={testConnection}
              onToggleFavorite={(connectionId) => setConnections((current) => current.map((item) => item.id === connectionId ? { ...item, favorite: !item.favorite } : item))}
              onToggleSortDirection={() => { setSort("recent"); setSortDirection((current) => current === "desc" ? "asc" : "desc") }}
              onEdit={(connection) => notify(`编辑 ${connection.name}`, "连接编辑页将在后续页面实现", "info")}
              onDuplicate={() => { setCreateOpen(true); notify("重新建立连接", "复制连接需要重新输入凭据", "info") }}
              onDelete={deleteConnection}
            />
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[9px] border border-dashed border-[var(--line-strong)] text-center">
              <MagnifyingGlass className="size-6 text-[var(--muted)]" />
              <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">{connections.length ? "没有匹配的连接" : "还没有 MySQL 连接"}</p>
              <button type="button" onClick={connections.length ? clearFilters : () => setCreateOpen(true)} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">{connections.length ? "清除筛选条件" : "新建连接"}</button>
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] tabular-nums text-[var(--muted-strong)]">{visibleConnections.length} 个连接</p>
      </div>

      <MysqlConnectionDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createConnection} />
      <AppAlert alert={alert} onClose={closeAlert} />
    </section>
  )
}

function MultiSelectFilter<T extends string>({ title, allLabel, options, selected, onChange }: {
  title: string
  allLabel: string
  options: ReadonlyArray<{ value: T; label: string }>
  selected: T[]
  onChange: (values: T[]) => void
}) {
  const label = selected.length === 0 ? allLabel : selected.length === 1 ? options.find((option) => option.value === selected[0])?.label ?? allLabel : `${title} · ${selected.length}`

  return (
    <FilterMenu label={label} width={title === "项目" ? "w-[122px]" : "w-[104px]"} active={selected.length > 0} align={title === "状态" ? "start" : "end"}>
      {options.map((option) => (
        <RightCheckboxItem
          key={option.value}
          checked={selected.includes(option.value)}
          onCheckedChange={() => onChange(selected.includes(option.value) ? selected.filter((value) => value !== option.value) : [...selected, option.value])}
        >
          {option.label}
        </RightCheckboxItem>
      ))}
      {selected.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onChange([])} className="text-[10.5px] text-[var(--accent-ink)]">清除筛选</DropdownMenuItem>
        </>
      )}
    </FilterMenu>
  )
}

function RightCheckboxItem({ checked, onCheckedChange, children }: { checked: boolean; onCheckedChange: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuCheckboxItem checked={checked} onSelect={(event) => event.preventDefault()} onCheckedChange={onCheckedChange} className="!justify-between !pl-2.5 !pr-2.5 [&>span:first-child]:hidden">
      <span>{children}</span>
      <span aria-hidden className={`ml-auto flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${checked ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line-strong)] bg-panel"}`}>
        {checked && <Check className="size-3" weight="bold" />}
      </span>
    </DropdownMenuCheckboxItem>
  )
}

function FilterMenu({ label, width, active = false, align = "end", children }: { label: string; width: string; active?: boolean; align?: "start" | "end"; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${width} flex h-8 shrink-0 items-center gap-2 rounded-[7px] border px-2.5 text-[10px] font-medium outline-none transition-colors hover:border-[var(--accent-soft-line)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--line-strong)] bg-panel text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]"}`}>
          <span className="truncate">{label}</span><CaretDown className="ml-auto size-3 shrink-0 text-[var(--muted)]" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[188px] min-w-0">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
