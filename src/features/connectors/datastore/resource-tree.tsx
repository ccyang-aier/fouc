"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowsClockwise, CaretDoubleUp, CaretDown, CaretRight, Database, Eye, Folder, GridFour, Hash, Key, Link, List, MagnifyingGlass, Lightning, SidebarSimple } from "@phosphor-icons/react"
import type { DatabaseObjectInfo, DatabaseTablePage } from "@fouc/shared"
import type { StructureTab } from "./structure-metadata"
import { ResourceTreeControls, type ResourceKind, type ResourceSort } from "./resource-tree-controls"
import styles from "./resource-tree.module.css"

type Props = {
  name: string; schemas: string[]; schema: string; tables: DatabaseObjectInfo[]; table: string; search: string; disabled?: boolean;
  columns?: DatabaseTablePage["columns"];
  transferActions?: ReactNode;
  viewActions?: ReactNode;
  hidden: boolean; onHide: () => void;
  onSearch: (value: string) => void; onSchema: (value: string) => void; onTable: (value: string) => void; onRefresh: () => void;
  onStructure?: (table: string, section: StructureTab, column?: string) => void; onQuery?: () => void
}
const sections = [
  { key: "columns", label: "字段", icon: List, color: "columns" },
  { key: "indexes", label: "索引", icon: Key, color: "indexes" },
  { key: "foreignKeys", label: "外键", icon: Link, color: "foreignKeys" },
  { key: "triggers", label: "触发器", icon: Lightning, color: "triggers" },
] as const

export function ResourceTree({ name, schemas, schema, tables, table, search, onSearch, onSchema, onTable, onRefresh, disabled = false, columns = [], transferActions, viewActions, hidden, onHide, onStructure, onQuery }: Props) {
  const [sort, setSort] = useState<ResourceSort>("catalog")
  const [kinds, setKinds] = useState<ReadonlySet<ResourceKind>>(new Set(["table", "view"]))
  const visible = tables.filter(item => kinds.has(item.kind === "table" ? "table" : "view") && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  if (sort !== "catalog") visible.sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }) * (sort === "asc" ? 1 : -1))
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [locateRequest, setLocateRequest] = useState(0)
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (locateRequest) scroll.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [locateRequest])
  const groups = [
    { id: "tables", label: "表", items: visible.filter(item => item.kind === "table"), icon: GridFour },
    { id: "views", label: "视图", items: visible.filter(item => item.kind !== "table"), icon: Eye },
  ]
  function toggle(key: string) { setCollapsed(value => { const next = new Set(value); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  function locate() {
    const kind = tables.find(item => item.name === table)?.kind === "table" ? "table" : "view"
    onSearch("")
    setKinds(current => new Set([...current, kind]))
    setCollapsed(current => { const next = new Set(current); ["connection", `schema:${schema}`, kind === "table" ? "tables" : "views", `table:${table}`].forEach(key => next.delete(key)); return next })
    setLocateRequest(value => value + 1)
  }
  return <aside className={`${styles.tree} sidebar-material`} data-surface="database" data-hidden={hidden} aria-label="数据库资源">
    <div className={styles.toolbar}>{transferActions ?? <strong>数据库资源</strong>}<div className={styles.toolbarActions}>
      <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="刷新数据库资源" title="刷新数据库资源" disabled={disabled} onClick={onRefresh}><ArrowsClockwise size={14} /></button>
      <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="全部折叠数据库资源" title="全部折叠" disabled={disabled} onClick={() => { setCollapsed(new Set(["connection", "tables", "views", ...schemas.map(item => `schema:${item}`), `table:${table}`])); setFieldsOpen(false) }}><CaretDoubleUp size={14} /></button>
      <button type="button" className={`${styles.iconButton} fouc-action`} aria-label="收纳数据库资源" title="收纳侧栏" onClick={onHide}><SidebarSimple size={15} /></button>
    </div></div>
    <div className={styles.searchRow}>
      <label className={styles.search}><MagnifyingGlass size={14} /><input aria-label="搜索表" value={search} onChange={event => {
        onSearch(event.target.value)
        if (event.target.value) setCollapsed(current => { const next = new Set(current); ["connection", `schema:${schema}`, "tables", "views"].forEach(key => next.delete(key)); return next })
      }} placeholder="搜索表或视图" /></label>
      <ResourceTreeControls disabled={disabled} canLocate={Boolean(table)} sort={sort} kinds={kinds} onSort={setSort} onLocate={locate} onKind={(kind, visible) => setKinds(current => { const next = new Set(current); if (visible) next.add(kind); else next.delete(kind); return next })} />
    </div>
    <div className={styles.scroll} ref={scroll}>
      <button type="button" className={`${styles.row} ${styles.connection}`} aria-label={`${collapsed.has("connection") ? "展开" : "收起"}连接资源`} aria-expanded={!collapsed.has("connection")} onClick={() => toggle("connection")}>{collapsed.has("connection") ? <CaretRight size={11} /> : <CaretDown size={11} />}<Database size={15} /><strong title={name}>{name}</strong><i className={styles.online} aria-label="已连接" /></button>
      {!collapsed.has("connection") && <>
      {schemas.map(item => <div key={item}>
        <button className={`${styles.row} ${styles.schema}`} type="button" aria-expanded={schema === item && !collapsed.has(`schema:${item}`)} disabled={disabled} onClick={() => { if (schema === item) toggle(`schema:${item}`); else { setCollapsed(current => { const next = new Set(current); next.delete(`schema:${item}`); return next }); onSchema(item) } }}>{schema === item && !collapsed.has(`schema:${item}`) ? <CaretDown size={11} /> : <CaretRight size={11} />}<Database size={15} /><span title={item}>{item}</span><i className={styles.online} /></button>
        {schema === item && !collapsed.has(`schema:${item}`) && groups.filter(group => group.items.length).map(group => <div key={group.id}>
          <button type="button" className={`${styles.row} ${styles.group}`} aria-expanded={!collapsed.has(group.id)} onClick={() => toggle(group.id)}>{collapsed.has(group.id) ? <CaretRight size={11} /> : <CaretDown size={11} />}<group.icon size={15} className={group.id === "tables" ? styles.tableIcon : styles.viewIcon} /><span>{group.label}</span><small>{group.items.length}</small></button>
          {!collapsed.has(group.id) && group.items.map(entry => {
            const selected = table === entry.name
            const expanded = selected && !collapsed.has(`table:${entry.name}`)
            return <div key={entry.name}>
              <div className={`${styles.row} ${styles.table}`} data-selected={selected}>
                <button type="button" className={styles.chevron} aria-label={`${expanded ? "收起" : "展开"} ${entry.name} 对象`} disabled={disabled} aria-expanded={expanded} onClick={() => { if (!selected) onTable(entry.name); else toggle(`table:${entry.name}`) }}>{expanded ? <CaretDown size={11} /> : <CaretRight size={11} />}</button>
                <button type="button" className={styles.tableName} disabled={disabled} onClick={() => onTable(entry.name)}><group.icon size={15} className={entry.kind === "table" ? styles.tableIcon : styles.viewIcon} /><span title={entry.name}>{entry.name}</span></button>
              </div>
              {expanded && onStructure ? sections.map(section => <div key={section.key}>
                <div className={`${styles.row} ${styles.section}`}>
                  <button type="button" className={styles.chevron} disabled={disabled} aria-label={`${section.key === "columns" && fieldsOpen ? "收起" : "展开"} ${entry.name} ${section.label}`} onClick={() => section.key === "columns" ? setFieldsOpen(value => !value) : onStructure(entry.name, section.key)}>{section.key === "columns" && fieldsOpen ? <CaretDown size={11} /> : <CaretRight size={11} />}</button>
                  <button type="button" className={styles.tableName} disabled={disabled} onClick={() => onStructure(entry.name, section.key)}><section.icon size={15} className={styles[section.color]} /><span>{section.label}</span></button>
                </div>
                {section.key === "columns" && fieldsOpen ? columns.map(column => <button key={column.name} type="button" disabled={disabled} className={`${styles.row} ${styles.field}`} onClick={() => onStructure(entry.name, "columns", column.name)}>{column.isPrimaryKey ? <Key size={13} className={styles.indexes} /> : <Hash size={13} className={styles.columns} />}<span>{column.name}</span><small>{column.dataType}</small></button>) : null}
              </div>) : null}
            </div>
          })}
        </div>)}
        {schema === item && !collapsed.has(`schema:${item}`) && !visible.length ? <p className={styles.empty}>{search || kinds.size !== 2 ? "没有匹配的表或视图" : "当前 Schema 没有可见对象"}</p> : null}
      </div>)}
      {onQuery ? <button type="button" className={`${styles.row} ${styles.query}`} disabled={disabled} onClick={onQuery}><Folder size={15} /><span>查询</span></button> : null}
      </>}
    </div>
    {viewActions}
    <footer className={styles.footer}><span>{schemas.length} 个 Schema</span><span>{tables.length} 个对象</span></footer>
  </aside>
}
