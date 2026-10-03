"use client"

import type { DatabaseTablePage, RelationalSession, RelationalSort } from "@fouc/shared"
import { CaretUp, CaretDown } from "@phosphor-icons/react"
import { databaseCellText } from "./cell-format"
import styles from "./relational.module.css"

export function TableView({
  page,
  selectedRow,
  onSelect,
  search = "",
  sort = [],
  sortDisabled = false,
  filtered = false,
  onSort
}: {
  page: DatabaseTablePage
  selectedRow: number | null
  onSelect: (row: number) => void
  search?: string
  sort?: RelationalSort[]
  sortDisabled?: boolean
  filtered?: boolean
  onSort?: (column: string, additive: boolean) => void
}) {
  return (
    <div className="mw-result-grid">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {page.columns.map((column) => (
              <th
                key={column.name}
                aria-sort={
                  sort[0]?.column === column.name
                    ? sort[0].direction === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                <button
                  type="button"
                  className={styles.sortHeader}
                  disabled={sortDisabled}
                  aria-label={`按 ${column.name} 排序`}
                  title="点击切换数据库排序；Shift + 点击添加多字段排序"
                  onClick={(event) => onSort?.(column.name, event.shiftKey)}
                >
                  {column.name}
                  {sort.find((item) => item.column === column.name)?.direction === "asc" ? (
                    <CaretUp size={11} />
                  ) : sort.some((item) => item.column === column.name) ? (
                    <CaretDown size={11} />
                  ) : null}
                </button>
                <small>{column.dataType}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows
            .map((row, index) => ({ row, index }))
            .filter(
              ({ row }) =>
                !search ||
                row.some((cell) =>
                  databaseCellText(cell).toLocaleLowerCase().includes(search.toLocaleLowerCase())
                )
            )
            .map(({ row, index }) => (
              <tr
                key={index}
                aria-selected={selectedRow === index}
                className={selectedRow === index ? styles.selected : ""}
                onClick={() => onSelect(index)}
              >
                <td>{page.offset + index + 1}</td>
                {row.map((cell, column) => (
                  <td key={column} title={databaseCellText(cell)}>
                    {databaseCellText(cell)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {!page.rows.length && (
        <p className="mw-live-result-empty">
          {filtered ? "没有符合数据库筛选的记录。" : "表中没有记录。"}
        </p>
      )}
      {page.rows.length > 0 &&
        search &&
        !page.rows.some((row) =>
          row.some((cell) =>
            databaseCellText(cell).toLocaleLowerCase().includes(search.toLocaleLowerCase())
          )
        ) && <p className="mw-live-result-empty">当前页没有匹配记录。</p>}
    </div>
  )
}

export function RowInspector({
  session,
  page,
  selectedRow
}: {
  session: RelationalSession
  page: DatabaseTablePage | null
  selectedRow: number | null
}) {
  const selected = selectedRow !== null ? page?.rows[selectedRow] : null
  return (
    <aside className={`mw-inspector ${styles.inspector}`} aria-label="行详情">
      <div className="mw-explorer-head">
        <strong>{selected ? "行详情" : "连接信息"}</strong>
      </div>
      {selected ? (
        page?.columns.map((column, index) => (
          <div className={styles.detailField} key={column.name}>
            <small>{column.name}</small>
            <pre>{databaseCellText(selected[index] ?? null)}</pre>
          </div>
        ))
      ) : (
        <div className={styles.detailField}>
          <small>数据库</small>
          <p>{session.info.productName}</p>
          <small>驱动</small>
          <p>{session.info.driverName}</p>
          <small>版本</small>
          <p>{session.info.productVersion}</p>
        </div>
      )}
    </aside>
  )
}
