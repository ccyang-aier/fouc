"use client"

import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Database,
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
        <div className="mw-tree-row">
          <Database size={16} />
          <strong>{name}</strong>
        </div>
        {schemas.map((item) => (
          <div key={item}>
            <button className="mw-tree-row" type="button" disabled={disabled} onClick={() => onSchema(item)}>
              {schema === item ? <CaretDown size={12} /> : <CaretRight size={12} />}
              <Database size={15} />
              {item}
            </button>
            {schema === item &&
              visible.map((entry) => (
                <button
                  type="button"
                  disabled={disabled}
                  key={entry.name}
                  className={`mw-tree-row mw-table-row ${table === entry.name ? "mw-tree-selected" : ""}`}
                  onClick={() => onTable(entry.name)}
                >
                  <GridFour size={14} />
                  <span>{entry.name}</span>
                  <small>{entry.kind === "table" ? "" : "视图"}</small>
                </button>
              ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
