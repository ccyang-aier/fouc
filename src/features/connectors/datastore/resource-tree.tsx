"use client"

import { useState } from 'react'
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Database,
  Eye,
  Folder,
  GridFour,
  MagnifyingGlass
} from "@phosphor-icons/react"
import type { DatabaseObjectInfo } from "@fouc/shared"

type Props = {
  name: string
  schemas: string[]
  schema: string
  tables: DatabaseObjectInfo[]
  table: string
  search: string
  disabled?: boolean
  onSearch: (value: string) => void
  onSchema: (value: string) => void
  onTable: (value: string) => void
  onRefresh: () => void
}
export function ResourceTree({
  name,
  schemas,
  schema,
  tables,
  table,
  search,
  onSearch,
  onSchema,
  onTable,
  onRefresh,
  disabled = false
}: Props) {
  const visible = tables.filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const groups = [
    { id: 'tables', label: '表', items: visible.filter((item) => item.kind === 'table'), icon: GridFour },
    { id: 'views', label: '视图', items: visible.filter((item) => item.kind !== 'table'), icon: Eye }
  ]
  return (
    <aside className="mw-explorer" aria-label="数据库资源">
      <div className="mw-explorer-head">
        <strong>数据库资源</strong>
        <button
          className="mw-icon-button"
          type="button"
          aria-label="刷新数据库资源"
          disabled={disabled}
          onClick={onRefresh}
        >
          <ArrowsClockwise size={15} />
        </button>
      </div>
      <div className="mw-search-row">
        <label className="mw-search">
          <MagnifyingGlass size={14} />
          <input
            aria-label="搜索表"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="搜索表或视图"
          />
        </label>
      </div>
      <div className="mw-tree-scroll">
        <div className="mw-tree-row mw-connection-row">
          <Database size={16} />
          <strong className="mw-ellipsis" title={name}>{name}</strong>
          <i className="mw-online-dot" aria-label="已连接" />
        </div>
        {schemas.map((item) => (
          <div key={item}>
            <button className="mw-tree-row mw-schema-row" type="button" aria-expanded={schema === item} disabled={disabled} onClick={() => onSchema(item)}>
              {schema === item ? <CaretDown size={12} /> : <CaretRight size={12} />}
              <Database size={15} className="mw-schema-icon" />
              <span className="mw-ellipsis" title={item}>{item}</span>
            </button>
            {schema === item && groups.filter((group) => group.items.length).map((group) => <div key={group.id}>
              <button type="button" className="mw-tree-row mw-group-row" aria-expanded={!collapsed.has(group.id)} onClick={() => setCollapsed((value) => {
                const next = new Set(value); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next
              })}>{collapsed.has(group.id) ? <CaretRight size={12} /> : <CaretDown size={12} />}<Folder size={15} className="mw-folder-icon" /><span>{group.label}</span><small className="mw-tree-count">{group.items.length}</small></button>
              {!collapsed.has(group.id) && group.items.map((entry) => (
                <button
                  type="button"
                  disabled={disabled}
                  key={entry.name}
                  className={`mw-tree-row mw-table-row ${table === entry.name ? "mw-tree-selected" : ""}`}
                  onClick={() => onTable(entry.name)}
                >
                  <group.icon size={15} className={entry.kind === 'table' ? 'mw-table-icon' : 'mw-view-icon'} />
                  <span className="mw-ellipsis" title={entry.name}>{entry.name}</span>
                </button>
              ))}</div>)}
            {schema === item && !visible.length && <p className="mw-tree-empty">{search ? '没有匹配的表或视图' : '当前 Schema 没有可见对象'}</p>}
          </div>
        ))}
      </div>
      <footer className="mw-explorer-footer"><span>{schemas.length} 个 Schema</span><span>{tables.length} 个对象</span></footer>
    </aside>
  )
}
