"use client"

import { useState, type ReactNode } from "react"
import { ArrowsClockwise, CaretDown, CaretRight, Database, Eye, Folder, GridFour, Hash, Key, Link, List, MagnifyingGlass, Lightning } from "@phosphor-icons/react"
import type { DatabaseObjectInfo, DatabaseTablePage } from "@fouc/shared"
import type { StructureTab } from "./structure-metadata"
import styles from "./resource-tree.module.css"

type Props = {
  name: string; schemas: string[]; schema: string; tables: DatabaseObjectInfo[]; table: string; search: string; disabled?: boolean;
  columns?: DatabaseTablePage["columns"];
  transferActions?: ReactNode;
  onSearch: (value: string) => void; onSchema: (value: string) => void; onTable: (value: string) => void; onRefresh: () => void;
  onStructure?: (table: string, section: StructureTab, column?: string) => void; onQuery?: () => void
}
const sections = [
  { key: "columns", label: "字段", icon: List, color: "columns" },
  { key: "indexes", label: "索引", icon: Key, color: "indexes" },
  { key: "foreignKeys", label: "外键", icon: Link, color: "foreignKeys" },
  { key: "triggers", label: "触发器", icon: Lightning, color: "triggers" },
] as const

export function ResourceTree({ name, schemas, schema, tables, table, search, onSearch, onSchema, onTable, onRefresh, disabled = false, columns = [], transferActions, onStructure, onQuery }: Props) {
  const visible = tables.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const groups = [
    { id: "tables", label: "表", items: visible.filter(item => item.kind === "table"), icon: GridFour },
    { id: "views", label: "视图", items: visible.filter(item => item.kind !== "table"), icon: Eye },
  ]
  function toggle(key: string) { setCollapsed(value => { const next = new Set(value); if (next.has(key)) next.delete(key); else next.add(key); return next }) }
  return <aside className={styles.tree} aria-label="数据库资源">
    <div className={styles.toolbar}>{transferActions ?? <strong>数据库资源</strong>}<button type="button" className="fouc-action" aria-label="刷新数据库资源" disabled={disabled} onClick={onRefresh}><ArrowsClockwise size={15} /></button></div>
    <label className={styles.search}><MagnifyingGlass size={14} /><input aria-label="搜索表" value={search} onChange={event => onSearch(event.target.value)} placeholder="搜索表或视图" /></label>
    <div className={styles.scroll}>
      <div className={`${styles.row} ${styles.connection}`}><CaretDown size={11} /><Database size={15} /><strong title={name}>{name}</strong><i className={styles.online} aria-label="已连接" /></div>
      {schemas.map(item => <div key={item}>
        <button className={`${styles.row} ${styles.schema}`} type="button" aria-expanded={schema === item} disabled={disabled} onClick={() => onSchema(item)}>{schema === item ? <CaretDown size={11} /> : <CaretRight size={11} />}<Database size={15} /><span title={item}>{item}</span><i className={styles.online} /></button>
        {schema === item && groups.filter(group => group.items.length).map(group => <div key={group.id}>
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
        {schema === item && !visible.length ? <p className={styles.empty}>{search ? "没有匹配的表或视图" : "当前 Schema 没有可见对象"}</p> : null}
      </div>)}
      {onQuery ? <button type="button" className={`${styles.row} ${styles.query}`} disabled={disabled} onClick={onQuery}><Folder size={15} /><span>查询</span></button> : null}
    </div>
    <footer className={styles.footer}><span>{schemas.length} 个 Schema</span><span>{tables.length} 个对象</span></footer>
  </aside>
}
