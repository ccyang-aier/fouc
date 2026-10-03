"use client"

import type { DatabaseTablePage, RelationalSession } from "@fouc/shared"
import { databaseCellText } from "./cell-format"
import styles from "./relational.module.css"

export function TableView({
  page,
  structure,
  selectedRow,
  onSelect
}: {
  page: DatabaseTablePage
  structure: boolean
  selectedRow: number | null
  onSelect: (row: number) => void
}) {
  if (structure)
    return (
      <div className="mw-result-grid">
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>类型</th>
              <th>可为空</th>
              <th>主键</th>
              <th>默认值</th>
              <th>注释</th>
            </tr>
          </thead>
          <tbody>
            {page.columns.map((column) => (
              <tr key={column.name}>
                <td>{column.name}</td>
                <td>{column.dataType}</td>
                <td>{column.isNullable ? "YES" : "NO"}</td>
                <td>{column.isPrimaryKey ? "PK" : ""}</td>
                <td>{column.columnDefault ?? "—"}</td>
                <td>{column.comment ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  return (
    <div className="mw-result-grid">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {page.columns.map((column) => (
              <th key={column.name}>
                {column.name}
                <small>{column.dataType}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row, index) => (
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
      {!page.rows.length && <p className="mw-live-result-empty">表中没有记录。</p>}
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
