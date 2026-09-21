"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { CaretDown, DotsThree, MagnifyingGlass, Plus, UploadSimple } from "@phosphor-icons/react"

import { AppAlert, type AppAlertMessage } from "@/components/app-alert"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { ConnectorDetailHeader } from "../connector-detail-header"
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
  const [environment, setEnvironment] = useState<"全部环境" | MysqlConnectionEnvironment>("全部环境")
  const [project, setProject] = useState<"全部项目" | MysqlConnectionProject>("全部项目")
  const [status, setStatus] = useState<"all" | MysqlConnectionStatus>("all")
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
      const matchesEnvironment = environment === "全部环境" || connection.environment === environment
      const matchesProject = project === "全部项目" || connection.project === project
      const matchesStatus = status === "all" || connection.status === status
      return matchesQuery && matchesEnvironment && matchesProject && matchesStatus
    })

    return filtered.toSorted((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN")
      if (sort === "favorite" && a.favorite !== b.favorite) return a.favorite ? -1 : 1
      const delta = a.lastUsedOrder - b.lastUsedOrder
      return sortDirection === "desc" ? delta : -delta
    })
  }, [connections, environment, project, query, sort, sortDirection, status])

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
      <ConnectorDetailHeader name="MySQL" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-10 pt-3">
        <header className="flex h-[58px] items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_4%,var(--panel))]">
            <Image src="/connector-logos/mysql.svg" alt="MySQL" width={32} height={32} className="size-8 object-contain" priority />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-6 tracking-[-0.03em] text-[var(--ink)]">MySQL</h1>
            <p className="mt-1 text-[10px] text-[var(--muted-strong)]">管理并访问你的 MySQL 连接</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setCreateOpen(true)} aria-label="新建连接" title="新建连接" className="flex size-7 items-center justify-center rounded-full border border-[var(--line-strong)] bg-panel text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:border-[var(--ink-soft)]">
              <Plus className="size-3.5" weight="bold" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="更多操作" title="更多操作" className="flex size-7 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted-strong)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:border-[var(--accent)]">
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <FilterMenu label={MYSQL_STATUSES.find((option) => option.value === status)?.label ?? "全部状态"} width="w-[100px]">
              {MYSQL_STATUSES.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={status === option.value} onCheckedChange={() => setStatus(option.value)}>{option.label}</DropdownMenuCheckboxItem>)}
            </FilterMenu>
            <label className="flex h-8 w-[280px] items-center gap-2 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)]">
              <MagnifyingGlass className="size-3.5 shrink-0" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、地址或标签" aria-label="搜索 MySQL 连接" className="min-w-0 flex-1 bg-transparent text-[10px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <FilterMenu label={project} width="w-[118px]">
              {MYSQL_PROJECTS.map((option) => <DropdownMenuCheckboxItem key={option} checked={project === option} onCheckedChange={() => setProject(option)}>{option}</DropdownMenuCheckboxItem>)}
            </FilterMenu>
            <FilterMenu label={environment} width="w-[96px]">
              {MYSQL_ENVIRONMENTS.map((option) => <DropdownMenuCheckboxItem key={option} checked={environment === option} onCheckedChange={() => setEnvironment(option)}>{option}</DropdownMenuCheckboxItem>)}
            </FilterMenu>
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
              <button type="button" onClick={() => { setQuery(""); setEnvironment("全部环境"); setProject("全部项目"); setStatus("all") }} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">清除筛选条件</button>
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

function FilterMenu({ label, width, children }: { label: string; width: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${width} flex h-8 shrink-0 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 text-[10px] text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:border-[var(--accent)]`}>
          <span className="truncate">{label}</span><CaretDown className="ml-auto size-3 shrink-0 text-[var(--muted)]" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[170px] min-w-0">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
