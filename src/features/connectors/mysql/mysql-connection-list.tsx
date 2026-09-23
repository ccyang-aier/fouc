"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { ArrowLeft, CaretDown, CaretRight, DotsThree, MagnifyingGlass, Plus, UploadSimple } from "@phosphor-icons/react"

import { AppAlert, type AppAlertMessage } from "@/components/app-alert"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { MysqlConnectionDialog } from "./mysql-connection-dialog"
import { MysqlConnectionTable } from "./mysql-connection-table"
import { initialMysqlConnections, MYSQL_ENVIRONMENTS, MYSQL_PROJECTS, MYSQL_STATUSES, type MysqlConnection, type MysqlConnectionEnvironment, type MysqlConnectionProject, type MysqlConnectionStatus } from "./mysql-connections-data"

type MysqlSort = "recent" | "name" | "favorite"

const SORT_OPTIONS: ReadonlyArray<{ value: MysqlSort; label: string }> = [
  { value: "recent", label: "最近使用" },
  { value: "name", label: "名称排序" },
  { value: "favorite", label: "收藏优先" },
]

export function MysqlConnectionList({ onBack }: { onBack: () => void }) {
  const [connections, setConnections] = useState(initialMysqlConnections)
  const [query, setQuery] = useState("")
  const [environments, setEnvironments] = useState<MysqlConnectionEnvironment[]>([])
  const [projects, setProjects] = useState<MysqlConnectionProject[]>([])
  const [statuses, setStatuses] = useState<MysqlConnectionStatus[]>([])
  const [sort, setSort] = useState<MysqlSort>("recent")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [testingId, setTestingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [alert, setAlert] = useState<AppAlertMessage | null>(null)
  const closeAlert = useCallback(() => setAlert(null), [])

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

  function testConnection(connection: MysqlConnection) {
    if (testingId) return
    setTestingId(connection.id)
    window.setTimeout(() => {
      setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "healthy" } : item))
      setTestingId(null)
      notify(`${connection.name} 连接正常`, `已成功连接 ${connection.host}`)
    }, 700)
  }

  function deleteConnection(connection: MysqlConnection) {
    if (!window.confirm(`确定删除「${connection.name}」吗？`)) return
    setConnections((current) => current.filter((item) => item.id !== connection.id))
    notify("连接已删除", connection.name, "info")
  }

  return (
    <section aria-label="MySQL 连接" className="relative flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <header className="shrink-0 border-b border-[var(--line)] bg-[linear-gradient(115deg,color-mix(in_srgb,var(--accent)_4%,var(--panel)),var(--panel)_42%)] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={onBack} aria-label="返回连接器列表" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--line-strong)] bg-panel text-[var(--ink-soft)] shadow-[0_1px_2px_rgba(18,23,31,0.04)] outline-none transition-colors hover:border-[var(--accent-soft-line)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <ArrowLeft className="size-4" />
            </button>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-[var(--line)] bg-panel shadow-[0_2px_8px_rgba(18,23,31,0.04)]">
              <Image src="/connector-logos/mysql.svg" alt="" width={32} height={32} className="size-8 object-contain" priority />
            </span>
            <div className="min-w-0">
              <nav aria-label="面包屑" className="mb-1 flex items-center gap-1.5 text-[10px] text-[var(--muted-strong)]">
                <button type="button" onClick={onBack} className="rounded-[4px] outline-none hover:text-[var(--accent-ink)] focus-visible:text-[var(--accent-ink)]">连接器</button>
                <CaretRight className="size-2.5 text-[var(--muted)]" />
                <span aria-current="page">MySQL</span>
              </nav>
              <div className="flex items-baseline gap-3">
                <h1 className="text-[21px] font-semibold leading-6 tracking-[-0.035em] text-[var(--ink)]">MySQL</h1>
                <span className="rounded-full border border-[var(--line)] bg-panel px-2 py-0.5 text-[10px] tabular-nums text-[var(--muted-strong)]">{connections.length} 个连接</span>
              </div>
              <p className="mt-1 text-[10.5px] text-[var(--muted-strong)]">管理并访问你的 MySQL 数据库</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCreateOpen(true)} className="flex h-9 items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3.5 text-[11px] font-medium text-white shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_18%,transparent)] outline-none transition-colors hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <Plus className="size-3.5" weight="bold" />新建连接
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="更多操作" title="更多操作" className="flex size-9 items-center justify-center rounded-[8px] border border-[var(--line-strong)] bg-panel text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
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
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-10 pt-5">

        <div className="mt-3 flex flex-wrap items-center gap-2">
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
              onOpen={(connection) => notify(`准备进入 ${connection.name}`, "工作台将在后续页面实现", "info")}
              onTest={testConnection}
              onToggleFavorite={(connectionId) => setConnections((current) => current.map((item) => item.id === connectionId ? { ...item, favorite: !item.favorite } : item))}
              onToggleSortDirection={() => { setSort("recent"); setSortDirection((current) => current === "desc" ? "asc" : "desc") }}
              onEdit={(connection) => notify(`编辑 ${connection.name}`, "连接编辑页将在后续页面实现", "info")}
              onDuplicate={(connection) => {
                setConnections((current) => [...current, { ...connection, id: `${connection.id}-copy-${Date.now()}`, name: `${connection.name} 副本`, favorite: false }])
                notify("已复制连接", connection.name)
              }}
              onDelete={deleteConnection}
            />
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[9px] border border-dashed border-[var(--line-strong)] text-center">
              <MagnifyingGlass className="size-6 text-[var(--muted)]" />
              <p className="mt-3 text-[12px] font-medium text-[var(--ink-soft)]">没有匹配的连接</p>
              <button type="button" onClick={clearFilters} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">清除筛选条件</button>
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] tabular-nums text-[var(--muted-strong)]">{visibleConnections.length} 个连接</p>
      </div>

      <MysqlConnectionDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={(connection) => { setConnections((current) => [connection, ...current]); setCreateOpen(false); notify("连接已创建", connection.name) }} />
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
    <FilterMenu label={label} width={title === "项目" ? "w-[122px]" : "w-[104px]"} active={selected.length > 0}>
      <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium text-[var(--muted)]">{title}筛选 · 可多选</div>
      <DropdownMenuCheckboxItem checked={selected.length === 0} onSelect={(event) => event.preventDefault()} onCheckedChange={() => onChange([])}>{allLabel}</DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option.value}
          checked={selected.includes(option.value)}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onChange(selected.includes(option.value) ? selected.filter((value) => value !== option.value) : [...selected, option.value])}
        >
          {option.label}
        </DropdownMenuCheckboxItem>
      ))}
    </FilterMenu>
  )
}

function FilterMenu({ label, width, active = false, children }: { label: string; width: string; active?: boolean; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${width} flex h-8 shrink-0 items-center gap-2 rounded-[7px] border px-2.5 text-[10px] font-medium outline-none transition-colors hover:border-[var(--accent-soft-line)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active ? "border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--line-strong)] bg-panel text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]"}`}>
          <span className="truncate">{label}</span><CaretDown className="ml-auto size-3 shrink-0 text-[var(--muted)]" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[188px] min-w-0">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
