"use client"

import { useMemo, useRef, useState, type RefObject } from 'react'
import type { EditorView } from '@codemirror/view'
import type { RelationalProvider, SqlFormatterCase } from '@fouc/shared'
import { ArrowSquareOut, BracketsCurly, Check, Clipboard, CodeBlock, Columns, Lightning, Table, TextAa, WarningCircle } from '@phosphor-icons/react'
import { SqlDialog } from './sql-library-dialog'
import { SqlEditor } from './sql-editor'
import { captureSqlAction, applySqlAction, sqlTextActionEdit, type SqlActionSnapshot, type SqlTextAction } from './sql-assistance/actions/editor-actions'
import { formatSqlText, compressSqlText } from './sql-format/formatter'
import { analyzeIntentionActions, type IntentionAction } from './sql-assistance/actions/intention-actions'
import { intentionActionEdit, sqlBlockCommentEdit, sqlInListEdit, sqlInListIssue, sqlLineCommentEdit, sqlWildcardEdit, sqlWildcardFields } from './sql-assistance/actions/action-edits'
import { buildSqlTableShortcut, normalizeSqlShortcutLimit, sqlShortcutContextTable, sqlTableNameIssue, sqlTableShortcutEdit } from './sql-assistance/actions/table-shortcuts'
import common from './relational.module.css'
import styles from './sql-quick-actions.module.css'

type Props = { editorRef: RefObject<EditorView | null>; provider: RelationalProvider; disabled: boolean; keywordCase?: SqlFormatterCase; onFormatSql?: (sql: string) => Promise<string>; onNotice: (message: string) => void }
const textActions: { id: SqlTextAction; label: string; note: string }[] = [
  { id: 'upper', label: '转换为大写', note: '保留跨选区的字符串内容' }, { id: 'lower', label: '转换为小写', note: '保留跨选区的字符串内容' },
  { id: 'quote-string', label: 'SQL 字符串引用', note: '转义引号，保留内容精度' }, { id: 'quote-identifier', label: '标识符引用', note: '使用当前数据库的引号' },
  { id: 'unquote', label: '移除外层引用', note: '解码成对的引号' }, { id: 'json-string', label: '转换为 JSON 字符串', note: '用于应用中的查询文本' }
]

export function SqlQuickActions({ editorRef, provider, disabled, keywordCase = 'upper', onFormatSql, onNotice }: Props) {
  const [snapshot, setSnapshot] = useState<SqlActionSnapshot | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'context' | 'text' | 'in' | 'table'>('context'), [inSource, setInSource] = useState(''), [copied, setCopied] = useState(false)
  const [tableName, setTableName] = useState(''), [limit, setLimit] = useState('100'), [projection, setProjection] = useState('id, name'), [tableKind, setTableKind] = useState<'select' | 'count' | 'projection'>('select')
  const [wildcard, setWildcard] = useState(false), [fields, setFields] = useState<Record<string, string>>({})
  const previewEditor = useRef<EditorView | null>(null)
  const intentions = useMemo(() => snapshot ? analyzeIntentionActions({ sql: snapshot.state.doc.toString(), cursor: snapshot.state.selection.main.head, databaseType: provider, selection: snapshot.state.selection.main }) : [], [snapshot, provider])
  const sources = useMemo(() => snapshot ? sqlWildcardFields(snapshot, provider) : [], [snapshot, provider])
  const inPreview = useMemo(() => snapshot ? sqlInListEdit(snapshot, inSource, provider, keywordCase) : null, [snapshot, inSource, provider, keywordCase])
  const tableIssue = sqlTableNameIssue(tableName, provider) || (tableKind !== 'count' && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100_000) ? '行数须为 1 至 100,000 的整数。' : '')
  const tableSql = buildSqlTableShortcut(tableKind, tableName, normalizeSqlShortcutLimit(limit), projection, keywordCase)
  function open() {
    const current = captureSqlAction(editorRef.current)
    if (!current) return
    setSnapshot(current); setError(''); setCopied(false); setWildcard(false); setTab('context')
    const range = current.state.selection.main
    setInSource(range.empty ? '' : current.state.sliceDoc(range.from, range.to)); setTableName(sqlShortcutContextTable(current, provider))
    setFields(Object.fromEntries(sqlWildcardFields(current, provider).map((source) => [source.id, source.fields.join('\n')])))
  }
  function close() { setSnapshot(null); editorRef.current?.focus() }
  function finish(edit: Parameters<typeof applySqlAction>[2], notice: string) {
    if (!snapshot || disabled) return
    if (!applySqlAction(() => editorRef.current, snapshot, edit)) { setError('编辑内容已变化，请关闭后重新打开快速操作。'); return }
    close(); onNotice(notice)
  }
  function apply(id: SqlTextAction) {
    if (!snapshot) return
    const edit = sqlTextActionEdit(snapshot, id, provider)
    if (!edit) { setError('请选择可转换的 SQL 文本。'); return }
    finish(edit, 'SQL 已更新，可使用撤销恢复。')
  }
  async function transform(kind: 'format' | 'compress') {
    if (!snapshot || busy) return
    const range = snapshot.state.selection.main, from = range.empty ? 0 : range.from, to = range.empty ? snapshot.state.doc.length : range.to
    const original = snapshot.state.sliceDoc(from, to)
    setBusy(true); setError('')
    try {
      const result = kind === 'format' ? await (onFormatSql ? onFormatSql(original) : formatSqlText(original, provider)) : compressSqlText(original, provider)
      if (result === original) { close(); onNotice('SQL 文本已经符合当前规则。'); return }
      if (!applySqlAction(() => editorRef.current, snapshot, { changes: { from, to, insert: result }, anchor: from, head: from + result.length })) throw new Error('编辑内容已变化，请重新打开快速操作。')
      close(); onNotice(kind === 'format' ? 'SQL 已格式化。' : 'SQL 已压缩。')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  async function copy() {
    if (!snapshot) return
    const range = snapshot.state.selection.main
    try { await navigator.clipboard.writeText(snapshot.state.sliceDoc(range.empty ? 0 : range.from, range.empty ? snapshot.state.doc.length : range.to)); setCopied(true); setError(''); onNotice('SQL 已复制。') }
    catch { setError('复制失败，请选择 SQL 后手动复制。') }
  }
  async function readClipboard() {
    if (busy) return
    setBusy(true); setError('')
    try { setInSource(await navigator.clipboard.readText()) }
    catch { setError('无法读取剪贴板，请在下面直接粘贴列表。') }
    finally { setBusy(false) }
  }
  function runIntention(action: IntentionAction) {
    if (action.kind === 'expand_wildcard') { setWildcard(true); return }
    finish(intentionActionEdit(action), action.kind === 'batch_qualify_identifiers' ? `已限定 ${action.replacements?.length ?? 0} 个字段，可单次撤销。` : '字段引用已更新。')
  }
  async function expand() {
    if (!snapshot) return
    const values = Object.fromEntries(Object.entries(fields).map(([id, source]) => [id, source.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)]))
    setBusy(true)
    try {
      const edit = await sqlWildcardEdit(snapshot, provider, values)
      if (!edit) { setError('请为每个表填写实际字段，每行一个名称。'); return }
      finish(edit, '已将通配符展开为指定字段。')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const locked = busy || disabled
  const range = snapshot?.state.selection.main
  const preview = tab === 'in' && inPreview?.result.ok ? inPreview.result.sql : tab === 'table' ? tableSql : snapshot?.state.sliceDoc(range?.empty ? 0 : range!.from, range?.empty ? snapshot.state.doc.length : range!.to) ?? ''
  return <><button type="button" disabled={disabled} aria-label="SQL 快速操作" onClick={open}><Lightning size={14} />快速操作</button>{snapshot && <SqlDialog title="SQL 快速操作" busy={busy} className={styles.dialog} onClose={close}>
    <div className={styles.intro}><span className={styles.icon}><Lightning size={21} /></span><div><strong>让编辑更顺手</strong><p>{range?.empty ? '光标与完整文档' : `已选择 ${range!.to - range!.from} 个字符`} · {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}</p></div></div>
    <nav className={styles.tabs} role="tablist" aria-label="SQL 快速操作分类">{([{ key: 'context', label: '光标意图', Icon: Lightning }, { key: 'text', label: '文本编辑', Icon: TextAa }, { key: 'in', label: 'IN 列表', Icon: Clipboard }, { key: 'table', label: '表查询', Icon: Table }] as const).map(({ key, label, Icon }) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setError('') }}><Icon size={14} />{label}</button>)}</nav>
    <div className={styles.body}>
      {tab === 'context' && <section><div className={styles.sectionHeading}><Lightning size={15} /><strong>当前 SQL 的编辑意图</strong></div>{intentions.length ? <div className={styles.intentions}>{intentions.map((action, index) => <button key={index} type="button" disabled={locked} onClick={() => runIntention(action)}><Columns size={15} /><span>{action.kind === 'expand_wildcard' ? '将 * 展开为字段' : action.kind === 'batch_qualify_identifiers' ? `为选区的 ${action.replacements?.length ?? 0} 个字段添加限定符` : action.kind === 'unqualify_identifier' ? '移除表限定符' : `限定为 ${action.label ?? action.replacement}`}</span><code>{action.kind === 'expand_wildcard' ? '显式字段列表' : action.replacement || '保留已限定字段与字符串'}</code></button>)}</div> : <div className={styles.empty}><Lightning size={24} /><strong>当前位置没有可用的字段操作</strong><p>将光标放在字段或 SELECT * 上；选择多个字段可批量添加表限定符。</p></div>}
        {wildcard && <div className={styles.fieldForm}><div className={styles.sectionHeading}><Columns size={15} /><strong>确认需要展开的字段</strong></div>{sources.map((source) => <label key={source.id}>{source.label}<small>{source.fields.length ? '源自当前 SQL 的已知投影，可修改' : '请填写实际字段，每行一个名称'}</small><textarea aria-label={`${source.label} 展开字段`} value={fields[source.id] ?? ''} disabled={locked} onChange={(event) => setFields((current) => ({ ...current, [source.id]: event.target.value }))} /></label>)}<button type="button" className={common.primary} disabled={locked || sources.some((source) => !fields[source.id]?.trim())} onClick={() => void expand()}>替换通配符</button></div>}
        <div className={styles.utilityActions}><button type="button" disabled={locked} onClick={() => finish(sqlLineCommentEdit(snapshot), '行注释已切换。')}>切换行注释</button><button type="button" disabled={locked || range?.empty} onClick={() => { const edit = sqlBlockCommentEdit(snapshot, provider); if (edit) finish(edit, '块注释已切换。'); else setError('请选择不含块注释结束符的文本。') }}>切换块注释</button></div>
      </section>}
      {tab === 'text' && <><div className={styles.sectionHeading}><TextAa size={15} /><strong>选区操作</strong></div><div className={styles.actionGrid}>{textActions.map((entry) => <button type="button" key={entry.id} disabled={locked || range?.empty && entry.id !== 'quote-string'} onClick={() => apply(entry.id)}><span>{entry.label}</span><small>{entry.note}</small></button>)}</div>
      <div className={styles.sectionHeading}><CodeBlock size={15} /><strong>SQL 文本</strong></div><div className={styles.utilityActions}><button type="button" disabled={locked} onClick={() => void transform('format')}><BracketsCurly size={14} />格式化</button><button type="button" disabled={locked} onClick={() => void transform('compress')}><ArrowSquareOut size={14} />压缩</button><button type="button" disabled={locked} onClick={() => void copy()}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? '已复制' : '复制 SQL'}</button></div></>}
      {tab === 'in' && <div className={styles.fieldForm}><div className={styles.sectionHeading}><Clipboard size={15} /><strong>将列表转换为 IN 条件</strong><button type="button" disabled={locked} className={styles.textButton} onClick={() => void readClipboard()}>读取剪贴板</button></div><label>列表内容<textarea aria-label="IN 列表源内容" value={inSource} disabled={locked} spellCheck={false} placeholder={'Alpha\nBeta\nO\'Reilly'} onChange={(event) => setInSource(event.target.value)} /></label><p>支持换行、逗号、Tab、简单斜杠列表；字符串自动转义，未加引号的 NULL 保留为空值。</p>{inSource && inPreview && !inPreview.result.ok && <p className={styles.error} role="alert">{sqlInListIssue(inPreview.result)}</p>}<button type="button" className={common.primary} disabled={locked || !inPreview?.edit} onClick={() => { if (inPreview?.edit) finish(inPreview.edit, `已插入 ${inPreview.result.ok ? inPreview.result.valueCount : 0} 个列表值。`) }}>插入 IN 条件</button></div>}
      {tab === 'table' && <div className={styles.fieldForm}><div className={styles.sectionHeading}><Table size={15} /><strong>基于当前表生成查询</strong></div><div className={styles.tableModes} role="group" aria-label="表查询类型">{([{ kind: 'select', label: '前 N 行' }, { kind: 'count', label: '行数统计' }, { kind: 'projection', label: '字段投影' }] as const).map(({ kind, label }) => <button key={kind} type="button" aria-pressed={tableKind === kind} onClick={() => setTableKind(kind)}>{label}</button>)}</div><div className={styles.tableFields}><label>表名<input aria-label="快捷查询表名" value={tableName} disabled={locked} placeholder="schema.table" onChange={(event) => setTableName(event.target.value)} /></label>{tableKind !== 'count' && <label>返回行数<input aria-label="快捷查询返回行数" value={limit} disabled={locked} inputMode="numeric" onChange={(event) => setLimit(event.target.value)} /></label>}</div>{tableKind === 'projection' && <label>字段或 SQL 表达式<textarea aria-label="快捷查询字段投影" value={projection} disabled={locked} onChange={(event) => setProjection(event.target.value)} /></label>}{tableIssue && <p className={styles.error} role="alert">{tableIssue}</p>}<p>生成的查询追加到文档，保留原始内容；由你检查后执行。</p><button type="button" className={common.primary} disabled={locked || Boolean(tableIssue) || tableKind === 'projection' && !projection.trim()} onClick={() => finish(sqlTableShortcutEdit(snapshot, tableSql), '表查询已添加到 SQL 文档。')}>添加查询到文档</button></div>}
      <div className={styles.preview}><SqlEditor value={preview} onChange={() => {}} onRun={() => {}} editorRef={previewEditor} provider={provider} readOnly label="快速操作 SQL 预览" /></div>
      {error && <p className={styles.error} role="alert"><WarningCircle size={14} />{error}</p>}
    </div><footer className={`${common.dialogFooter} ${styles.footer}`}><small>操作只修改编辑内容 · 支持单次撤销</small><button type="button" className={common.secondary} disabled={busy} onClick={close}>关闭</button></footer>
  </SqlDialog>}</>
}
