"use client"
import { useEffect, useState } from "react"
import { ArrowLeft, Database, FileCode, GridFour } from "@phosphor-icons/react"
import type { DatabaseObjectInfo, DatabaseTablePage, RelationalSession } from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { ResourceTree } from "./resource-tree"
import { TableView, RowInspector } from "./table-view"
import { RelationalQuery } from "./relational-query"
import styles from "./relational.module.css"
import "./workbench.css"

export function RelationalWorkbench({
  session,
  name,
  onBack
}: {
  session: RelationalSession
  name: string
  onBack: () => void
}) {
  const base = `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/relational/sessions/${session.id}`
  const [schemas, setSchemas] = useState<string[]>([])
  const [schema, setSchema] = useState("")
  const [tables, setTables] = useState<DatabaseObjectInfo[]>([])
  const [table, setTable] = useState("")
  const [page, setPage] = useState<DatabaseTablePage | null>(null)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<"data" | "structure" | "sql">("data")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<string[]>(`${base}/schemas`, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) {
          setSchemas(items)
          setSchema((current) =>
            items.includes(current) ? current : items.includes("public") ? "public" : (items[0] ?? "")
          )
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
    return () => controller.abort()
  }, [base, revision])
  useEffect(() => {
    if (!schema) return
    const controller = new AbortController()
    void backendFetch<DatabaseObjectInfo[]>(`${base}/schemas/${encodeURIComponent(schema)}/tables`, {
      signal: controller.signal
    })
      .then((items) => {
        if (!controller.signal.aborted) setTables(items)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
    return () => controller.abort()
  }, [base, schema, revision])
  useEffect(() => {
    if (!schema || !table) return
    const controller = new AbortController()
    void backendFetch<DatabaseTablePage>(
      `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/rows?offset=${offset}&limit=100`,
      { signal: controller.signal }
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setPage(value)
          setBusy(false)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason.message)
          setBusy(false)
        }
      })
    return () => controller.abort()
  }, [base, schema, table, offset, revision])
  function openTable(value: string) {
    if (value === table && offset === 0) setRevision((current) => current + 1)
    setTable(value)
    setMode("data")
    setOffset(0)
    setSelectedRow(null)
    setPage(null)
    setBusy(true)
    setError("")
  }
  function refresh() {
    setError("")
    setBusy(Boolean(table))
    setRevision((value) => value + 1)
  }
  function selectSchema(value: string) {
    if (value === schema) {
      refresh()
      return
    }
    setSchema(value)
    setTables([])
    setTable("")
    setPage(null)
    setSelectedRow(null)
    setError("")
    setBusy(false)
  }
  return (
    <section aria-label={`${name} 数据库工作台`} className="mw">
      <header className="mw-breadcrumb">
        <button type="button" aria-label="返回数据库连接列表" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <span>{session.info.productName}</span>
        <span>/</span>
        <strong>{name}</strong>
        <span className={styles.readonly}>只读</span>
        <span className="mw-sql-spacer" />
        <span>{session.database}</span>
      </header>
      <div className="mw-body">
        <ResourceTree
          name={name}
          schemas={schemas}
          schema={schema}
          tables={tables}
          table={table}
          search={search}
          onSearch={setSearch}
          onSchema={selectSchema}
          onTable={openTable}
          onRefresh={refresh}
        />
        <main className="mw-center">
          <div className={styles.mobileResources}>
            <select aria-label="Schema" value={schema} onChange={(event) => selectSchema(event.target.value)}>{schemas.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="数据表" value={table} onChange={(event) => openTable(event.target.value)}><option value="" disabled>选择表或视图</option>{tables.map((item) => <option key={item.name}>{item.name}</option>)}</select>
          </div>
          <div className="mw-tab-strip">
            <div className="mw-document-tabs">
              <button
                className={`mw-document-tab ${mode !== "sql" ? "mw-document-active" : ""}`}
                type="button"
                onClick={() => setMode("data")}
              >
                <GridFour size={15} />
                {table || "数据浏览"}
              </button>
              <button
                className={`mw-document-tab ${mode === "sql" ? "mw-document-active" : ""}`}
                type="button"
                onClick={() => setMode("sql")}
              >
                <FileCode size={15} />
                SQL 查询
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
              <button type="button" onClick={refresh}>
                重试
              </button>
            </p>
          )}
          <div hidden={mode !== "sql"} className={styles.queryPanel}>
            <RelationalQuery session={session} schema={schema} />
          </div>
          {mode !== "sql" && (
            <>
              <div className="mw-sql-toolbar">
                <button
                  type="button"
                  className={mode === "data" ? "mw-active-button" : ""}
                  onClick={() => setMode("data")}
                >
                  数据
                </button>
                <button
                  type="button"
                  disabled={!table}
                  className={mode === "structure" ? "mw-active-button" : ""}
                  onClick={() => setMode("structure")}
                >
                  结构
                </button>
                <span className="mw-sql-spacer" />
                <span>
                  {schema}
                  {table ? `.${table}` : ""}
                </span>
              </div>
              {busy ? (
                <p className="mw-live-result-empty" role="status">
                  正在读取表数据…
                </p>
              ) : !page ? (
                <div className={styles.empty}>
                  <Database size={32} />
                  <strong>选择一个表开始浏览</strong>
                  <span>或打开 SQL 查询，在当前 Schema 中执行语句。</span>
                </div>
              ) : (
                <TableView
                  page={page}
                  structure={mode === "structure"}
                  selectedRow={selectedRow}
                  onSelect={setSelectedRow}
                />
              )}
              {page && (
                <footer className="mw-result-footer">
                  <span>
                    {page.rows.length} 行 · 从第 {offset + 1} 行开始
                  </span>
                  <div className={styles.paging}>
                    <button
                      type="button"
                      disabled={!offset || busy}
                      onClick={() => {
                        setBusy(true)
                        setSelectedRow(null)
                        setOffset((value) => Math.max(0, value - 100))
                      }}
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      disabled={!page.hasMore || busy}
                      onClick={() => {
                        setBusy(true)
                        setSelectedRow(null)
                        setOffset((value) => value + 100)
                      }}
                    >
                      下一页
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </main>
        <RowInspector session={session} page={page} selectedRow={mode === "sql" ? null : selectedRow} />
      </div>
    </section>
  )
}
