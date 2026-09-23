import {
  ArrowUpRight,
  DotsThree,
  Play,
  Star,
} from "@phosphor-icons/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import {
  mysqlEnvironmentTone,
  mysqlStatusMeta,
  type MysqlConnection,
  type MysqlConnectionStatus,
} from "./mysql-connections-data"

const STATUS_CLASSES: Record<MysqlConnectionStatus, string> = {
  healthy: "border-[#bdebd5] bg-[#edf9f3] text-[#168156]",
  "auth-required": "border-[#f2dcaa] bg-[#fff8e8] text-[#9b670a]",
  offline: "border-[#f3c8c5] bg-[#fff0ef] text-[#c14740]",
}

const GRID_COLUMNS = "grid-cols-[32px_minmax(170px,1.25fr)_128px_86px_minmax(178px,1.35fr)_95px_100px_86px_112px_176px]"

type MysqlConnectionTableProps = {
  connections: MysqlConnection[]
  testingId: string | null
  sortDirection: "asc" | "desc"
  onOpen: (connection: MysqlConnection) => void
  onTest: (connection: MysqlConnection) => void
  onToggleFavorite: (connectionId: string) => void
  onToggleSortDirection: () => void
  onEdit: (connection: MysqlConnection) => void
  onDuplicate: (connection: MysqlConnection) => void
  onDelete: (connection: MysqlConnection) => void
}

export function MysqlConnectionTable({
  connections,
  testingId,
  sortDirection,
  onOpen,
  onTest,
  onToggleFavorite,
  onToggleSortDirection,
  onEdit,
  onDuplicate,
  onDelete,
}: MysqlConnectionTableProps) {
  return (
    <div className="min-w-[1210px] overflow-hidden rounded-[10px] border border-[var(--line-strong)] bg-panel shadow-[0_3px_14px_rgba(18,23,31,0.035)]">
      <div className={cn("grid h-[42px] items-center gap-3 bg-[var(--surface-subtle)] px-4 text-[10px] font-semibold tracking-[0.015em] text-[var(--muted-strong)]", GRID_COLUMNS)}>
        <span aria-hidden />
        <span>连接名称</span>
        <span>项目</span>
        <span>环境</span>
        <span>地址</span>
        <span>数据库</span>
        <span>用户</span>
        <span>状态</span>
        <button
          type="button"
          onClick={onToggleSortDirection}
          className="flex items-center gap-1.5 rounded-[5px] text-left outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          最近使用
          <span className={cn("text-[12px] text-[#259b70] transition-transform", sortDirection === "asc" && "rotate-180")}>↓</span>
        </button>
        <span className="pl-1">操作</span>
      </div>

      <div role="list" aria-label="MySQL 连接列表">
        {connections.map((connection) => (
          <MysqlConnectionRow
            key={connection.id}
            connection={connection}
            testing={testingId === connection.id}
            onOpen={onOpen}
            onTest={onTest}
            onToggleFavorite={onToggleFavorite}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

function MysqlConnectionRow({
  connection,
  testing,
  onOpen,
  onTest,
  onToggleFavorite,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  connection: MysqlConnection
  testing: boolean
  onOpen: (connection: MysqlConnection) => void
  onTest: (connection: MysqlConnection) => void
  onToggleFavorite: (connectionId: string) => void
  onEdit: (connection: MysqlConnection) => void
  onDuplicate: (connection: MysqlConnection) => void
  onDelete: (connection: MysqlConnection) => void
}) {
  const status = mysqlStatusMeta[connection.status]

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`进入 ${connection.name}`}
      onClick={() => onOpen(connection)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(connection)
        }
      }}
      className={cn("group grid h-[54px] cursor-pointer items-center gap-3 border-t border-[var(--line)] px-4 outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_3.2%,var(--panel))] focus-visible:bg-[var(--accent-soft)]", GRID_COLUMNS)}
    >
      <button
        type="button"
        aria-label={connection.favorite ? `取消收藏 ${connection.name}` : `收藏 ${connection.name}`}
        aria-pressed={connection.favorite}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite(connection.id)
        }}
        className={cn(
          "flex size-8 items-center justify-center rounded-[7px] outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          connection.favorite ? "text-[#dd9d22]" : "text-[var(--muted)] hover:text-[var(--ink-soft)]",
        )}
      >
        <Star className="size-[17px]" weight={connection.favorite ? "fill" : "regular"} />
      </button>

      <div className="min-w-0">
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-semibold tracking-[-0.012em] text-[var(--ink)]">{connection.name}</p>
          <span className="mt-1 block truncate text-[10px] text-[var(--muted-strong)]">{connection.description}</span>
        </div>
      </div>

      <span className="truncate text-[10.5px] text-[var(--ink-soft)]" title={connection.project}>{connection.project}</span>
      <span className="flex items-center gap-2 text-[10px] font-medium text-[var(--ink-soft)]">
        <span className="size-2 rounded-full" style={{ backgroundColor: mysqlEnvironmentTone[connection.environment] }} />
        {connection.environment}
      </span>
      <span className="truncate font-mono text-[10px] tabular-nums text-[var(--ink-soft)]" title={connection.host}>{connection.host}</span>
      <span className="truncate font-mono text-[10px] text-[var(--ink-soft)]" title={connection.database}>{connection.database}</span>
      <span className="truncate text-[10.5px] text-[var(--muted-strong)]">{connection.username}</span>
      <span className={cn("inline-flex h-5 w-fit items-center gap-1.5 rounded-full border px-2 text-[9px] font-medium", STATUS_CLASSES[connection.status])}>
        <span className="size-1.5 rounded-full bg-current" />
        {status.label}
      </span>
      <span className="whitespace-nowrap text-[10.5px] tabular-nums text-[var(--muted-strong)]">{connection.lastUsed}</span>

      <div className="relative z-10 flex items-center gap-1.5 pl-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen(connection)
          }}
          className="flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-2.5 text-[10px] font-semibold text-[var(--accent-ink)] outline-none transition-colors hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_13%,var(--panel))] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ArrowUpRight className="size-3.5" weight="bold" />
          打开
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={(event) => {
            event.stopPropagation()
            onTest(connection)
          }}
          className="flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[var(--line-strong)] bg-panel px-2.5 text-[10px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--accent-soft-line)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60"
        >
          <Play className={cn("size-3.5", testing && "animate-pulse")} weight="regular" />
          {testing ? "测试中" : "测试"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label={`${connection.name} 更多操作`}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-[7px] border border-transparent text-[var(--muted-strong)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-panel hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 min-w-0" onClick={(event) => event.stopPropagation()}>
            <ConnectionMenuItem label="编辑连接" onSelect={() => onEdit(connection)} />
            <ConnectionMenuItem label="复制连接" onSelect={() => onDuplicate(connection)} />
            <DropdownMenuSeparator />
            <ConnectionMenuItem label="删除连接" onSelect={() => onDelete(connection)} danger />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

function ConnectionMenuItem({ label, onSelect, danger = false }: { label: string; onSelect: () => void; danger?: boolean }) {
  return (
    <DropdownMenuItem onSelect={onSelect} className={cn("text-[11px]", danger && "text-[var(--err-ink)]")}>
      {label}
    </DropdownMenuItem>
  )
}
