"use client"

import { useMemo, useState } from "react"
import {
  ArrowsClockwise, BracketsCurly, CaretDown, CaretDoubleLeft, CaretDoubleRight,
  CaretRight, ClockCounterClockwise, Database, FileCode, FilePlus, FolderOpen,
  Eye, Funnel, MagnifyingGlass, Plus, Table, UsersThree,
} from "@phosphor-icons/react"

import type { MysqlConnection } from "../mysql-connections-data"
import { SCHEMAS, TABLE_NAMES } from "./mysql-workbench-data"

type Props = {
  connection: MysqlConnection
  collapsed: boolean
  activeTable: string | null
  onCollapse: () => void
  onOpenTable: (name: string) => void
  onNewQuery: () => void
  onRefresh: () => void
  onNotice: (message: string) => void
}

const RECENT = [
  { name: "customers", time: "2 分钟前", table: true },
  { name: "orders", time: "5 分钟前", table: true },
  { name: "订单查询.sql", time: "12 分钟前", table: false },
  { name: "products", time: "1 小时前", table: true },
]

export function MysqlWorkbenchExplorer({ connection, collapsed, activeTable, onCollapse, onOpenTable, onNewQuery, onRefresh, onNotice }: Props) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["orders", "tables"]))
  const [onlyTables, setOnlyTables] = useState(false)
  const normalized = query.trim().toLocaleLowerCase("zh-CN")
  const visibleTables = useMemo(() => TABLE_NAMES.filter((name) => name.includes(normalized)), [normalized])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (collapsed) {
    return (
      <aside className="mw-explorer mw-explorer-collapsed" aria-label="数据库资源">
        <button type="button" className="mw-icon-button" aria-label="展开数据库资源" title="展开数据库资源" onClick={onCollapse}><CaretDoubleRight size={15} /></button>
        <Database size={17} className="mw-blue" aria-hidden />
      </aside>
    )
  }

  return (
    <aside className="mw-explorer" aria-label="数据库资源">
      <div className="mw-explorer-head">
        <strong>数据库资源</strong>
        <div className="mw-head-actions">
          <button type="button" className="mw-icon-button mw-outline" aria-label="新建查询" title="新建查询" onClick={onNewQuery}><Plus size={15} /></button>
          <button type="button" className="mw-icon-button" aria-label="新建 SQL 文件" title="新建 SQL 文件" onClick={onNewQuery}><FilePlus size={15} /></button>
          <button type="button" className="mw-icon-button" aria-label="打开资源" title="打开资源" onClick={() => onNotice("请在资源树中选择数据库对象")}><FolderOpen size={15} /></button>
          <button type="button" className="mw-icon-button" aria-label="刷新数据库资源" title="刷新数据库资源" onClick={onRefresh}><ArrowsClockwise size={15} /></button>
          <button type="button" className="mw-icon-button" aria-label="收起数据库资源" title="收起数据库资源" onClick={onCollapse}><CaretDoubleLeft size={14} /></button>
        </div>
      </div>
      <div className="mw-search-row">
        <label className="mw-search"><MagnifyingGlass size={14} /><input aria-label="搜索数据库资源" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索表名、视图、函数等" /></label>
        <button type="button" className={`mw-icon-button mw-outline ${onlyTables ? "mw-active-button" : ""}`} aria-label="仅显示表" title="仅显示表" aria-pressed={onlyTables} onClick={() => setOnlyTables((value) => !value)}><Funnel size={15} /></button>
      </div>
      <div className="mw-tree-scroll">
        <div className="mw-tree-row mw-connection-row"><CaretDown size={12} /><Database size={16} className="mw-mysql-icon" /><span className="mw-ellipsis">MySQL - {connection.name}</span><span className="mw-online-dot" /></div>
        {SCHEMAS.filter((schema) => !normalized || schema.includes(normalized) || schema === "orders" && visibleTables.length > 0).map((schema) => {
          const isOrders = schema === "orders"
          const isOpen = expanded.has(schema)
          return (
            <div key={schema}>
              <button type="button" className="mw-tree-row mw-schema-row" onClick={() => toggle(schema)} aria-expanded={isOpen}>
                {isOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
                <Database size={15} className="mw-schema-icon" />
                <span className="mw-ellipsis">{schema}</span>
              </button>
              {isOrders && isOpen && (
                <>
                  <button type="button" className="mw-tree-row mw-group-row" onClick={() => toggle("tables")} aria-expanded={expanded.has("tables")}>
                    {expanded.has("tables") ? <CaretDown size={12} /> : <CaretRight size={12} />}
                    <FolderOpen size={15} className="mw-folder-icon" /><span>表</span><span className="mw-tree-count">(12)</span>
                  </button>
                  {expanded.has("tables") && visibleTables.map((table) => (
                    <button type="button" key={table} className={`mw-tree-row mw-table-row ${activeTable === table ? "mw-tree-selected" : ""}`} onClick={() => onOpenTable(table)}>
                      <CaretRight size={12} /><Table size={15} className="mw-blue" /><span className="mw-ellipsis">{table}</span>
                    </button>
                  ))}
                  {!onlyTables && !normalized && (
                    <>
                      <TreeGroup name="视图" count={3} icon={<Eye size={15} className="mw-view-icon" />} items={["v_order_summary", "v_customer_rank", "v_daily_sales"]} expanded={expanded.has("views")} onToggle={() => toggle("views")} onSelect={onNotice} />
                      <TreeGroup name="存储过程" count={2} icon={<FileCode size={15} className="mw-blue" />} items={["sp_update_order_status", "sp_reconcile_payments"]} expanded={expanded.has("procedures")} onToggle={() => toggle("procedures")} onSelect={onNotice} />
                      <TreeGroup name="函数" count={4} icon={<BracketsCurly size={15} className="mw-orange" />} items={["fn_calculate_amount", "fn_customer_level", "fn_format_date", "fn_tax_amount"]} expanded={expanded.has("functions")} onToggle={() => toggle("functions")} onSelect={onNotice} />
                      <button type="button" className="mw-tree-row mw-group-row" onClick={() => onNotice("用户与权限：当前连接使用只读示例数据")}><CaretRight size={12} /><UsersThree size={15} className="mw-blue" /><span>用户与权限</span></button>
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}
        {!normalized && !onlyTables && (
          <div className="mw-recent">
            <div className="mw-recent-title"><ClockCounterClockwise size={13} />最近访问</div>
            {RECENT.map((item) => <button type="button" className="mw-recent-row" key={item.name} onClick={() => item.table ? onOpenTable(item.name) : onNewQuery()}>{item.table ? <Table size={14} /> : <FileCode size={14} />}<span className="mw-ellipsis">{item.name}</span><span>{item.time}</span></button>)}
          </div>
        )}
      </div>
    </aside>
  )
}

function TreeGroup({ name, count, icon, items, expanded, onToggle, onSelect }: { name: string; count: number; icon: React.ReactNode; items: string[]; expanded: boolean; onToggle: () => void; onSelect: (message: string) => void }) {
  return <>
    <button type="button" className="mw-tree-row mw-group-row" onClick={onToggle} aria-expanded={expanded}>{expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}{icon}<span>{name}</span><span className="mw-tree-count">({count})</span></button>
    {expanded && items.map((item) => <button type="button" key={item} className="mw-tree-row mw-table-row" onClick={() => onSelect(`已选择 ${item}`)}><CaretRight size={12} /><FileCode size={14} className="mw-blue" /><span className="mw-ellipsis">{item}</span></button>)}
  </>
}
