"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import { CaretDown, MagnifyingGlass, Plus, SortAscending } from "@phosphor-icons/react"

import { AppAlert, type AppAlertMessage } from "@/components/app-alert"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { MysqlConnectionDialog } from "./mysql-connection-dialog"
import { MysqlConnectionTable } from "./mysql-connection-table"
import { initialMysqlConnections, MYSQL_ENVIRONMENTS, MYSQL_STATUSES, type MysqlConnection, type MysqlConnectionEnvironment, type MysqlConnectionStatus } from "./mysql-connections-data"

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
      const matchesQuery = !normalized || `${connection.name} ${connection.description} ${connection.host} ${connection.database}`.toLocaleLowerCase("zh-CN").includes(normalized)
      const matchesEnvironment = environment === "全部环境" || connection.environment === environment
      const matchesStatus = status === "all" || connection.status === status
      return matchesQuery && matchesEnvironment && matchesStatus
    })

    return filtered.toSorted((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-CN")
      if (sort === "favorite" && a.favorite !== b.favorite) return a.favorite ? -1 : 1
      const delta = a.lastUsedOrder - b.lastUsedOrder
      return sortDirection === "desc" ? delta : -delta
    })
  }, [connections, environment, query, sort, sortDirection, status])

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
      <div className="min-h-0 flex-1 overflow-auto px-7 pb-10 pt-5 max-[900px]:px-5">
        <nav aria-label="面包屑" className="flex h-6 items-center gap-2 text-[10.5px] text-[var(--muted-strong)]">
          <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-[5px] outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            连接器
          </button>
          <span aria-hidden className="text-[var(--line-strong)]">/</span>
          <span className="font-medium text-[var(--ink-soft)]">MySQL</span>
        </nav>

        <header className="mt-5 flex min-h-[76px] items-start gap-5">
          <span className="flex size-[70px] shrink-0 items-center justify-center rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_4%,var(--panel))]">
            <Image src="/connector-logos/mysql.svg" alt="MySQL" width={47} height={47} className="size-[47px] object-contain" priority />
          </span>
          <div className="min-w-0 pt-2">
            <h1 className="text-[30px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ink)]">MySQL</h1>
            <p className="mt-2 text-[11.5px] text-[var(--muted-strong)]">管理并访问你的 MySQL 连接</p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)} className="ml-auto mt-1 h-[42px] rounded-[8px] px-5 text-[12px]">
            <Plus className="size-4" weight="bold" />新建连接
          </Button>
        </header>

        <div className="mt-5 flex items-center gap-3">
          <label className="flex h-10 min-w-[250px] flex-1 items-center gap-2.5 rounded-[8px] border border-[var(--line)] bg-panel px-3.5 text-[var(--muted)] transition-colors focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
            <MagnifyingGlass className="size-4 shrink-0" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、地址或标签" aria-label="搜索 MySQL 连接" className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          </label>
          <FilterMenu label={environment} width="w-[170px]">
            {MYSQL_ENVIRONMENTS.map((option) => <DropdownMenuCheckboxItem key={option} checked={environment === option} onCheckedChange={() => setEnvironment(option)}>{option}</DropdownMenuCheckboxItem>)}
          </FilterMenu>
          <FilterMenu label={MYSQL_STATUSES.find((option) => option.value === status)?.label ?? "全部状态"} width="w-[170px]">
            {MYSQL_STATUSES.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={status === option.value} onCheckedChange={() => setStatus(option.value)}>{option.label}</DropdownMenuCheckboxItem>)}
          </FilterMenu>
          <FilterMenu label={SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "最近使用"} width="w-[170px]" icon>
            {SORT_OPTIONS.map((option) => <DropdownMenuCheckboxItem key={option.value} checked={sort === option.value} onCheckedChange={() => setSort(option.value)}>{option.label}</DropdownMenuCheckboxItem>)}
          </FilterMenu>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
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
              <button type="button" onClick={() => { setQuery(""); setEnvironment("全部环境"); setStatus("all") }} className="mt-2 text-[10.5px] text-[var(--accent-ink)] hover:underline">清除筛选条件</button>
            </div>
          )}
        </div>
        <p className="mt-4 text-[10.5px] tabular-nums text-[var(--muted-strong)]">{visibleConnections.length} 个连接</p>
      </div>

      <MysqlConnectionDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={(connection) => { setConnections((current) => [connection, ...current]); setCreateOpen(false); notify("连接已创建", connection.name) }} />
      <AppAlert alert={alert} onClose={closeAlert} />
    </section>
  )
}

function FilterMenu({ label, width, icon = false, children }: { label: string; width: string; icon?: boolean; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${width} flex h-10 shrink-0 items-center gap-2 rounded-[8px] border border-[var(--line)] bg-panel px-3.5 text-[11px] text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]`}>
          {icon ? <SortAscending className="size-4 shrink-0 text-[var(--muted-strong)]" /> : null}
          <span className="truncate">{label}</span><CaretDown className="ml-auto size-3 shrink-0 text-[var(--muted)]" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[170px] min-w-0">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
