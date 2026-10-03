"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Database, FileCode, GridFour, Info, Lock, LockOpen } from "@phosphor-icons/react"
import type {
  DatabaseObjectInfo,
  RelationalTablePage,
  RelationalTableQuery,
  RelationalSession
} from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { ResourceTree } from "./resource-tree"
import { TableView, RowInspector } from "./table-view"
import { RelationalQuery } from "./relational-query"
import { TableEditing } from "./table-editing"
import { TableQueryControls } from "./table-query-controls"
import { TableStructure } from "./table-structure"
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
  const [page, setPage] = useState<RelationalTablePage | null>(null)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<"data" | "structure" | "sql">("data")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState(session)
  const [pending, setPending] = useState(false)
  const [writeBusy, setWriteBusy] = useState(false)
  const sqlBeforeLeave = useRef<(() => Promise<void>) | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const clearLeaveError = useCallback(() => setLeaveError(''), [])
  async function leave() {
    if (leaving || pending) return
    setLeaving(true); setLeaveError('')
    try { await sqlBeforeLeave.current?.(); onBack() }
    catch (reason) { setLeaveError(reason instanceof Error ? reason.message : '草稿保存失败，当前工作台保持打开') }
    finally { setLeaving(false) }
  }
  const [feedback, setFeedback] = useState("")
  const [limit, setLimit] = useState(100)
  const [query, setQuery] = useState<RelationalTableQuery>({
    filter: null,
    sort: []
  })
  const [pageSearch, setPageSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const writable =
    currentSession.capabilities.capabilities.tableDataEdit &&
    !currentSession.capabilities.restrictions.readOnly
  async function toggleWriteAccess() {
    setWriteBusy(true)
    setError("")
    try {
      setCurrentSession(
        await backendFetch<RelationalSession>(`${base}/write-access`, {
          method: "PUT",
          body: JSON.stringify({ enabled: !writable })
        })
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "切换写入权限失败")
    } finally {
      setWriteBusy(false)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void backendFetch<string[]>(`${base}/schemas`, {
      signal: controller.signal
    })
      .then((items) => {
        if (!controller.signal.aborted) {
          setSchemas(items)
          setSchema((current) =>
            items.includes(current)
              ? current
              : session.provider === "mysql" && items.includes(session.database)
                ? session.database
                : items.includes("public")
                  ? "public"
                  : (items[0] ?? "")
          )
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
    return () => controller.abort()
  }, [base, revision, session.database, session.provider])
  useEffect(() => {
    if (!schema) return
    const controller = new AbortController()
    void backendFetch<DatabaseObjectInfo[]>(
      `${base}/schemas/${encodeURIComponent(schema)}/tables`,
      {
        signal: controller.signal
      }
    )
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
    void backendFetch<RelationalTablePage>(
      `${base}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}/rows`,
      {
        method: "POST",
        body: JSON.stringify({ ...query, offset, limit }),
        signal: controller.signal
      }
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
  }, [base, schema, table, offset, limit, query, revision])
  function openTable(value: string) {
    if (value === table && offset === 0) setRevision((current) => current + 1)
    setTable(value)
    setMode("data")
    setOffset(0)
    setSelectedRow(null)
    setPage(null)
    setBusy(true)
    setError("")
    setFeedback("")
    if (value !== table) {
      setQuery({ filter: null, sort: [] })
      setPageSearch("")
      setFiltersOpen(false)
    }
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
    setQuery({ filter: null, sort: [] })
    setPageSearch("")
    setFiltersOpen(false)
  }
  function applyQuery(value: RelationalTableQuery) {
    setQuery(value)
    setOffset(0)
    setBusy(true)
    setSelectedRow(null)
    setError("")
    setFeedback("")
    setPageSearch("")
  }
  function sortColumn(column: string, additive: boolean) {
    const existing = query.sort.find((item) => item.column === column)
    const next =
      existing?.direction === "desc"
        ? null
        : {
            column,
            direction: existing ? ("desc" as const) : ("asc" as const),
            nulls: "last" as const
          }
    const others = additive ? query.sort.filter((item) => item.column !== column) : []
    if (next && others.length >= 8) {
      setError("最多按 8 个字段排序，请先移除已有规则")
      return
    }
    applyQuery({ ...query, sort: next ? [...others, next] : others })
  }
  return (
    <section aria-label={`${name} 数据库工作台`} className="mw">
      <header className="mw-breadcrumb">
        <button
          type="button"
          aria-label="返回数据库连接列表"
          disabled={pending || leaving}
          title={pending ? "先提交或放弃待提交变更" : "返回连接列表"}
          onClick={() => void leave()}
        >
          <ArrowLeft size={16} />
        </button>
        <span className={styles.connectionMark}><Database size={17} /></span>
        <strong className={styles.breadcrumbName} title={name}>
          {name}
        </strong>
        <span className={styles.providerLabel}>{session.info.productName}</span>
        <span className={styles.connected}><i />已连接</span>
        <span className="mw-sql-spacer" />
        <button
          type="button"
          className={styles.writeAccess}
          aria-label={writeBusy ? "切换中…" : writable ? "锁定表格写入" : "解锁表格写入"}
          disabled={pending || writeBusy}
          onClick={() => void toggleWriteAccess()}
        >
          {writable ? <LockOpen size={14} /> : <Lock size={14} />}
          <span>{writeBusy ? "切换中…" : writable ? "锁定表格写入" : "解锁表格写入"}</span>
        </button>
        {pending && <small className={styles.pendingLabel}>有待提交变更</small>}
        <span className={styles.databaseLabel} title={session.database}>
          {session.database}
        </span>
        <button type="button" aria-label="连接信息与行详情" aria-pressed={inspectorOpen} title="连接信息与行详情" onClick={() => setInspectorOpen((value) => !value)}><Info size={17} /></button>
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
          disabled={pending}
        />
        <main className="mw-center">
          <div className={styles.mobileResources}>
            <select
              aria-label="Schema"
              disabled={pending}
              value={schema}
              onChange={(event) => selectSchema(event.target.value)}
            >
              {schemas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="数据表"
              disabled={pending}
              value={table}
              onChange={(event) => openTable(event.target.value)}
            >
              <option value="" disabled>
                选择表或视图
              </option>
              {tables.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="mw-tab-strip">
            <div className="mw-document-tabs">
              <button
                aria-pressed={mode !== "sql"}
                className={`mw-document-tab ${mode !== "sql" ? "mw-document-active" : ""}`}
                type="button"
                onClick={() => setMode("data")}
              >
                <GridFour size={15} />
                {table || "数据浏览"}
              </button>
              <button
                aria-pressed={mode === "sql"}
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
          {leaveError && <p role="alert" className={styles.error}>暂时无法返回：{leaveError}。</p>}
          {feedback && (
            <p className={styles.saveFeedback} role="status">
              {feedback}
            </p>
          )}
          <div hidden={mode !== "sql"} className={styles.queryPanel}>
            <RelationalQuery key={session.id} session={session} schema={schema} schemas={schemas} metadataRevision={revision} schemaLocked={pending} onSchemaChange={selectSchema} beforeLeaveRef={sqlBeforeLeave} onLeaveReady={clearLeaveError} />
          </div>
          {page && (
            <div hidden={mode !== "data"}>
              <TableQueryControls
                key={`${schema}:${page.table}:${JSON.stringify(query)}`}
                base={base}
                schema={schema}
                page={page}
                query={query}
                limit={limit}
                search={pageSearch}
                open={filtersOpen}
                disabled={pending}
                busy={busy}
                onToggle={() => setFiltersOpen((value) => !value)}
                onSearch={(value) => {
                  setPageSearch(value)
                  setSelectedRow(null)
                }}
                onApply={applyQuery}
                onLimit={(value) => {
                  setLimit(value)
                  setOffset(0)
                  setBusy(true)
                  setSelectedRow(null)
                }}
                onRefresh={refresh}
              />
              <TableEditing
                key={`${schema}:${page.table}`}
                base={base}
                schema={schema}
                page={page}
                selectedRow={selectedRow}
                writable={writable}
                disabled={busy || tables.find((item) => item.name === table)?.kind !== "table"}
                onPending={setPending}
                onSaved={(message) => {
                  setFeedback(message)
                  setSelectedRow(null)
                  refresh()
                }}
              />
            </div>
          )}
          {mode !== "sql" && (
            <>
              <div className="mw-sql-toolbar">
                <button
                  type="button"
                  aria-pressed={mode === "data"}
                  className="mw-data-view-button"
                  onClick={() => setMode("data")}
                >
                  数据
                </button>
                <button
                  type="button"
                  disabled={!table}
                  aria-pressed={mode === "structure"}
                  className="mw-data-view-button"
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
              {mode === "structure" && table ? (
                <TableStructure
                  key={`${schema}:${table}`}
                  base={base}
                  schema={schema}
                  table={table}
                  revision={revision}
                  pending={pending}
                  onOpenTable={(nextSchema, nextTable) => {
                    selectSchema(nextSchema)
                    openTable(nextTable)
                  }}
                />
              ) : busy ? (
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
                  selectedRow={selectedRow}
                  onSelect={(row) => { setSelectedRow(row); setInspectorOpen(true) }}
                  search={pageSearch}
                  sort={query.sort}
                  sortDisabled={busy || pending}
                  filtered={query.filter !== null}
                  onSort={sortColumn}
                />
              )}
              {page && mode === "data" && (
                <footer className="mw-result-footer">
                  <span>
                    {page.rows.length} 行{page.rows.length ? ` · 从第 ${offset + 1} 行开始` : ""}
                    {pageSearch
                      ? " · 搜索仅作用于当前页"
                      : page.stableOrder
                        ? " · 已包含主键排序"
                        : " · 无主键，分页顺序可能变化"}
                  </span>
                  <div className={styles.paging}>
                    <button
                      type="button"
                      disabled={!offset || busy || pending}
                      onClick={() => {
                        setBusy(true)
                        setSelectedRow(null)
                        setOffset((value) => Math.max(0, value - limit))
                      }}
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      disabled={!page.hasMore || busy || pending}
                      onClick={() => {
                        setBusy(true)
                        setSelectedRow(null)
                        setOffset((value) => value + limit)
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
        {inspectorOpen && <RowInspector
          session={session}
          name={name}
          onClose={() => setInspectorOpen(false)}
          page={page}
          selectedRow={mode === "sql" ? null : selectedRow}
        />}
      </div>
    </section>
  )
}
