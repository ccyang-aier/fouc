"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpenText, Database, FileCode, Graph, GridFour, Info, Lock, LockOpen } from "@phosphor-icons/react"
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
import type { GridEditDraft, GridEditCell, GridEditSelection } from './grid-editing'
import { TableQueryControls } from "./table-query-controls"
import { TableStructure } from "./table-structure"
import { TableImportAction } from './table-import-action'
import { TestDataAction } from './test-data-action'
import { DatabaseActivityPanel } from './activity'
import { Pulse } from '@phosphor-icons/react/dist/csr/Pulse'
import { SchemaCompareAction } from './schema-compare-action'
import { StructureEditAction } from './structure-edit-action'
import { SchemaObjectsPanel } from './schema-objects'
import { TableTransferAction } from './table-transfer-action'
import { DatabaseExportAction } from './database-export'
import { DatabaseDocsPanel } from './database-docs'
import { SchemaSearchAction } from './schema-search'
import { SqliteBackupAction } from './sqlite-backup/action'
import { DatabaseSecurityAction } from './security/action'
import { DatabaseAdminObjectsAction } from './admin-objects'
import { TableClearAction } from './table-clear/action'
import { SchemaCreateAction } from './schema-create'
import { TableCreateAction } from './table-create'
import { SchemaDiagramView } from './schema-diagram-action'
import type { SchemaObject, SchemaSearchHit } from '@fouc/shared'
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
  const base = `/api/database/relational/sessions/${session.id}`
  const [schemas, setSchemas] = useState<string[]>([])
  const [schema, setSchema] = useState("")
  const [tables, setTables] = useState<DatabaseObjectInfo[]>([])
  const [table, setTable] = useState("")
  const [page, setPage] = useState<RelationalTablePage | null>(null)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<"data" | "structure" | "sql" | "objects" | "diagram" | "docs" | "activity">("data")
  const [initialObject, setInitialObject] = useState<SchemaObject | null>(null)
  const [initialColumn, setInitialColumn] = useState<string | undefined>()
  const [openRequest, setOpenRequest] = useState<{ id: string; sql: string; schema: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<GridEditDraft[]>([])
  const [selection, setSelection] = useState<GridEditSelection | null>(null), [activeCell, setActiveCell] = useState<GridEditCell | null>(null)
  const gridHost = useRef<HTMLElement>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState(session)
  const [gridPending, setPending] = useState(false)
  const [mutationBusy, setMutationBusy] = useState(false)
  const pending = gridPending || mutationBusy
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
  async function unlockSqlWrite(): Promise<void> {
    setWriteBusy(true)
    try {
      setCurrentSession(await backendFetch<RelationalSession>(`${base}/write-access`, {
        method: 'PUT', body: JSON.stringify({ enabled: true })
      }))
    } finally { setWriteBusy(false) }
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
  function openSearchHit(hit: SchemaSearchHit) {
    if (pending) return
    selectSchema(hit.schema)
    setInspectorOpen(false)
    setInitialColumn(undefined)
    if (hit.kind === 'schema') { setInitialObject(null); setMode('objects'); return }
    if (hit.kind === 'table' || hit.kind === 'column') {
      openTable(hit.kind === 'column' ? hit.parentName! : hit.name)
      if (hit.kind === 'column') { setInitialColumn(hit.column ?? hit.name); setMode('structure') }
      return
    }
    if (hit.object) { setInitialObject(hit.object); setMode('objects') }
    else if (hit.relation) openTable(hit.relation.name)
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
        <TableCreateAction session={currentSession} base={base} schema={schema} writable={writable} disabled={pending || busy || writeBusy} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onCreated={refresh} />
        <SchemaCreateAction session={currentSession} base={base} writable={writable} disabled={pending || busy || writeBusy} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onCreated={() => { refresh(); setFeedback('创建流程已结束，正在刷新资源目录；请以目录实际结果为准。') }} />
        <SchemaSearchAction base={base} session={session} connectionLabel={name} currentSchema={schema} disabled={pending || leaving} onOpen={openSearchHit} onNotice={setFeedback} />
        <SqliteBackupAction session={currentSession} base={base} disabled={pending || leaving || writeBusy} />
        <DatabaseSecurityAction base={base} session={currentSession} schema={schema} disabled={pending || leaving || writeBusy} />
        <DatabaseAdminObjectsAction base={base} session={currentSession} schema={schema} disabled={pending || leaving || writeBusy} />
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
        <main className="mw-center" ref={gridHost}>
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
                aria-pressed={mode === "data" || mode === "structure"}
                className={`mw-document-tab ${mode === "data" || mode === "structure" ? "mw-document-active" : ""}`}
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
                onClick={() => { setInspectorOpen(false); setMode("sql") }}
              >
                <FileCode size={15} />
                SQL 查询
              </button>
              <button type="button" disabled={pending || !schema} aria-pressed={mode === "objects"} className={`mw-document-tab ${mode === "objects" ? "mw-document-active" : ""}`} onClick={() => { setInitialObject(null); setInspectorOpen(false); setMode("objects") }}><Database size={15} />Schema 对象</button>
              <button type="button" disabled={pending || !schema} aria-pressed={mode === "diagram"} className={`mw-document-tab ${mode === "diagram" ? "mw-document-active" : ""}`} onClick={() => { setInspectorOpen(false); setMode("diagram") }}><Graph size={15} />关系图</button>
              <button type="button" disabled={pending || !schema} aria-pressed={mode === "docs"} className={`mw-document-tab ${mode === "docs" ? "mw-document-active" : ""}`} onClick={() => { setInspectorOpen(false); setMode("docs") }}><BookOpenText size={15} />数据库文档</button>
              <button type="button" disabled={pending} aria-pressed={mode === 'activity'} className={`mw-document-tab ${mode === 'activity' ? 'mw-document-active' : ''}`} onClick={() => { setInspectorOpen(false); setMode('activity') }}><Pulse size={15}/>活动监控</button>
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
            <RelationalQuery key={session.id} session={currentSession} schema={schema} schemas={schemas} metadataRevision={revision} schemaLocked={pending} onSchemaChange={selectSchema} beforeLeaveRef={sqlBeforeLeave} onLeaveReady={clearLeaveError} openRequest={openRequest} onUnlockWrite={unlockSqlWrite} onMutated={refresh} onMutationBusy={setMutationBusy} />
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
                provider={session.provider} selection={selection} activeCell={activeCell} shortcutTarget={gridHost} onDraftsChange={setDrafts}
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
          {mode === "objects" && schema && <SchemaObjectsPanel base={base} provider={session.provider} schema={schema} initialObject={initialObject} onOpenReference={reference => { if (reference.kind === "table" || reference.kind === "view" || reference.kind === "materialized-view") { if (reference.schema) selectSchema(reference.schema); openTable(reference.name) } }} />}
          {mode === 'diagram' && schema && <SchemaDiagramView key={`${base}:${schema}`} base={base} schema={schema} onOpenTable={node => { selectSchema(node.schema); openTable(node.table) }} onOpenQuery={sql => { setOpenRequest({ id: crypto.randomUUID(), sql, schema }); setMode('sql') }} />}
          {mode === 'docs' && schema && <DatabaseDocsPanel base={base} schemas={[schema]} persistent={Boolean(session.connectionId)} onOpenTable={(nextSchema, nextTable) => { selectSchema(nextSchema); openTable(nextTable) }} />}
          {mode === 'activity' && <DatabaseActivityPanel base={base} provider={session.provider} database={session.database} blocked={pending || writeBusy} />}
          {(mode === 'data' || mode === 'structure') && (
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
                <DatabaseExportAction session={session} schemas={schemas} schema={schema} table={table} tables={tables} disabled={pending || busy || writeBusy} />
                <TableTransferAction session={session} name={name} schema={schema} table={table} disabled={pending || busy || writeBusy} />
                <TableImportAction base={base} sessionId={session.id} provider={session.provider} schema={schema} page={page} disabled={!writable || pending || busy || writeBusy} onImported={refresh} />
                <TestDataAction session={currentSession} base={base} schema={schema} table={table} writable={writable} disabled={pending || busy || writeBusy} onUnlock={unlockSqlWrite} onImported={refresh} onBusyChange={setMutationBusy} />
                <SchemaCompareAction base={base} provider={session.provider} schema={schema} table={table} tables={tables} schemas={schemas} disabled={pending || busy} />
                <StructureEditAction base={base} schema={schema} table={table} disabled={!writable || !table || pending || busy || writeBusy} onApplied={refresh} />
                <TableClearAction base={base} session={currentSession} schema={schema} table={table} writable={writable} disabled={!table || tables.find(item => item.name === table)?.kind !== 'table' || pending || busy || writeBusy} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onCleared={() => { setSelectedRow(null); setActiveCell(null); setSelection(null); refresh() }} />
                <span>
                  {schema}
                  {table ? `.${table}` : ""}
                </span>
              </div>
              {mode === "structure" && table ? (
                <TableStructure
                  session={currentSession}
                  writable={writable}
                  onUnlock={unlockSqlWrite}
                  onBusyChange={setMutationBusy}
                  onStructureChanged={refresh}
                  onWriteAccessChanged={setCurrentSession}
                  key={`${schema}:${table}:${initialColumn ?? ''}`}
                  base={base}
                  schema={schema}
                  table={table}
                  revision={revision}
                  pending={pending}
                  initialColumn={initialColumn}
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
                  drafts={drafts} onSelectionChange={setSelection} onCellSelect={setActiveCell}
                  provider={session.provider}
                  schema={schema}
                  scopeKey={`${base}:${schema}:${table}:${page.offset}:${JSON.stringify(query)}:${pageSearch}`}
                  layoutScopeKey={`${session.connectionId ?? session.id}:${session.database}:${schema}:${table}`}
                  onSelect={(row) => { setSelectedRow(row); if (row !== null) setInspectorOpen(true) }}
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
