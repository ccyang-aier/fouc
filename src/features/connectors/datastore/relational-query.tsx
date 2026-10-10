"use client"
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { CompletionContext } from '@codemirror/autocomplete'
import { closeCompletion, startCompletion } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { isolateHistory } from '@codemirror/commands'
import { Transaction } from '@codemirror/state'
import { ClockCounterClockwise, FolderOpen, FloppyDisk, FilePlus, CheckCircle, CircleNotch, Database, Lock, WarningCircle, X, ArrowsClockwise, TextAlignLeft, ArrowsInLineHorizontal, SlidersHorizontal } from '@phosphor-icons/react'
import { inspectSqlTemplate, resolveSqlExecutionTarget, type SqlEditorPreferences, type SqlExecutionMode, type SqlStatementRange, type SqlParameterDescriptor, type RelationalSession, type SavedSqlDocument, type SavedSqlLibrary, type SqlDraftState, type SqlDraftTab, type SqlHistoryEntry } from '@fouc/shared'
import { SqlEditor, type SqlEditorCache } from './sql-editor'
import { SqlExecutionResults } from './sql-execution-results'
import { useSqlExecutions } from './use-sql-executions'
import { useResultPins } from './sql-result-history/use-result-pins'
import { ResultPins } from './sql-result-history/result-pins'
import { scopedResultPins } from './sql-result-history/model'
import { SqlParameterDialog, rememberSqlParameters, type SqlParameterRecents } from './sql-parameter-dialog'
import { SqlEditorSplit } from './sql-editor-split'
import { SqlQueryToolbar } from './sql-query-toolbar'
import { SqlFileActions } from './sql-file-actions'
import { SqlQuickActions } from './sql-quick-actions'
import { SqlExplainAction } from './sql-explain-action'
import { SqlMutationAction } from './sql-mutation-action'
import { SqlQueryCompareAction } from './data-compare/query-action'
import type { OpenSqlFile } from './sql-files'
import { SQL_DRAFT_MAX_BYTES } from '@fouc/shared'
import { sqlVariableContext } from '@fouc/shared'
import { SqlEditorPreferencesDialog } from './sql-editor-preferences-dialog'
import { transformSqlEditor } from './sql-editor-transform'
import { compressSqlText, formatSqlForEditing } from './sql-format/formatter'
import { detectAndFormatStructured } from './sql-format/structured'
import { formatSqlSnapshotForSave } from './sql-format/format-on-save'
import { SqlHistoryPanel } from './sql-history-panel'
import { SqlLibraryPanel } from './sql-library-panel'
import { SaveSqlDialog, SqlDialog } from './sql-library-dialog'
import { useSqlResource } from './use-sql-resource'
import { useSqlDrafts } from './use-sql-drafts'
import { useSqlMetadata } from './use-sql-metadata'
import { mergeSqlJoinCompletion } from './sql-assistance/join/completion'
import { SqlTabStrip, type SqlTabAction } from './sql-tab-strip'
import { closeSqlTabs, mergeSqlDrafts, navigateSqlTabs, newSqlTab, nextSqlQueryTitle, pinSqlTab, reorderSqlTab, sqlTabDirty, sqlTabSaveable, visitSqlTab, type SqlTabVisits } from './sql-tabs'
import common from './relational.module.css'
import styles from './sql-library.module.css'
import tabsStyle from './sql-tabs.module.css'

type Restore = { sql: string; schema: string | null; database: string; file: SavedSqlDocument | null }
type Saving = { tabId: string | null; sql: string; schema: string | null; database: string; file: SqlDraftTab['savedFile'] }
function binding(file: SavedSqlDocument): NonNullable<SqlDraftTab['savedFile']> { return { id: file.id, version: file.version, name: file.name, folderId: file.folderId } }

export function RelationalQuery({ session, schema, schemas, metadataRevision, schemaLocked, onSchemaChange, beforeLeaveRef, onLeaveReady, openRequest, onUnlockWrite, onMutated, onMutationBusy, tabsTarget, tabActionsTarget, active, tabsDisabled, onActivate, onNoQueries }: {
  session: RelationalSession; schema: string; schemas: string[]; metadataRevision: number; schemaLocked: boolean; onSchemaChange: (schema: string) => void;
  beforeLeaveRef: RefObject<(() => Promise<void>) | null>
  onLeaveReady: () => void
  openRequest?: { id: string; sql: string; schema: string } | null
  onUnlockWrite: () => Promise<void>
  onMutated: () => void
  onMutationBusy: (busy: boolean) => void
  tabsTarget: HTMLElement | null; tabActionsTarget: HTMLElement | null; active: boolean; tabsDisabled: boolean;
  onActivate: () => void; onNoQueries: () => void
}) {
  const root = `/api/database/relational`
  const base = `${root}/sessions/${session.id}`, libraryBase = session.connectionId ? `${root}/connections/${session.connectionId}/sql-library` : null
  const { state, controller } = useSqlDrafts(libraryBase, () => { const tab = newSqlTab(session.database, schema || null); return { tabs: [tab], activeTabId: tab.id } })
  const current = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null
  const openedRequest = useRef<string | null>(null)
  useEffect(() => {
    if (!state.ready || !openRequest || openedRequest.current === openRequest.id) return
    const tab = { ...newSqlTab(session.provider === 'mysql' ? openRequest.schema : session.database, openRequest.schema, openRequest.sql ? '外键关联查询' : nextSqlQueryTitle(controller.getSnapshot().tabs)), sql: openRequest.sql, originalSql: '', customTitle: Boolean(openRequest.sql) }
    controller.update(snapshot => ({ tabs: [...snapshot.tabs, tab], activeTabId: tab.id }))
    openedRequest.current = openRequest.id
  }, [state.ready, controller, openRequest, session.provider, session.database])
  const [panel, setPanel] = useState<'history' | 'library' | null>(null), [revision, setRevision] = useState(0)
  const { executions, locks, run: execute, cancel, forget, selectResult } = useSqlExecutions(base, () => setRevision((value) => value + 1))
  const resultPins = useResultPins()
  const [executionMode, setExecutionMode] = useState<SqlExecutionMode>('current')
  const [parameterRequest, setParameterRequest] = useState<{ tabId: string; title: string; target: SqlStatementRange; schema: string | null; declarationSql: string; descriptors: SqlParameterDescriptor[] } | null>(null)
  const parameterHistories = useRef(new Map<string, SqlParameterRecents>())
  const [saving, setSaving] = useState<Saving | null>(null), [restore, setRestore] = useState<{ target: Restore; tabId: string | null } | null>(null), [notice, setNotice] = useState('')
  const [closing, setClosing] = useState<SqlDraftTab[] | null>(null), [closed, setClosed] = useState<SqlDraftTab[]>([])
  const [renaming, setRenaming] = useState<SqlDraftTab | null>(null), [title, setTitle] = useState('')
  const [visits, setVisits] = useState<SqlTabVisits>({ entries: [], index: -1 })
  const [remote, setRemote] = useState<SqlDraftState | null>(null), [inspectBusy, setInspectBusy] = useState(false)
  const [editorSettingsOpen, setEditorSettingsOpen] = useState(false), [preferencesRevision, setPreferencesRevision] = useState(0)
  const [formatting, setFormatting] = useState(false)
  const editor = useRef<EditorView | null>(null)
  const editorCache = useRef<SqlEditorCache>(new Map())
  const library = useSqlResource<SavedSqlLibrary>(libraryBase, undefined, revision)
  const preferencesBase = libraryBase ?? base
  const preferences = useSqlResource<SqlEditorPreferences>(`${preferencesBase}/preferences`, undefined, preferencesRevision)
  const busyIds = new Set(Object.keys(executions).filter((id) => executions[id].running))
  const execution = current ? executions[current.id] : undefined
  const pinScope = { connectionId: session.connectionId ?? session.id, tabId: current?.id ?? '' }
  const selectedStatement = execution?.snapshot?.statements[execution.selectedResult]
  const currentResultId = execution?.snapshot ? `${execution.snapshot.id}:${execution.selectedResult}` : ''
  const currentResult = selectedStatement?.status === 'succeeded' && selectedStatement.result ? { id: currentResultId, result: selectedStatement.result, label: `${current?.title} · 结果 ${execution!.selectedResult + 1}` } : null
  const currentResultPinned = scopedResultPins(resultPins.pins, pinScope).some(pin => pin.sourceId === currentResultId)
  const running = execution?.running ?? false
  useEffect(() => { if (state.ready && !state.pending && state.status === 'ready' && !Object.values(executions).some((item) => item.running)) onLeaveReady() }, [state.ready, state.pending, state.status, executions, onLeaveReady])
  useEffect(() => {
    beforeLeaveRef.current = () => { if (locks.current.size) return Promise.reject(new Error('仍有查询正在执行，请等待执行结束后返回')); return controller.flush() }
    return () => { beforeLeaveRef.current = null }
  }, [beforeLeaveRef, controller, locks])
  useEffect(() => {
    if (state.activeTabId) setVisits((value) => visitSqlTab(value, state.activeTabId!))
  }, [state.activeTabId])
  useEffect(() => {
    if (!state.ready || !schemas.length) return
    const fallback = schemas.includes('public') ? 'public' : schemas[0]
    if (state.tabs.some((tab) => tab.schema === null)) controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => tab.schema === null ? { ...tab, schema: session.provider === 'mysql' ? tab.database : fallback } : tab) }))
  }, [state.ready, state.tabs, schemas, controller, session.provider])

  function updateTab(id: string, update: Partial<SqlDraftTab>) {
    controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => tab.id === id ? { ...tab, ...update } : tab) }))
  }
  function targetIssue(target: Pick<Restore, 'database' | 'schema'>): string {
    const targetSchema = session.provider === 'mysql' ? target.database : target.schema ?? schema
    if (session.provider !== 'mysql' && target.database !== session.database) return '保存的目标数据库与当前连接不同，请先连接到原目标数据库再恢复。'
    if (targetSchema && !schemas.includes(targetSchema)) return `目标 Schema ${targetSchema} 当前不可用，请核对连接和权限后重试。`
    if (schemaLocked && targetSchema !== schema) return '表格有待提交变更，请先提交或放弃变更后再恢复其他 Schema。'
    return ''
  }
  function select(id: string) {
    const tab = controller.getSnapshot().tabs.find((item) => item.id === id)
    if (tab) controller.update((snapshot) => ({ ...snapshot, activeTabId: id }))
  }
  function add() {
    const tab = newSqlTab(session.provider === 'mysql' ? schema || session.database : session.database, schema || null, nextSqlQueryTitle(state.tabs))
    controller.update((snapshot) => ({ tabs: [...snapshot.tabs, tab], activeTabId: tab.id })); setPanel(null)
  }
  function openSqlFiles(files: Pick<OpenSqlFile, 'name' | 'sql'>[]) {
    const snapshot = controller.getSnapshot()
    const imported = files.map((file) => ({ ...newSqlTab(session.provider === 'mysql' ? schema || session.database : session.database, schema || null, [...file.name].slice(0, 180).join('')), sql: file.sql, originalSql: '', customTitle: true }))
    const next = { tabs: [...snapshot.tabs, ...imported], activeTabId: imported.at(-1)?.id ?? snapshot.activeTabId }
    if (new TextEncoder().encode(JSON.stringify(next)).byteLength > SQL_DRAFT_MAX_BYTES) throw new Error('完整 SQL 草稿最多 64 MiB，请先保存或关闭部分查询标签。')
    controller.edit(next); setPanel(null); setNotice(`已打开 ${files.length} 个 SQL 文件，完整内容已加载。`)
  }
  function openComparisonReview(sql: string) {
    try { openSqlFiles([{ name: '数据比较审查.sql', sql }]); setNotice('修改建议已放入新查询标签，可继续审查。') }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)) }
  }
  async function formatText(sql: string): Promise<string> {
    const settings = preferences.data?.formatter
    if (!settings || preferences.busy || preferences.error) throw new Error('编辑器设置尚未加载，请先重试读取设置。')
    const structured = detectAndFormatStructured(sql, { indentSize: settings.tabWidth, useTabs: settings.useTabs })
    if (structured.kind === 'unsupported') throw new Error('XML 内容不完整，已保留原始文本。')
    return structured.kind === 'sql' ? formatSqlForEditing(sql, session.provider, settings) : structured.formatted
  }
  async function transformCurrent(compress = false) {
    if (!current || formatting || running) return
    setFormatting(true)
    try {
      const result = await transformSqlEditor(() => editor.current, compress ? (sql) => compressSqlText(sql, session.provider) : formatText)
      setNotice(result === 'stale' ? '编辑内容已变化，本次格式化未应用。' : result === 'unchanged' ? '内容保持原样；已符合设置或尚未形成可格式化语句。' : compress ? '已压缩选区或完整 SQL，可撤销恢复。' : '已格式化选区或完整文档，可撤销恢复。')
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)) }
    finally { setFormatting(false) }
  }
  async function saveCurrent() {
    if (!current || running || formatting || !libraryBase || library.busy || !sqlTabSaveable(current)) return
    if (preferences.busy || preferences.error || !preferences.data) { setNotice('编辑器设置尚未加载，请先重试读取设置。'); return }
    const tabId = current.id, view = editor.current
    let sql = view?.state.doc.toString() ?? current.sql
    if (preferences.data.formatOnSave) {
      setFormatting(true)
      try {
        sql = await formatSqlSnapshotForSave(sql, () => editor.current === view && controller.getSnapshot().activeTabId === tabId ? view?.state.doc.toString() ?? '' : '', formatText,
          (formatted) => { if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted }, selection: { anchor: Math.min(view.state.selection.main.head, formatted.length) }, annotations: [Transaction.userEvent.of('input.format'), isolateHistory.of('full')] }) })
      } catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)); return }
      finally { setFormatting(false) }
    }
    const tab = controller.getSnapshot().tabs.find((item) => item.id === tabId)
    if (!tab || controller.getSnapshot().activeTabId !== tabId || editor.current !== view || locks.current.has(tabId) || tab.database !== current.database || tab.schema !== current.schema) { setNotice('编辑目标已变化，请重新保存。'); return }
    setSaving({ tabId, sql, schema: tab.schema ?? (schema || null), database: tab.database, file: tab.savedFile })
  }
  function apply(target: Restore, tabId: string | null) {
    if (targetIssue(target)) return
    const nextSchema = session.provider === 'mysql' ? target.database : target.schema ?? schema
    if (nextSchema && nextSchema !== schema) onSchemaChange(nextSchema)
    const existing = controller.getSnapshot().tabs.find((tab) => tab.id === tabId)
    const tab = { ...(existing ?? newSqlTab(target.database, target.schema)), sql: target.sql, originalSql: target.sql, database: target.database,
      schema: target.schema ?? (schema || null), savedFile: target.file ? binding(target.file) : null,
      title: target.file ? (existing?.customTitle ? existing.title : target.file.name) : existing?.title ?? '恢复的查询' }
    controller.update((snapshot) => ({ tabs: existing ? snapshot.tabs.map((item) => item.id === tab.id ? tab : item) : [...snapshot.tabs, tab], activeTabId: tab.id }))
    forget([tab.id])
    setRestore(null); setPanel(null); setNotice('已恢复 SQL 和目标上下文；点击运行后才会执行')
  }
  function requestRestore(target: Restore, tabId: string | null) {
    const tab = controller.getSnapshot().tabs.find((item) => item.id === tabId)
    if (tab && locks.current.has(tab.id)) return
    if (targetIssue(target) || (tab && sqlTabDirty(tab) && tab.sql !== target.sql)) setRestore({ target, tabId })
    else apply(target, tabId)
  }
  function openFile(file: SavedSqlDocument) {
    const existing = controller.getSnapshot().tabs.find((tab) => tab.savedFile?.id === file.id)
    if (existing && existing.originalSql === file.sql && !targetIssue(file)) {
      if (locks.current.has(existing.id)) { select(existing.id); setPanel(null); setNotice('查询正在执行，结束后可重新打开文件以恢复目标。'); return }
      const nextSchema = session.provider === 'mysql' ? file.database : file.schema ?? schema
      updateTab(existing.id, { savedFile: binding(file), title: existing.customTitle ? existing.title : file.name, database: file.database, schema: file.schema ?? (schema || null) })
      if (nextSchema && nextSchema !== schema) onSchemaChange(nextSchema)
      select(existing.id); setPanel(null); return
    }
    requestRestore({ sql: file.sql, schema: file.schema, database: file.database, file }, existing?.id ?? null)
  }
  function historyRestore(entry: SqlHistoryEntry) { requestRestore({ sql: entry.sql, schema: entry.schema, database: entry.database, file: null }, current?.id ?? null) }
  async function run(mode: SqlExecutionMode = executionMode) {
    if (!current || locks.current.has(current.id)) return
    const issue = targetIssue(current)
    if (issue) { setNotice(issue); return }
    const view = editor.current, selection = view?.state.selection.main ?? { from: 0, to: 0, head: 0 }
    const document = view?.state.doc.toString() ?? current.sql
    const target = resolveSqlExecutionTarget(document, session.provider, mode, selection)
    if (!target) { setNotice(mode === 'current' ? '光标所在位置没有可执行语句，请移到 SQL 内或选择全部语句。' : '没有可执行的 SQL。'); return }
    const declarationSql = sqlVariableContext(document.slice(0, target.to), session.provider)
    let inspected
    try { inspected = inspectSqlTemplate(target.sql, session.provider, declarationSql) }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)); return }
    const targetSchema = session.provider === 'mysql' ? current.database : current.schema ?? (schema || null)
    if (!inspected.source.sql.trim()) { setNotice('当前只有变量定义；请将光标移到查询语句或选择全部语句。'); return }
    if (inspected.descriptors.length > 128) { setNotice('每次参数输入最多支持 128 个参数，请分段执行。'); return }
    setNotice('')
    if (inspected.descriptors.length) {
      if (!parameterHistories.current.has(current.id)) parameterHistories.current.set(current.id, new Map())
      setParameterRequest({ tabId: current.id, title: current.title, target, schema: targetSchema, declarationSql, descriptors: inspected.descriptors })
    } else await execute(current.id, target, targetSchema, { declarationSql })
  }
  function finishClose(tabs: SqlDraftTab[]) {
    const ids = tabs.map((tab) => tab.id)
    if (ids.some((id) => locks.current.has(id))) { setNotice('执行中的查询不能关闭，请等待执行结束。'); return }
    setClosed((previous) => {
      const next = [...previous, ...tabs].slice(-20), retained = new Set([...controller.getSnapshot().tabs.filter((tab) => !ids.includes(tab.id)), ...next].map((tab) => tab.id))
      for (const key of editorCache.current.keys()) if (!retained.has(key)) editorCache.current.delete(key)
      return next
    })
    const closesAll = controller.getSnapshot().tabs.every(tab => ids.includes(tab.id))
    controller.update((snapshot) => closeSqlTabs(snapshot, ids)); setClosing(null)
    if (closesAll) onNoQueries()
    forget(ids)
    resultPins.forgetTabs(ids)
    for (const id of ids) parameterHistories.current.delete(id)
  }
  function action(action: SqlTabAction, tab: SqlDraftTab | null) {
    const snapshot = controller.getSnapshot()
    if (action === 'reopen') {
      const item = closed.at(-1); if (!item) return
      controller.update((value) => ({ tabs: value.tabs.some((tab) => tab.id === item.id) ? value.tabs : [...value.tabs, item].sort((a, b) => Number(b.pinned) - Number(a.pinned)), activeTabId: item.id })); setClosed((value) => value.slice(0, -1)); return
    }
    if (tab && action === 'pin') { controller.update((value) => pinSqlTab(value, tab.id)); return }
    if (tab && action === 'rename') { setRenaming(tab); setTitle(tab.title); return }
    if (tab && action === 'duplicate') {
      const copy = { ...tab, id: crypto.randomUUID(), title: `${tab.title.slice(0, 190)} 副本`, pinned: false, customTitle: true, savedFile: null, originalSql: '' }
      controller.update((value) => ({ tabs: [...value.tabs, copy], activeTabId: copy.id })); return
    }
    const index = snapshot.tabs.findIndex((item) => item.id === tab?.id)
    const targets = snapshot.tabs.filter((item, position) => action === 'close' ? item.id === tab?.id : !item.pinned && (action === 'all' || (action === 'others' && item.id !== tab?.id) || (action === 'left' && position < index) || (action === 'right' && position > index)))
    if (targets.some((item) => locks.current.has(item.id))) { setNotice('执行中的查询不能关闭，请等待执行结束。'); return }
    if (targets.some(sqlTabDirty)) setClosing(targets); else finishClose(targets)
  }
  async function inspect() {
    setInspectBusy(true)
    try { setRemote(await controller.inspectRemote()) } catch (reason) { setNotice(reason instanceof Error ? reason.message : String(reason)) }
    finally { setInspectBusy(false) }
  }
  function adoptDeviceDrafts(merge: boolean) {
    if (!remote || locks.current.size) return
    const snapshot = merge ? mergeSqlDrafts(remote, controller.getSnapshot()) : null
    controller.adoptRemote(remote)
    if (snapshot) controller.edit(snapshot)
    editorCache.current = new Map(); forget(Object.keys(executions)); setClosed([]); setRemote(null)
    if (snapshot) void controller.flush().catch(() => undefined)
  }
  const restoreError = restore ? targetIssue(restore.target) : ''
  const targetSchema = current ? session.provider === 'mysql' ? current.database : current.schema ?? schema : schema
  const { metadata, join, state: metadataState } = useSqlMetadata(session, metadataRevision)
  const complete = useCallback(async (context: CompletionContext) => {
    const target = { schema: targetSchema, schemas }
    const [ordinary, related] = await Promise.all([metadata.complete(context, target), join.complete(context, target, preferences.data?.formatter.keywordCase)])
    return mergeSqlJoinCompletion(ordinary, related)
  }, [metadata, join, targetSchema, schemas, preferences.data?.formatter.keywordCase])
  function refreshMetadata() { metadata.clear(); join.clear(); if (editor.current) { closeCompletion(editor.current); startCompletion(editor.current) } }
  const displayDatabase = current && session.provider === 'sqlite' ? current.database.replace(/^.*[\\/]/, '') : current?.database
  const draftMessage = !libraryBase ? '临时连接 · 草稿保留至离开' : state.status === 'error' ? state.ready ? '草稿保存失败 · 本地内容已保留' : '草稿读取失败 · 点击重试' : !state.ready ? '正在恢复设备草稿…' : state.status === 'saving' ? '正在保存草稿…' : state.pending ? '草稿待保存' : '草稿已保存到设备'
  const draftStatus = <span className={tabsStyle.status} data-state={state.status} role="status" aria-label={draftMessage} title={draftMessage}>{state.status === 'error' ? <WarningCircle size={14} /> : !state.ready || state.status === 'saving' || state.pending ? <CircleNotch size={14} className="mw-spin" /> : <CheckCircle size={14} />}{draftMessage}</span>
  return <div className={styles.workspace}>
    {editorSettingsOpen && preferences.data && <SqlEditorPreferencesDialog base={preferencesBase} initial={preferences.data} provider={session.provider} onClose={() => { setEditorSettingsOpen(false); editor.current?.focus() }} onSaved={() => { setEditorSettingsOpen(false); setPreferencesRevision((value) => value + 1); setNotice('编辑器设置已保存，片段补全已更新。'); editor.current?.focus() }} />}
    {parameterRequest && <SqlParameterDialog key={parameterRequest.tabId} sql={parameterRequest.target.sql} declarationSql={parameterRequest.declarationSql} provider={session.provider} descriptors={parameterRequest.descriptors} history={parameterHistories.current.get(parameterRequest.tabId)!} targetLabel={parameterRequest.title}
      onClose={() => { setParameterRequest(null); editor.current?.focus() }} onExecute={(parameters) => {
        rememberSqlParameters(parameterHistories.current.get(parameterRequest.tabId)!, parameters)
        setParameterRequest(null)
        void execute(parameterRequest.tabId, parameterRequest.target, parameterRequest.schema, { parameters, declarationSql: parameterRequest.declarationSql })
      }} />}
    <div className={`${styles.query} mw-sql-workspace mw-live-sql`}>
      {state.ready && tabsTarget && createPortal(<SqlTabStrip snapshot={state} scope={libraryBase ?? base} busyIds={busyIds} active={active} disabled={tabsDisabled} actionsTarget={tabActionsTarget} canBack={Boolean(navigateSqlTabs(visits, -1, state))} canForward={Boolean(navigateSqlTabs(visits, 1, state))} canReopen={closed.length > 0} onSelect={id => { onActivate(); select(id) }} onAction={action}
        onNavigate={(direction) => { const next = navigateSqlTabs(visits, direction, state); if (next) { setVisits(next.visits); select(next.id) } }} onReorder={(id, beforeId) => controller.update((snapshot) => reorderSqlTab(snapshot, id, beforeId))} />, tabsTarget)}
      <SqlQueryToolbar database={displayDatabase ?? session.database} status={<><span aria-label="只读查询" title="只读查询 · 选区优先"><Lock size={14} aria-hidden /></span>{draftStatus}</>} running={running} cancelling={execution?.snapshot?.status === 'cancelling'} disabled={!current || !state.ready} mode={executionMode} onModeChange={setExecutionMode} onRun={(mode) => void run(mode)} onCancel={() => current && void cancel(current.id)} target={current && <label className={tabsStyle.target}><Database size={15} /><select aria-label="SQL 目标 Schema" value={targetSchema} disabled={running || schemaLocked} onChange={(event) => {
          const next = event.target.value; updateTab(current.id, session.provider === 'mysql' ? { database: next, schema: next } : { schema: next }); if (next !== schema) onSchemaChange(next)
        }}>{targetSchema && !schemas.includes(targetSchema) && <option value={targetSchema}>{targetSchema}（当前不可用）</option>}{schemas.map((item) => <option key={item}>{item}</option>)}</select><Button variant="ghost" size="icon-sm" loading={metadataState.pending > 0} aria-label="刷新 SQL 元数据" title={metadataState.pending ? '正在读取 SQL 元数据' : '刷新表与字段补全'} onClick={refreshMetadata}><ArrowsClockwise size={15} /></Button></label>}>
        <span className={styles.toolDivider} />
        <Button variant="ghost" size="icon-sm" loading={formatting} aria-label="格式化 SQL" title="格式化 SQL · Ctrl / ⌘ + Shift + F · 选区优先" disabled={!current || running || preferences.busy || !preferences.data || Boolean(preferences.error)} onClick={() => void transformCurrent()}><TextAlignLeft size={17} /></Button>
        <button type="button" className="fouc-action" aria-label="压缩 SQL" title="压缩选区或完整 SQL，保留字面量与执行提示" disabled={!current || running || formatting} onClick={() => void transformCurrent(true)}><ArrowsInLineHorizontal size={17} /></button>
        <button type="button" className="fouc-action" aria-label="SQL 编辑器设置" title="格式化、保存与代码片段" disabled={preferences.busy || !preferences.data || Boolean(preferences.error)} onClick={() => setEditorSettingsOpen(true)}><SlidersHorizontal size={17} /></button>
        <span className={styles.toolDivider} />
        <SqlExplainAction key={`explain:${base}:${current?.id}:${targetSchema}`} base={base} provider={session.provider} schema={targetSchema || null} targetLabel={displayDatabase ?? session.database} editorRef={editor} disabled={!current || running || formatting} contextIssue={current ? targetIssue(current) : ''} onNotice={setNotice} />
        <SqlMutationAction key={`mutation:${base}:${current?.id}:${targetSchema}`} base={base} session={session} schema={targetSchema} editorRef={editor} disabled={!current || busyIds.size > 0 || formatting || schemaLocked} contextIssue={current ? targetIssue(current) : ''} onNotice={setNotice} onUnlock={onUnlockWrite} onBusyChange={onMutationBusy} onCommitted={() => { onMutated(); setNotice('SQL 事务已提交。已有查询结果保留，重新运行可读取最新数据。') }} />
        <SqlQueryCompareAction tabs={state.tabs} executions={executions} provider={session.provider} activeTabId={state.activeTabId} onNotice={setNotice} onSqlPreview={openComparisonReview} />
        <SqlQuickActions editorRef={editor} provider={session.provider} disabled={!current || running || formatting} keywordCase={preferences.data?.formatter.keywordCase} onFormatSql={formatText} onNotice={setNotice} />
        <SqlFileActions provider={session.provider} disabled={!state.ready || running} getDocument={() => current ? { sql: editor.current?.state.doc.toString() ?? current.sql, title: current.title } : null} onOpen={openSqlFiles} onNotice={setNotice} />
        <button type="button" className="fouc-action" aria-label="历史" title="查询历史" aria-pressed={panel === 'history'} onClick={() => setPanel((value) => value === 'history' ? null : 'history')}><ClockCounterClockwise size={17} /><span>历史</span></button>
        <button type="button" className="fouc-action" aria-label="SQL 库" aria-pressed={panel === 'library'} disabled={!libraryBase} title={!libraryBase ? '保存连接后可使用 SQL 库' : 'SQL 库'} onClick={() => setPanel((value) => value === 'library' ? null : 'library')}><FolderOpen size={17} /><span>SQL 库</span></button>
        <button type="button" className="fouc-action" aria-label="保存 SQL" title="保存 SQL · Ctrl / ⌘ + S" disabled={!current || running || formatting || preferences.busy || !libraryBase || library.busy || !sqlTabSaveable(current)} onClick={() => void saveCurrent()}><FloppyDisk size={17} /><span>保存 SQL</span></button>
        <button type="button" className="fouc-action" aria-label="新建查询" title="新建查询" disabled={!state.ready} onClick={add}><FilePlus size={17} /><span>新建查询</span></button>
      </SqlQueryToolbar>
      {state.error && <p role="alert" className={styles.error}>{state.error}<button type="button" onClick={() => void (state.ready ? controller.flush() : controller.load()).catch(() => undefined)}>重试草稿存储</button>{state.ready && <button type="button" disabled={inspectBusy} onClick={() => void inspect()}>查看设备版本</button>}</p>}
      {preferences.error && <p role="alert" className={styles.error}>编辑器设置读取失败：{preferences.error}<button type="button" onClick={() => setPreferencesRevision((value) => value + 1)}>重试编辑器设置</button></p>}
      {metadataState.error && <p role="alert" className={styles.error}>SQL 元数据读取失败：{metadataState.error}<button type="button" onClick={refreshMetadata}>重试元数据</button></p>}
      {(notice || library.error) && <p role={library.error ? 'alert' : 'status'} className={library.error ? styles.error : styles.notice}>{library.error || notice}{!library.error && <button type="button" aria-label="关闭 SQL 提示" onClick={() => setNotice('')}><X size={14} /></button>}</p>}
      {current ? <SqlEditorSplit resultMinHeight={scopedResultPins(resultPins.pins, pinScope).length ? 360 : 0} editor={<div className="mw-editor" id="fouc-sql-query-document" role="tabpanel" aria-label={current.title}><SqlEditor showRunGutter provider={session.provider} documentId={current.id} value={current.sql} positions={current.editorPosition} cache={editorCache.current} complete={complete} completionScope={`${targetSchema}:${metadataRevision}:${preferences.data?.version ?? "default"}`}
          onChange={(sql) => updateTab(current.id, { sql })} onPositionChange={(id, editorPosition) => { const tab = controller.getSnapshot().tabs.find((item) => item.id === id); if (tab && JSON.stringify(tab.editorPosition) !== JSON.stringify(editorPosition)) updateTab(id, { editorPosition }) }}
          onRun={(mode) => void run(mode ?? executionMode)} onSave={() => void saveCurrent()} onFormat={() => void transformCurrent()} snippets={preferences.data?.snippets} keywordCase={preferences.data?.formatter.keywordCase} functionCase={preferences.data?.formatter.functionCase} editorRef={editor} /></div>}
        result={<ResultPins key={JSON.stringify(pinScope)} scope={pinScope} pins={resultPins.pins} current={currentResult} provider={session.provider} layoutScopeKey={`${session.connectionId ?? session.id}:${current.database}:${current.schema}:${current.id}`} onRemove={resultPins.remove} onClear={() => resultPins.clear(pinScope)} onNotice={setNotice} onSqlPreview={openComparisonReview}><SqlExecutionResults key={`${current.id}:${execution?.snapshot?.id ?? 'empty'}`} layoutScopeKey={`${session.connectionId ?? session.id}:${current.database}:${current.schema}:${current.id}`} provider={session.provider} execution={execution} onSelect={(index) => selectResult(current.id, index)} view={current.resultView} onViewChange={(resultView) => updateTab(current.id, { resultView })} onCancel={() => void cancel(current.id)} currentPinned={currentResultPinned} onPin={(statement, index) => {
          if (!statement.result || !execution?.snapshot) return
          try { resultPins.pin({ scope: pinScope, sourceId: `${execution.snapshot.id}:${index}`, label: `${current.title} · 结果 ${index + 1}`, sql: statement.sql, result: statement.result }); setNotice('已固定结果，重新运行不会覆盖。') }
          catch (reason) { setNotice(reason instanceof Error ? reason.message : '固定结果失败') }
        }} onReveal={(statement) => {
          const view = editor.current; if (!view) return
          if (view.state.sliceDoc(statement.from, statement.to) !== statement.sql) { setNotice('本次执行后 SQL 已修改，无法精确定位。可在错误详情中查看本次执行的原始 SQL。'); return }
          const position = Math.min(view.state.doc.length, statement.from + (statement.error?.position ?? 0))
          view.dispatch({ selection: { anchor: position }, scrollIntoView: true }); view.focus()
        }} /></ResultPins>} />
      : <div className={tabsStyle.empty}><p>{state.ready ? '没有打开的 SQL 查询' : '正在加载 SQL 草稿…'}</p>{state.ready && <button type="button" onClick={add}>新建查询</button>}</div>}
    </div>
    {panel === 'history' && <SqlHistoryPanel base={`${base}/history`} revision={revision} canSave={Boolean(libraryBase)} onClose={() => setPanel(null)} onRestore={historyRestore} onSave={(entry) => setSaving({ tabId: null, sql: entry.sql, schema: entry.schema, database: entry.database, file: null })} />}
    {panel === 'library' && libraryBase && <SqlLibraryPanel base={libraryBase} library={library.data} busy={library.busy} error={library.error} onRefresh={() => setRevision((value) => value + 1)} onClose={() => setPanel(null)} onOpen={openFile}
      onUpdated={(document) => controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => tab.savedFile?.id === document.id && tab.originalSql === document.sql ? { ...tab, savedFile: binding(document), title: tab.customTitle ? tab.title : document.name } : tab) }))}
      onDeleted={(ids) => { controller.update((snapshot) => ({ ...snapshot, tabs: snapshot.tabs.map((tab) => tab.savedFile && ids.includes(tab.savedFile.id) ? { ...tab, savedFile: null, originalSql: '' } : tab) })); setNotice('SQL 文件已删除；编辑内容仍保留，可另存为新文件。') }} />}
    {saving && libraryBase && <SaveSqlDialog base={libraryBase} {...saving} library={library.data} onClose={() => setSaving(null)} onSaved={(document) => {
      const tab = controller.getSnapshot().tabs.find((item) => item.id === saving.tabId)
      if (tab && tab.database === document.database && (tab.schema ?? (schema || null)) === document.schema) updateTab(tab.id, { savedFile: binding(document), originalSql: document.sql, title: tab.customTitle ? tab.title : document.name })
      setSaving(null); setNotice(`已保存 ${document.name}`); setRevision((value) => value + 1)
    }} />}
    {restore && <SqlDialog title="恢复 SQL 编辑内容" onClose={() => setRestore(null)}><div className={common.formBody}><p>{restoreError ? '保存的目标上下文当前无法恢复，编辑内容保持原样。' : '当前查询有修改。恢复后会替换完整编辑内容，并选择原目标 Schema。'}</p><small>恢复操作不会执行 SQL。</small>{restoreError && <p role="alert" className={styles.error}>{restoreError}</p>}</div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setRestore(null)}>保留当前内容</button><span /><button type="button" className={common.primary} disabled={Boolean(restoreError)} onClick={() => apply(restore.target, restore.tabId)}>替换并恢复</button></footer></SqlDialog>}
    {closing && <SqlDialog title="关闭 SQL 标签确认" role="alertdialog" onClose={() => setClosing(null)}><div className={common.formBody}><p>关闭 {closing.length} 个标签，其中 {closing.filter(sqlTabDirty).length} 个有修改。关闭后这些草稿会从设备恢复列表移除。</p><ul className={tabsStyle.closing}>{closing.map((tab) => <li key={tab.id}>{tab.title}{sqlTabDirty(tab) ? ' · 未保存到 SQL 文件' : ''}</li>)}</ul><small>可取消后逐个保存。当前工作台内可重新打开最近关闭的标签。</small></div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setClosing(null)}>保留标签</button><span /><button type="button" className={common.danger} onClick={() => finishClose(closing)}>放弃修改并关闭</button></footer></SqlDialog>}
    {renaming && <SqlDialog title="重命名 SQL 标签" onClose={() => setRenaming(null)}><form onSubmit={(event) => { event.preventDefault(); if (title.trim()) { updateTab(renaming.id, { title: title.trim(), customTitle: true }); setRenaming(null) } }}><div className={common.formBody}><label>标签名称<input aria-label="SQL 标签名称" value={title} maxLength={200} required autoFocus onChange={(event) => setTitle(event.target.value)} /></label><small>修改标签标题，SQL 文件名称可在 SQL 库中管理。</small></div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setRenaming(null)}>取消</button><span /><button type="submit" className={common.primary} disabled={!title.trim()}>确认标签名称</button></footer></form></SqlDialog>}
    {remote && <SqlDialog title="查看设备 SQL 草稿" onClose={() => setRemote(null)}><div className={common.formBody}><p>设备版本包含 {remote.tabs.length} 个标签。下方是设备中的完整 SQL；当前窗口内容仍保留。</p>{busyIds.size > 0 && <p role="status">仍有查询正在执行，结束后可替换或合并草稿。</p>}<div className={tabsStyle.preview}>{remote.tabs.map((tab) => <label key={tab.id}>{tab.title} · {tab.database}{tab.schema ? ` / ${tab.schema}` : ''}<textarea readOnly aria-label={`设备草稿 ${tab.title}`} value={tab.sql} /></label>)}</div></div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setRemote(null)}>保留当前内容</button><button type="button" className={common.secondary} disabled={busyIds.size > 0} onClick={() => adoptDeviceDrafts(false)}>用设备版本替换</button><button type="button" className={common.primary} disabled={busyIds.size > 0} onClick={() => adoptDeviceDrafts(true)}>保留本地并合并保存</button></footer></SqlDialog>}
  </div>
}
