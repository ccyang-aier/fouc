import {
  ArrowRight,
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
    <div className="min-w-[1210px] border-y border-[var(--line)] bg-panel">
      <div className="grid h-[38px] grid-cols-[32px_minmax(160px,1.2fr)_128px_86px_minmax(180px,1.45fr)_100px_104px_86px_112px_168px] items-center gap-3 bg-[var(--surface-subtle)] px-3 text-[10px] font-medium text-[var(--muted-strong)]">
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
        <span className="pl-2">操作</span>
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
      className="group grid h-[60px] cursor-pointer grid-cols-[32px_minmax(160px,1.2fr)_128px_86px_minmax(180px,1.45fr)_100px_104px_86px_112px_168px] items-center gap-3 border-t border-[var(--line)] px-3 outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_2.8%,var(--panel))] focus-visible:bg-[var(--accent-soft)]"
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
          "flex size-7 items-center justify-center rounded-[6px] outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:text-[var(--accent-ink)]",
          connection.favorite ? "text-[#dd9d22]" : "text-[var(--muted)] hover:text-[var(--ink-soft)]",
        )}
      >
        <Star className="size-[17px]" weight={connection.favorite ? "fill" : "regular"} />
      </button>

      <div className="min-w-0">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold tracking-[-0.012em] text-[var(--ink)]">{connection.name}</p>
          <span className="mt-0.5 inline-flex rounded-[4px] bg-[var(--surface-hover)] px-1.5 py-px text-[9px] leading-[13px] text-[var(--muted-strong)]">{connection.description}</span>
        </div>
      </div>

      <span className="truncate text-[10.5px] text-[var(--ink-soft)]" title={connection.project}>{connection.project}</span>
      <span className="flex items-center gap-2 text-[10px] font-medium text-[var(--ink-soft)]">
        <span className="size-2 rounded-full" style={{ backgroundColor: mysqlEnvironmentTone[connection.environment] }} />
        {connection.environment}
      </span>
      <span className="truncate text-[11px] tabular-nums text-[var(--ink-soft)]">{connection.host}</span>
      <span className="truncate text-[11px] text-[var(--ink-soft)]">{connection.database}</span>
      <span className="truncate text-[10.5px] text-[var(--muted-strong)]">{connection.username}</span>
      <span className={cn("inline-flex h-5 w-fit items-center gap-1.5 rounded-full border px-2 text-[9px] font-medium", STATUS_CLASSES[connection.status])}>
        <span className="size-1.5 rounded-full bg-current" />
        {status.label}
      </span>
      <span className="whitespace-nowrap text-[10.5px] tabular-nums text-[var(--muted-strong)]">{connection.lastUsed}</span>

      <div className="relative z-10 flex items-center gap-1 pl-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen(connection)
          }}
          className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-[10.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:bg-[var(--surface-hover)]"
        >
          <ArrowRight className="size-3.5" />
          打开
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={(event) => {
            event.stopPropagation()
            onTest(connection)
          }}
          className="flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[10.5px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60"
        >
          <Play className={cn("size-3.5", testing && "animate-pulse")} weight="regular" />
          {testing ? "测试中" : "测试"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label={`${connection.name} 更多操作`}
              className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
