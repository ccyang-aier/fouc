"use client"
import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { Play, ClockCounterClockwise, FolderOpen, FloppyDisk, FilePlus } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalSession, SavedSqlDocument, SavedSqlLibrary, SqlHistoryEntry } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlEditor } from './sql-editor'
import { SqlQueryResult } from './query-result'
import { SqlHistoryPanel } from './sql-history-panel'
import { SqlLibraryPanel } from './sql-library-panel'
import { SaveSqlDialog, SqlDialog } from './sql-library-dialog'
import { useSqlResource } from './use-sql-resource'
import common from './relational.module.css'
import styles from './sql-library.module.css'

type Restore = { sql: string; schema: string | null; database: string; file: SavedSqlDocument | null }
const DEFAULT_SQL = 'SELECT 1 AS result;'
export function RelationalQuery({ session, schema, schemas, schemaLocked, onSchemaChange }: {
  session: RelationalSession; schema: string; schemas: string[]; schemaLocked: boolean; onSchemaChange: (schema: string) => void
}) {
  const root = `/api/database/workspaces/${encodeURIComponent(session.workspaceId)}/relational`
  const base = `${root}/sessions/${session.id}`, libraryBase = session.connectionId ? `${root}/connections/${session.connectionId}/sql-library` : null
  const [query, setQuery] = useState(DEFAULT_SQL), [result, setResult] = useState<DatabaseQueryResult | null>(null), [running, setRunning] = useState(false), [error, setError] = useState('')
  const [panel, setPanel] = useState<'history' | 'library' | null>(null), [revision, setRevision] = useState(0), [file, setFile] = useState<SavedSqlDocument | null>(null)
  const [saving, setSaving] = useState<Restore | null>(null), [restore, setRestore] = useState<Restore | null>(null), [notice, setNotice] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const editor = useRef<EditorView | null>(null), lock = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const library = useSqlResource<SavedSqlLibrary>(libraryBase, undefined, revision)
  const database = session.provider === 'mysql' ? schema || session.database : session.database
  const dirty = query !== (file?.sql ?? DEFAULT_SQL)
  function saveCurrent() { if (!running && libraryBase && !library.busy) setSaving({ sql: editor.current?.state.doc.toString() ?? query, schema: schema || null, database, file }) }
  function restoreIssue(target: Restore): string {
    const nextSchema = session.provider === 'mysql' ? target.database : target.schema ?? schema
    if (session.provider !== 'mysql' && target.database !== session.database) return '保存的目标数据库与当前连接不同，请先连接到原目标数据库再恢复。'
    if (nextSchema && !schemas.includes(nextSchema)) return `目标 Schema ${nextSchema} 当前不可用，请核对连接和权限后重试。`
    if (schemaLocked && nextSchema !== schema) return '表格有待提交变更，请先提交或放弃变更后再恢复其他 Schema。'
    return ''
  }
  function apply(target: Restore) {
    const issue = restoreIssue(target); setRestoreError(issue); if (issue) return
    const nextSchema = session.provider === 'mysql' ? target.database : target.schema ?? schema
    if (nextSchema && nextSchema !== schema) onSchemaChange(nextSchema)
    setFile(target.file); setQuery(target.sql); setResult(null); setError(''); setRestore(null); setPanel(null); setNotice('已恢复 SQL 和目标上下文；点击运行后才会执行')
  }
  function requestRestore(target: Restore) { if (running) return; const issue = restoreIssue(target); setRestoreError(issue); if (issue || (dirty && target.sql !== query)) setRestore(target); else apply(target) }
  function historyRestore(entry: SqlHistoryEntry) { requestRestore({ sql: entry.sql, schema: entry.schema, database: entry.database, file: null }) }
  async function run() {
    if (lock.current) return
    const view = editor.current, selection = view?.state.selection.main
    const sql = selection && !selection.empty ? view!.state.sliceDoc(selection.from, selection.to) : view?.state.doc.toString() ?? query
    lock.current = true; setRunning(true); setError(''); setResult(null); setNotice('')
    try { const data = await backendFetch<DatabaseQueryResult>(`${base}/query`, { method: 'POST', body: JSON.stringify({ sql, schema: schema || null, maxRows: 500 }) }); if (alive.current) setResult(data) }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '查询失败') }
    finally { lock.current = false; if (alive.current) { setRunning(false); setRevision((value) => value + 1) } }
  }
  return <div className={styles.workspace}>
    <div className={`${styles.query} mw-sql-workspace mw-live-sql`}>
      <div className={`mw-sql-toolbar ${styles.toolbar}`}><button type="button" className="mw-run" disabled={running} onClick={() => void run()}><Play size={14} />{running ? '执行中…' : '运行'}</button>
        <button type="button" aria-pressed={panel === 'history'} disabled={running} onClick={() => setPanel((value) => value === 'history' ? null : 'history')}><ClockCounterClockwise size={14} />历史</button>
        <button type="button" aria-pressed={panel === 'library'} disabled={running || !libraryBase} title={!libraryBase ? '保存连接后可使用 SQL 库' : undefined} onClick={() => setPanel((value) => value === 'library' ? null : 'library')}><FolderOpen size={14} />SQL 库</button>
        <button type="button" disabled={running || !libraryBase || library.busy} onClick={saveCurrent}><FloppyDisk size={14} />保存 SQL</button>
        <button type="button" disabled={running} onClick={() => requestRestore({ sql: DEFAULT_SQL, schema: schema || null, database, file: null })}><FilePlus size={14} />新建查询</button>
        <span className="mw-sql-spacer" /><span className={styles.shortcut}>只读 · Ctrl/⌘ + Enter 运行 · Ctrl/⌘ + S 保存</span>
      </div>
      <div className={styles.document}><strong>{file?.name ?? '未命名查询'}{dirty && ' · 已修改'}</strong><span>{database}{schema && session.provider !== 'mysql' ? ` / ${schema}` : ''}</span><small>{file ? `上次保存 ${new Date(file.updatedAt).toLocaleTimeString()}` : '选择内容优先执行'}</small></div>
      {(notice || library.error) && <p role={library.error ? 'alert' : 'status'} className={library.error ? styles.error : styles.notice}>{library.error || notice}</p>}
      <div className="mw-editor"><SqlEditor provider={session.provider} value={query} onChange={setQuery} onRun={() => void run()} onSave={saveCurrent} editorRef={editor} /></div>
      <div className="mw-result">{error ? <p className="mw-result-error" role="alert">{error}</p> : running ? <p className="mw-live-result-empty" role="status">正在执行查询…</p> : result ? <>
        {result.messages.filter((message) => message.severity === 'warning').map((message, index) => <p key={index} role="alert" className={styles.error}>{message.message}</p>)}<SqlQueryResult result={result} /></> : <p className="mw-live-result-empty">运行 SQL 后在这里查看结果。</p>}</div>
    </div>
    {panel === 'history' && <SqlHistoryPanel base={`${base}/history`} revision={revision} canSave={Boolean(libraryBase)} onClose={() => setPanel(null)} onRestore={historyRestore} onSave={(entry) => setSaving({ sql: entry.sql, schema: entry.schema, database: entry.database, file: null })} />}
    {panel === 'library' && libraryBase && <SqlLibraryPanel base={libraryBase} library={library.data} busy={library.busy} error={library.error} onRefresh={() => setRevision((value) => value + 1)} onClose={() => setPanel(null)} onOpen={(document) => requestRestore({ sql: document.sql, schema: document.schema, database: document.database, file: document })}
      onUpdated={(document) => { if (file?.id === document.id && file.sql === document.sql) setFile(document) }}
      onDeleted={(ids) => { if (file && ids.includes(file.id)) { setFile(null); setNotice('SQL 文件已删除；当前编辑内容仍保留，可另存为新文件。') } }} />}
    {saving && libraryBase && <SaveSqlDialog base={libraryBase} {...saving} library={library.data} onClose={() => setSaving(null)} onSaved={(document) => {
      if (document.sql === query && document.database === database && document.schema === (schema || null)) setFile(document)
      setSaving(null); setNotice(`已保存 ${document.name}`); setRevision((value) => value + 1)
    }} />}
    {restore && <SqlDialog title="恢复 SQL 编辑内容" onClose={() => setRestore(null)}><div className={common.formBody}><p>{restoreError ? '保存的目标上下文当前无法恢复，编辑内容保持原样。' : '当前查询有修改。恢复后会替换完整编辑内容，并选择原目标 Schema。'}</p><small>恢复操作不会执行 SQL。</small>{restoreError && <p role="alert" className={styles.error}>{restoreError}</p>}</div><footer className={common.dialogFooter}><button type="button" className={common.secondary} onClick={() => setRestore(null)}>保留当前内容</button><span /><button type="button" className={common.primary} disabled={Boolean(restoreError)} onClick={() => apply(restore)}>替换并恢复</button></footer></SqlDialog>}
  </div>
}
