"use client"
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CompletionContext } from '@codemirror/autocomplete'
import { closeCompletion, startCompletion } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { Play, ClockCounterClockwise, FolderOpen, FloppyDisk, FilePlus, CheckCircle, CircleNotch, Database, Lock, Table, WarningCircle, X, ArrowsClockwise } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalSession, SavedSqlDocument, SavedSqlLibrary, SqlDraftState, SqlDraftTab, SqlHistoryEntry } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlEditor, type SqlEditorCache } from './sql-editor'
import { SqlQueryResult } from './query-result'
import { SqlEditorSplit } from './sql-editor-split'
import { SqlHistoryPanel } from './sql-history-panel'
import { SqlLibraryPanel } from './sql-library-panel'
import { SaveSqlDialog, SqlDialog } from './sql-library-dialog'
import { useSqlResource } from './use-sql-resource'
import { useSqlDrafts } from './use-sql-drafts'
import { useSqlMetadata } from './use-sql-metadata'
import { SqlTabStrip, type SqlTabAction } from './sql-tab-strip'
import { closeSqlTabs, mergeSqlDrafts, navigateSqlTabs, newSqlTab, pinSqlTab, reorderSqlTab, sqlTabDirty, sqlTabSaveable, visitSqlTab, type SqlTabVisits } from './sql-tabs'
import common from './relational.module.css'
import styles from './sql-library.module.css'
import tabsStyle from './sql-tabs.module.css'

type Restore = { sql: string; schema: string | null; database: string; file: SavedSqlDocument | null }
type Saving = { tabId: string | null; sql: string; schema: string | null; database: string; file: SqlDraftTab['savedFile'] }
type Execution = { running: boolean; result: DatabaseQueryResult | null; error: string }
function binding(file: SavedSqlDocument): NonNullable<SqlDraftTab['savedFile']> { return { id: file.id, version: file.version, name: file.name, folderId: file.folderId } }

export function RelationalQuery({ session, schema, schemas, metadataRevision, schemaLocked, onSchemaChange, beforeLeaveRef, onLeaveReady }: {
  session: RelationalSession; schema: string; schemas: string[]; metadataRevision: number; schemaLocked: boolean; onSchemaChange: (schema: string) => void;
  beforeLeaveRef: RefObject<(() => Promise<void>) | null>
  onLeaveReady: () => void
}) {
  const root = `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/relational`
  const base = `${root}/sessions/${session.id}`, libraryBase = session.connectionId ? `${root}/connections/${session.connectionId}/sql-library` : null
  const { state, controller } = useSqlDrafts(libraryBase, () => { const tab = newSqlTab(session.database, schema || null); return { tabs: [tab], activeTabId: tab.id } })
  const current = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null
  const [executions, setExecutions] = useState<Record<string, Execution>>({})
  const [panel, setPanel] = useState<'history' | 'library' | null>(null), [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState<Saving | null>(null), [restore, setRestore] = useState<{ target: Restore; tabId: string | null } | null>(null), [notice, setNotice] = useState('')
  const [closing, setClosing] = useState<SqlDraftTab[] | null>(null), [closed, setClosed] = useState<SqlDraftTab[]>([])
  const [renaming, setRenaming] = useState<SqlDraftTab | null>(null), [title, setTitle] = useState('')
  const [visits, setVisits] = useState<SqlTabVisits>({ entries: [], index: -1 })
  const [remote, setRemote] = useState<SqlDraftState | null>(null), [inspectBusy, setInspectBusy] = useState(false)
  const editor = useRef<EditorView | null>(null), locks = useRef(new Set<string>()), alive = useRef(true)
  const editorCache = useRef<SqlEditorCache>(new Map())
  const library = useSqlResource<SavedSqlLibrary>(libraryBase, undefined, revision)
  const busyIds = new Set(Object.keys(executions).filter((id) => executions[id].running))
  const execution = current ? executions[current.id] : undefined
  const running = execution?.running ?? false
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (state.ready && !state.pending && state.status === 'ready' && !Object.values(executions).some((item) => item.running)) onLeaveReady() }, [state.ready, state.pending, state.status, executions, onLeaveReady])
  useEffect(() => {
    beforeLeaveRef.current = () => { if (locks.current.size) return Promise.reject(new Error('仍有查询正在执行，请等待执行结束后返回')); return controller.flush() }
    return () => { beforeLeaveRef.current = null }
  }, [beforeLeaveRef, controller])
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
    let number = state.tabs.length + 1; while (state.tabs.some((tab) => tab.title === `查询 ${number}`)) number++
    const tab = newSqlTab(session.provider === 'mysql' ? schema || session.database : session.database, schema || null, `查询 ${number}`)
    controller.update((snapshot) => ({ tabs: [...snapshot.tabs, tab], activeTabId: tab.id })); setPanel(null)
  }
  function saveCurrent() {
    if (current && !running && libraryBase && !library.busy && sqlTabSaveable(current)) setSaving({ tabId: current.id, sql: editor.current?.state.doc.toString() ?? current.sql, schema: current.schema ?? (schema || null), database: current.database, file: current.savedFile })
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
    setExecutions((items) => { const next = { ...items }; delete next[tab.id]; return next })
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
  async function run() {
    if (!current || locks.current.has(current.id)) return
    const issue = targetIssue(current)
    if (issue) { setNotice(issue); return }
    const id = current.id, view = editor.current, selection = view?.state.selection.main
    const sql = selection && !selection.empty ? view!.state.sliceDoc(selection.from, selection.to) : view?.state.doc.toString() ?? current.sql
    locks.current.add(id); setExecutions((items) => ({ ...items, [id]: { running: true, result: null, error: '' } })); setNotice('')
    try {
      const result = await backendFetch<DatabaseQueryResult>(`${base}/query`, { method: 'POST', body: JSON.stringify({ sql, schema: session.provider === 'mysql' ? current.database : current.schema ?? (schema || null), maxRows: 500 }) })
      if (alive.current) setExecutions((items) => ({ ...items, [id]: { running: false, result, error: '' } }))
    } catch (reason) {
      if (alive.current) setExecutions((items) => ({ ...items, [id]: { running: false, result: null, error: reason instanceof Error ? reason.message : '查询失败' } }))
    } finally { locks.current.delete(id); if (alive.current) setRevision((value) => value + 1) }
  }
  function finishClose(tabs: SqlDraftTab[]) {
    const ids = tabs.map((tab) => tab.id)
    if (ids.some((id) => locks.current.has(id))) { setNotice('执行中的查询不能关闭，请等待执行结束。'); return }
    setClosed((previous) => {
      const next = [...previous, ...tabs].slice(-20), retained = new Set([...controller.getSnapshot().tabs.filter((tab) => !ids.includes(tab.id)), ...next].map((tab) => tab.id))
      for (const key of editorCache.current.keys()) if (!retained.has(key)) editorCache.current.delete(key)
      return next
    })
    controller.update((snapshot) => closeSqlTabs(snapshot, ids)); setClosing(null)
    setExecutions((items) => Object.fromEntries(Object.entries(items).filter(([id]) => !ids.includes(id))))
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
    editorCache.current = new Map(); setExecutions({}); setClosed([]); setRemote(null)
    if (snapshot) void controller.flush().catch(() => undefined)
  }
  const restoreError = restore ? targetIssue(restore.target) : ''
  const targetSchema = current ? session.provider === 'mysql' ? current.database : current.schema ?? schema : schema
  const { metadata, state: metadataState } = useSqlMetadata(session, metadataRevision)
  const complete = useCallback((context: CompletionContext) => metadata.complete(context, { schema: targetSchema, schemas }), [metadata, targetSchema, schemas])
  function refreshMetadata() { metadata.clear(); if (editor.current) { closeCompletion(editor.current); startCompletion(editor.current) } }
  const displayDatabase = current && session.provider === 'sqlite' ? current.database.replace(/^.*[\\/]/, '') : current?.database
  const draftStatus = <span className={tabsStyle.status} data-state={state.status} role="status">{state.status === 'error' ? <WarningCircle size={12} /> : !state.ready || state.status === 'saving' || state.pending ? <CircleNotch size={12} className="mw-spin" /> : <CheckCircle size={12} />}{!libraryBase ? '临时连接 · 草稿保留至离开' : state.status === 'error' ? state.ready ? '草稿保存失败 · 本地内容已保留' : '草稿读取失败 · 点击重试' : !state.ready ? '正在恢复设备草稿…' : state.status === 'saving' ? '正在保存草稿…' : state.pending ? '草稿待保存' : '草稿已保存到设备'}</span>
  return <div className={styles.workspace}>
    <div className={`${styles.query} mw-sql-workspace mw-live-sql`}>
      {state.ready && <SqlTabStrip snapshot={state} scope={libraryBase ?? base} busyIds={busyIds} canBack={Boolean(navigateSqlTabs(visits, -1, state))} canForward={Boolean(navigateSqlTabs(visits, 1, state))} canReopen={closed.length > 0} onSelect={select} onNew={add} onAction={action}
        onNavigate={(direction) => { const next = navigateSqlTabs(visits, direction, state); if (next) { setVisits(next.visits); select(next.id) } }} onReorder={(id, beforeId) => controller.update((snapshot) => reorderSqlTab(snapshot, id, beforeId))} />}
      <div className={`mw-sql-toolbar ${styles.toolbar}`}><div className={styles.actions}><button type="button" className="mw-run" aria-label={running ? '执行中…' : '运行'} title="运行 SQL · Ctrl / ⌘ + Enter · 优先运行选区" disabled={!current || running || !state.ready} onClick={() => void run()}>{running ? <CircleNotch size={16} className="mw-spin" /> : <Play size={16} weight="fill" />}<span>{running ? '执行中…' : '运行'}</span></button>
        <span className={styles.toolDivider} />
        <button type="button" aria-label="历史" title="查询历史" aria-pressed={panel === 'history'} onClick={() => setPanel((value) => value === 'history' ? null : 'history')}><ClockCounterClockwise size={17} /><span>历史</span></button>
        <button type="button" aria-label="SQL 库" aria-pressed={panel === 'library'} disabled={!libraryBase} title={!libraryBase ? '保存连接后可使用 SQL 库' : 'SQL 库'} onClick={() => setPanel((value) => value === 'library' ? null : 'library')}><FolderOpen size={17} /><span>SQL 库</span></button>
        <button type="button" aria-label="保存 SQL" title="保存 SQL · Ctrl / ⌘ + S" disabled={!current || running || !libraryBase || library.busy || !sqlTabSaveable(current)} onClick={saveCurrent}><FloppyDisk size={17} /><span>保存 SQL</span></button>
        <button type="button" aria-label="新建查询" title="新建查询" disabled={!state.ready} onClick={add}><FilePlus size={17} /><span>新建查询</span></button></div>
        {current && <label className={tabsStyle.target}><Database size={15} /><select aria-label="SQL 目标 Schema" value={targetSchema} disabled={running || schemaLocked} onChange={(event) => {
          const next = event.target.value; updateTab(current.id, session.provider === 'mysql' ? { database: next, schema: next } : { schema: next }); if (next !== schema) onSchemaChange(next)
        }}>{targetSchema && !schemas.includes(targetSchema) && <option value={targetSchema}>{targetSchema}（当前不可用）</option>}{schemas.map((item) => <option key={item}>{item}</option>)}</select><button type="button" aria-label="刷新 SQL 元数据" title={metadataState.pending ? '正在读取 SQL 元数据' : '刷新表与字段补全'} onClick={refreshMetadata}>{metadataState.pending ? <CircleNotch size={15} className="mw-spin" /> : <ArrowsClockwise size={15} />}</button></label>}
      </div>
      {state.error && <p role="alert" className={styles.error}>{state.error}<button type="button" onClick={() => void (state.ready ? controller.flush() : controller.load()).catch(() => undefined)}>重试草稿存储</button>{state.ready && <button type="button" disabled={inspectBusy} onClick={() => void inspect()}>查看设备版本</button>}</p>}
      {metadataState.error && <p role="alert" className={styles.error}>SQL 元数据读取失败：{metadataState.error}<button type="button" onClick={refreshMetadata}>重试元数据</button></p>}
      {(notice || library.error) && <p role={library.error ? 'alert' : 'status'} className={library.error ? styles.error : styles.notice}>{library.error || notice}{!library.error && <button type="button" aria-label="关闭 SQL 提示" onClick={() => setNotice('')}><X size={14} /></button>}</p>}
      {current ? <SqlEditorSplit editor={<div className="mw-editor" id="fouc-sql-query-document" role="tabpanel" aria-label={current.title}><SqlEditor provider={session.provider} documentId={current.id} value={current.sql} positions={current.editorPosition} cache={editorCache.current} complete={complete} completionScope={`${targetSchema}:${metadataRevision}`}
          onChange={(sql) => updateTab(current.id, { sql })} onPositionChange={(id, editorPosition) => { const tab = controller.getSnapshot().tabs.find((item) => item.id === id); if (tab && JSON.stringify(tab.editorPosition) !== JSON.stringify(editorPosition)) updateTab(id, { editorPosition }) }}
          onRun={() => void run()} onSave={saveCurrent} editorRef={editor} /></div>}
        status={<div className={styles.document}><span className={styles.language}>SQL</span><span title={current.database}>{displayDatabase}{current.schema && session.provider !== 'mysql' ? ` / ${current.schema}` : ''}</span><small><Lock size={12} />只读 · 选区优先执行</small>{draftStatus}</div>}
        result={execution?.error ? <div className="mw-result-state mw-result-failed" role="alert"><strong>查询未能完成</strong><p>{execution.error}</p><small>编辑内容已保留，可修改 SQL 后重新运行。</small></div> : running ? <div className="mw-result-state" role="status"><CircleNotch size={26} className="mw-spin" /><strong>正在执行查询</strong><span>可切换其他标签；结果会保留在当前查询中。</span></div> : execution?.result ? <>
          {execution.result.messages.filter((message) => message.severity === 'warning').map((message, index) => <p key={index} role="alert" className={styles.error}>{message.message}</p>)}<SqlQueryResult key={current.id} result={execution.result} view={current.resultView} onViewChange={(resultView) => updateTab(current.id, { resultView })} /></> : <div className="mw-result-state"><Table size={26} /><strong>查询结果</strong><span>运行 SQL 后在这里查看结果。</span><small><kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd> 运行查询</small></div>} />
      : <><div className={tabsStyle.empty}><p>{state.ready ? '没有打开的 SQL 查询' : '正在加载 SQL 草稿…'}</p>{state.ready && <button type="button" onClick={add}>新建查询</button>}</div><div className={styles.document}>{draftStatus}</div></>}
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
    {closing && <SqlDialog title="关闭 SQL 标签确认" role="alertdialog" onClose={() => setClosing(null)}><div className={common.formBody}><p>关闭 {closing.length} 个标签，其中 {closing.filter(sqlTabDirty).length} 个有修改。关闭后这些草稿会从设备恢复列表移除。</p><ul className={tabsStyle.closing}>{closing.map((tab) => <li key={tab.id}>{tab.title}{sqlTabDirty(tab) ? ' · 未保存到 SQL 文件' : ''}</li>)}</ul><small>可取消后逐个保存。当前工作台内可重新打开最近关闭的标签。</small></div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setClosing(null)}>保留标签</button><span /><button type="button" className={common.primary} onClick={() => finishClose(closing)}>放弃修改并关闭</button></footer></SqlDialog>}
    {renaming && <SqlDialog title="重命名 SQL 标签" onClose={() => setRenaming(null)}><form onSubmit={(event) => { event.preventDefault(); if (title.trim()) { updateTab(renaming.id, { title: title.trim(), customTitle: true }); setRenaming(null) } }}><div className={common.formBody}><label>标签名称<input aria-label="SQL 标签名称" value={title} maxLength={200} required autoFocus onChange={(event) => setTitle(event.target.value)} /></label><small>修改标签标题，SQL 文件名称可在 SQL 库中管理。</small></div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setRenaming(null)}>取消</button><span /><button type="submit" className={common.primary} disabled={!title.trim()}>确认标签名称</button></footer></form></SqlDialog>}
    {remote && <SqlDialog title="查看设备 SQL 草稿" onClose={() => setRemote(null)}><div className={common.formBody}><p>设备版本包含 {remote.tabs.length} 个标签。下方是设备中的完整 SQL；当前窗口内容仍保留。</p>{busyIds.size > 0 && <p role="status">仍有查询正在执行，结束后可替换或合并草稿。</p>}<div className={tabsStyle.preview}>{remote.tabs.map((tab) => <label key={tab.id}>{tab.title} · {tab.database}{tab.schema ? ` / ${tab.schema}` : ''}<textarea readOnly aria-label={`设备草稿 ${tab.title}`} value={tab.sql} /></label>)}</div></div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setRemote(null)}>保留当前内容</button><button type="button" className={common.secondary} disabled={busyIds.size > 0} onClick={() => adoptDeviceDrafts(false)}>用设备版本替换</button><button type="button" className={common.primary} disabled={busyIds.size > 0} onClick={() => adoptDeviceDrafts(true)}>保留本地并合并保存</button></footer></SqlDialog>}
  </div>
}
