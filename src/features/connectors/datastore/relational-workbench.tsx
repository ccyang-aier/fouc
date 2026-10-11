"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowsDownUp, Database, GridFour, Lock, LockOpen, Plus, SidebarSimple } from "@phosphor-icons/react"
import type {
  DatabaseObjectInfo,
  RelationalTablePage,
  RelationalTableQuery,
  RelationalSession
} from "@fouc/shared"
import { backendFetch } from "@/lib/backend"
import { Button } from "@/components/ui/button"
import { useAppAlert } from "@/components/app-alert-provider"
import { ResourceTree } from "./resource-tree"
import { TableView } from "./table-view"
import { WorkbenchConnectionInfo } from "./workbench-connection-info"
import { RelationalQuery } from "./relational-query"
import { TableEditing } from "./table-editing"
import type { GridEditDraft, GridEditCell, GridEditSelection } from './grid-editing'
import type { TableGridCommandHandle } from './grid/context-actions'
import { databaseColumnValueFilter, removeDatabaseColumnFilter } from './grid/column-filter-model'
import { TableQueryControls } from "./table-query-controls"
import { TablePagination } from "./table-pagination"
import { useTablePageSize } from "./use-table-page-size"
import { TableStructure } from "./table-structure"
import { TableImportAction } from './table-import-action'
import { TestDataAction } from './test-data-action'
import { DatabaseActivityPanel } from './activity'
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
import { WorkbenchShortcuts, WorkbenchTabs, type WorkbenchMode } from "./workbench-tabs"
import { WorkbenchMetadata } from "./workbench-metadata"
import { WorkbenchMenu } from "./workbench-menu"
import { SqlDialog } from "./sql-library-dialog"
import type { StructureTab } from "./structure-metadata"
import nativeStyles from "./dbx-workbench.module.css"
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
  const [resourcesHidden, setResourcesHidden] = useState(false)
  const [resourceWidth, setResourceWidth] = useState<number | undefined>()
  const [mode, setMode] = useState<WorkbenchMode>("data")
  const [openedViews, setOpenedViews] = useState<WorkbenchMode[]>([])
  const [sqlTabsTarget, setSqlTabsTarget] = useState<HTMLDivElement | null>(null)
  const [structureTab, setStructureTab] = useState<StructureTab>("columns")
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [gridHeaderTarget, setGridHeaderTarget] = useState<HTMLElement | null>(null)
  const [gridToolsTarget, setGridToolsTarget] = useState<HTMLElement | null>(null)
  const [rowActionTarget, setRowActionTarget] = useState<HTMLElement | null>(null)
  const [footerExportTarget, setFooterExportTarget] = useState<HTMLElement | null>(null)
  const [initialObject, setInitialObject] = useState<SchemaObject | null>(null)
  const [initialStructureSearch, setInitialStructureSearch] = useState<string | undefined>()
  const [openRequest, setOpenRequest] = useState<{ id: string; sql: string; schema: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [drafts, setDrafts] = useState<GridEditDraft[]>([])
  const [selection, setSelection] = useState<GridEditSelection | null>(null), [activeCell, setActiveCell] = useState<GridEditCell | null>(null)
  const gridHost = useRef<HTMLElement>(null)
  const gridCommands = useRef<TableGridCommandHandle | null>(null)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
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
  const alerts = useAppAlert()
  const { defaultSize, setDefault } = useTablePageSize(JSON.stringify([session.connectionId ?? session.id, session.provider === 'mysql' ? schema || session.database : session.database]))
  const [customLimit, setCustomLimit] = useState<number | undefined>()
  const limit = customLimit ?? defaultSize
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
    const startedAt = performance.now()
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
          setLoadTimeMs(Math.round(performance.now() - startedAt))
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
    setStructureTab("columns")
    setMode("data")
    setOffset(0)
    setSelectedRow(null)
    setPage(null)
    setBusy(true)
    setError("")
    setFeedback("")
    if (value !== table) {
      setCustomLimit(undefined)
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
  function navigatePage(nextOffset: number) { if (!busy && !pending && !leaving && nextOffset !== offset) { setBusy(true); setSelectedRow(null); setOffset(nextOffset) } }
  function changeLimit(value: number) { if (!busy && !pending && !leaving && (value !== limit || offset)) { setCustomLimit(value); setOffset(0); setBusy(true); setSelectedRow(null) } }
  function defaultLimit(value: number) {
    if (busy || pending || leaving) return
    changeLimit(value)
    if (setDefault(value)) alerts.notify('success', `默认每页行数已设为 ${value}`)
    else alerts.notify('warning', '行数已应用，无法保存默认值')
  }
  function closeTable() { setTable(''); setPage(null); setSelectedRow(null); setMode('data') }
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
    setInitialStructureSearch(undefined)
    if (hit.kind === 'schema') { changeView('objects'); return }
    if (hit.kind === 'table' || hit.kind === 'column') {
      openTable(hit.kind === 'column' ? hit.parentName! : hit.name)
      if (hit.kind === 'column') { setInitialStructureSearch(hit.column ?? hit.name); setMode('structure') }
      return
    }
    if (hit.object) { changeView('objects'); setInitialObject(hit.object) }
    else if (hit.relation) openTable(hit.relation.name)
  }
  function changeView(next: WorkbenchMode) {
    if (pending) return
    if (next === "objects") setInitialObject(null)
    if (next !== "data" && next !== "structure") setOpenedViews(current => current.includes(next) ? current : [...current, next])
    setMode(next)
  }
  async function closeView(view: WorkbenchMode) {
    if (pending || leaving) return
    setLeaving(true); setLeaveError('')
    try {
      if (view === "sql") await sqlBeforeLeave.current?.()
      setOpenedViews(current => current.filter(value => value !== view))
      if (mode === view) setMode("data")
    } catch (reason) { setLeaveError(reason instanceof Error ? reason.message : '草稿保存失败，当前视图保持打开') }
    finally { setLeaving(false) }
  }
  return (
    <section aria-label={`${name} 数据库工作台`} className={`mw ${nativeStyles.shell}`}>
      <header className="mw-breadcrumb">
        <button
          type="button"
          className="fouc-action"
          data-surface="subtle"
          aria-label="返回数据库连接列表"
          disabled={pending || leaving}
          title={pending ? "先提交或放弃待提交变更" : "返回连接列表"}
          onClick={() => void leave()}
        >
          <ArrowLeft size={16} />
        </button>
        {resourcesHidden && <button type="button" className="fouc-action" data-surface="subtle" aria-label="展开数据库资源" title="展开数据库资源" onClick={() => setResourcesHidden(false)}><SidebarSimple size={16} /></button>}
        <strong className={styles.breadcrumbName} title={name}>
          {name}
        </strong>
        <span className={styles.providerLabel}>{session.info.productName}</span>
        <span className={styles.connected}><i />已连接</span>
        <span className="mw-sql-spacer" />
        <div className={nativeStyles.connectionActions} role="group" aria-label="连接操作">
          <div className={nativeStyles.commandGroup} role="group" aria-label="创建与查找">
            <WorkbenchMenu label="新建" icon={<Plus size={16} />} disabled={pending || busy || writeBusy}>
              <TableCreateAction session={currentSession} base={base} schema={schema} writable={writable} disabled={pending || busy || writeBusy} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onCreated={refresh} />
              <SchemaCreateAction session={currentSession} base={base} writable={writable} disabled={pending || busy || writeBusy} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onCreated={() => { refresh(); setFeedback('创建流程已结束，正在刷新资源目录；请以目录实际结果为准。') }} />
            </WorkbenchMenu>
            <SchemaSearchAction base={base} session={session} connectionLabel={name} currentSchema={schema} disabled={pending || leaving} onOpen={openSearchHit} onNotice={setFeedback} />
          </div>
          <div className={nativeStyles.commandGroup} role="group" aria-label="数据库管理">
            <SqliteBackupAction session={currentSession} base={base} disabled={pending || leaving || writeBusy} />
            <DatabaseSecurityAction base={base} session={currentSession} schema={schema} disabled={pending || leaving || writeBusy} />
            <DatabaseAdminObjectsAction base={base} session={currentSession} schema={schema} disabled={pending || leaving || writeBusy} />
          </div>
          <div className={nativeStyles.commandGroup} role="group" aria-label="写入与连接信息">
            <Button
              type="button"
              variant="ghost"
              className={nativeStyles.writeAccess}
              data-active={writable}
              aria-label={writable ? "锁定表格写入" : "解锁表格写入"}
              aria-pressed={writable}
              title={writable ? "锁定表格写入" : "解锁表格写入"}
              loading={writeBusy}
              disabled={pending}
              onClick={() => void toggleWriteAccess()}
            >
              {writable ? <LockOpen size={16} /> : <Lock size={16} />}
              <span>{writable ? "锁定写入" : "解锁写入"}</span>
            </Button>
            {pending && <small className={styles.pendingLabel}>有待提交变更</small>}
            <WorkbenchConnectionInfo session={session} name={name} page={page} selectedRow={mode === "data" ? selectedRow : null} />
          </div>
        </div>
      </header>
      <div className="mw-body">
        <ResourceTree
          key={`${base}:${schema}`} base={base} revision={revision}
          hidden={resourcesHidden} onHide={() => setResourcesHidden(true)}
          width={resourceWidth} onWidthChange={setResourceWidth}
          transferActions={<WorkbenchMenu label="导入/导出" icon={<ArrowsDownUp size={15} />} align="start" disabled={pending || busy || writeBusy}>
            <DatabaseExportAction session={session} schemas={schemas} schema={schema} table={table} tables={tables} disabled={pending || busy || writeBusy} />
            <TableImportAction base={base} sessionId={session.id} provider={session.provider} schema={schema} page={page} disabled={!writable || pending || busy || writeBusy} onImported={refresh} />
          </WorkbenchMenu>}
          name={name}
          viewActions={<WorkbenchShortcuts mode={mode} disabled={pending || leaving} onChange={changeView} />}
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
          onQuery={() => changeView("sql")}
          onStructure={(nextTable, section, record) => { openTable(nextTable); setStructureTab(section); setInitialStructureSearch(record); setMode("structure") }}
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
          <WorkbenchTabs table={table} schema={schema} mode={mode} openedViews={openedViews} disabled={pending || leaving} onChange={changeView} onCloseView={view => void closeView(view)} onCloseTable={closeTable} onNewQuery={() => { setOpenRequest({ id: crypto.randomUUID(), sql: "", schema }); changeView("sql") }} onSqlTabsTarget={setSqlTabsTarget} />
          {(mode === "data" || mode === "structure") && <WorkbenchMetadata table={table} schema={schema} columnCount={page?.table === table ? page.columns.length : 0} pending={pending} onProperties={() => setPropertiesOpen(true)} onGridHeader={setGridHeaderTarget} onGridTools={setGridToolsTarget}
            structureAction={<StructureEditAction base={base} schema={schema} table={table} disabled={!writable || !table || pending || busy || writeBusy} onApplied={refresh} />}
            tools={<>
              <button type="button" className="fouc-action" disabled={!table || pending} onClick={() => changeView("data")}><GridFour size={15} />数据浏览</button>
              <button type="button" className="fouc-action" disabled={!table || pending} onClick={() => changeView("structure")}><Database size={15} />结构浏览</button>
              <TableTransferAction session={session} name={name} schema={schema} table={table} disabled={pending || busy || writeBusy} />
              <TestDataAction session={currentSession} base={base} schema={schema} table={table} writable={writable} disabled={pending || busy || writeBusy} onUnlock={unlockSqlWrite} onImported={refresh} onBusyChange={setMutationBusy} />
              <SchemaCompareAction base={base} provider={session.provider} schema={schema} table={table} tables={tables} schemas={schemas} disabled={pending || busy} />
              <TableClearAction base={base} session={currentSession} schema={schema} table={table} writable={writable} disabled={!table || tables.find(item => item.name === table)?.kind !== "table" || pending || busy || writeBusy} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onCleared={() => { setSelectedRow(null); setActiveCell(null); setSelection(null); refresh() }} />
            </>} />}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
              <button type="button" onClick={refresh}>
                重试
              </button>
            </p>
          )}
          {leaveError && <p role="alert" className={styles.error}>暂时无法离开：{leaveError}。</p>}
          {feedback && (
            <p className={styles.saveFeedback} role="status">
              {feedback}
            </p>
          )}
          <div hidden={mode !== "sql"} className={styles.queryPanel}>
            <RelationalQuery key={session.id} session={currentSession} schema={schema} schemas={schemas} metadataRevision={revision} schemaLocked={pending} onSchemaChange={selectSchema} beforeLeaveRef={sqlBeforeLeave} onLeaveReady={clearLeaveError} openRequest={openRequest} onUnlockWrite={unlockSqlWrite} onMutated={refresh} onMutationBusy={setMutationBusy}
              tabsTarget={sqlTabsTarget} active={mode === 'sql'} tabsDisabled={pending || leaving} onActivate={() => changeView('sql')} onNoQueries={() => { setOpenedViews(current => current.filter(value => value !== 'sql')); if (mode === 'sql') setMode('data') }} />
          </div>
          {page && (
            <div hidden={mode !== "data"}>
              <TableQueryControls
                key={`query:${schema}:${page.table}`}
                page={page}
                query={query}
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
                onRefresh={refresh}
                active={mode === "data"}
                onActionTarget={setRowActionTarget}
              />
              <TableEditing
                key={`${schema}:${page.table}`}
                base={base}
                schema={schema}
                page={page}
                selectedRow={selectedRow}
                provider={session.provider} selection={selection} activeCell={activeCell} shortcutTarget={gridHost} onDraftsChange={setDrafts} commandRef={gridCommands}
                toolbarTarget={rowActionTarget}
                toolsTarget={gridToolsTarget}
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
          {mode === 'diagram' && schema && <SchemaDiagramView key={`${base}:${schema}`} base={base} schema={schema} onOpenTable={node => { selectSchema(node.schema); openTable(node.table) }} onOpenQuery={sql => { setOpenRequest({ id: crypto.randomUUID(), sql, schema }); changeView('sql') }} />}
          {mode === 'docs' && schema && <DatabaseDocsPanel base={base} schemas={[schema]} persistent={Boolean(session.connectionId)} onOpenTable={(nextSchema, nextTable) => { selectSchema(nextSchema); openTable(nextTable) }} />}
          {mode === 'activity' && <DatabaseActivityPanel base={base} provider={session.provider} database={session.database} blocked={pending || writeBusy} />}
          {(mode === 'data' || mode === 'structure') && (
            <>
              {mode === "structure" && table ? (
                <TableStructure
                  session={currentSession}
                  writable={writable}
                  onUnlock={unlockSqlWrite}
                  onBusyChange={setMutationBusy}
                  onStructureChanged={refresh}
                  onWriteAccessChanged={setCurrentSession}
                  key={`${schema}:${table}:${structureTab}:${initialStructureSearch ?? ''}`}
                  base={base}
                  schema={schema}
                  table={table}
                  revision={revision}
                  pending={pending}
                  initialSearch={initialStructureSearch}
                  initialTab={structureTab}
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
                  onSelect={setSelectedRow}
                  headerTarget={gridHeaderTarget}
                  toolsTarget={gridToolsTarget}
                  exportTarget={footerExportTarget}
                  search={pageSearch}
                  sort={query.sort}
                  sortDisabled={busy || pending}
                  filter={query.filter}
                  writable={writable} editingDisabled={busy || writeBusy || tables.find(item => item.name === table)?.kind !== 'table'} commandRef={gridCommands}
                  onDatabaseSort={(column, direction) => { if (!pending && !busy) applyQuery({ ...query, sort: [{ column, direction, nulls: 'last' }] }) }}
                  onClearSort={column => { if (!pending && !busy) applyQuery({ ...query, sort: query.sort.filter(rule => rule.column !== column) }) }}
                  onValuesFilter={(column, values) => { if (!pending && !busy) { const remaining = removeDatabaseColumnFilter(query.filter, column), chosen = values === null ? null : databaseColumnValueFilter(column, values); applyQuery({ ...query, filter: remaining && chosen ? { kind: 'group', join: 'and', children: [remaining, chosen] } : remaining ?? chosen }) } }}
                  onFilter={(column, value, operator) => { if (!pending && !busy) { const filter: import('@fouc/shared').RelationalFilter = { kind: 'condition', column, operator, ...(operator === 'equals' || operator === 'not-equals' ? { value } : {}) }; applyQuery({ ...query, filter: query.filter ? { kind: 'group', join: 'and', children: [query.filter, filter] } : filter }) } }}
                  onColumnDetails={column => { setStructureTab('columns'); setInitialStructureSearch(column); setMode('structure') }}
                  onRefresh={refresh}
                />
              )}
              {page && mode === "data" && (
                <TablePagination base={base} schema={schema} page={page} query={query} revision={revision}
                  offset={offset} limit={limit} defaultSize={defaultSize} loadTimeMs={loadTimeMs} disabled={busy || pending || leaving}
                  onNavigate={navigatePage} onLimit={changeLimit} onDefault={defaultLimit} onClose={closeTable}
                  exportAction={<span ref={setFooterExportTarget} />} />
              )}
            </>
          )}
        </main>
      </div>
      {propertiesOpen && table ? <SqlDialog title={`表属性 · ${schema}.${table}`} className={nativeStyles.properties} onClose={() => setPropertiesOpen(false)}><div><TableStructure session={currentSession} writable={writable} onUnlock={unlockSqlWrite} onBusyChange={setMutationBusy} onStructureChanged={refresh} onWriteAccessChanged={setCurrentSession} base={base} schema={schema} table={table} revision={revision} pending={pending} onOpenTable={(nextSchema, nextTable) => { setPropertiesOpen(false); selectSchema(nextSchema); openTable(nextTable) }} /></div></SqlDialog> : null}
    </section>
  )
}
