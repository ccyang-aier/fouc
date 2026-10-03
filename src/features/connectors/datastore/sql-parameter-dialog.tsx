"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { BracketsCurly, Check, Copy, Play, WarningCircle } from '@phosphor-icons/react'
import { compileSqlTemplate, sqlParameterInputIssue, type RelationalProvider, type SqlParameterDescriptor, type SqlParameterInput } from '@fouc/shared'
import { SqlDialog } from './sql-library-dialog'
import { SqlEditor } from './sql-editor'
import common from './relational.module.css'
import styles from './sql-parameter.module.css'

export type SqlParameterRecents = Map<string, SqlParameterInput[]>
const kinds: { kind: SqlParameterInput['kind']; label: string }[] = [
  { kind: 'string', label: '字符串' }, { kind: 'number', label: '数字' }, { kind: 'boolean', label: '布尔值' }, { kind: 'null', label: 'NULL' }, { kind: 'raw', label: '原始 SQL' }
]
export function rememberSqlParameters(history: SqlParameterRecents, values: Record<string, SqlParameterInput>): void {
  for (const [key, input] of Object.entries(values)) {
    if (input.kind !== 'null' && !input.value) continue
    history.set(key, [{ ...input }, ...(history.get(key) ?? []).filter((item) => item.kind !== input.kind || item.value !== input.value)].slice(0, 8))
  }
}
export function SqlParameterDialog({ sql, declarationSql, provider, descriptors, history, targetLabel, onClose, onExecute }: {
  sql: string; declarationSql: string; provider: RelationalProvider; descriptors: SqlParameterDescriptor[];
  history: SqlParameterRecents; targetLabel: string; onClose: () => void; onExecute: (values: Record<string, SqlParameterInput>) => void
}) {
  const [values, setValues] = useState<Record<string, SqlParameterInput>>(() => Object.fromEntries(descriptors.map((item) => [item.key, { ...(history.get(item.key)?.[0] ?? { kind: 'string', value: '' }) }])))
  const [copied, setCopied] = useState(false), [copyError, setCopyError] = useState('')
  const previewEditor = useRef<EditorView | null>(null)
  const form = useRef<HTMLFormElement | null>(null)
  useEffect(() => { form.current?.querySelector<HTMLInputElement>('input')?.focus() }, [])
  const preview = useMemo(() => {
    try { return { sql: compileSqlTemplate(sql, provider, { parameters: values, declarationSql }).sql, error: '' } }
    catch (reason) { return { sql: '', error: reason instanceof Error ? reason.message : String(reason) } }
  }, [sql, provider, declarationSql, values])
  function update(key: string, input: SqlParameterInput) { setValues((previous) => ({ ...previous, [key]: input })); setCopied(false); setCopyError('') }
  async function copy() {
    try { await navigator.clipboard.writeText(preview.sql); setCopied(true); setCopyError('') }
    catch { setCopyError('复制失败，请选择预览中的 SQL 后手动复制。') }
  }
  const hasRaw = Object.values(values).some((input) => input.kind === 'raw')
  return <SqlDialog title="SQL 参数" className={styles.dialog} onClose={onClose}>
    <form ref={form} className={styles.form} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (!preview.error) onExecute(values) } }} onSubmit={(event) => { event.preventDefault(); if (!preview.error) onExecute(values) }}>
      <div className={styles.body}>
        <div className={styles.intro}><span className={styles.icon}><BracketsCurly size={21} /></span><div><strong>补全参数，预览执行语句</strong><p>{targetLabel} · {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'} · {descriptors.length} 个参数</p></div></div>
        <div className={styles.sectionHead}><span>参数值</span><small>仅用于本次执行</small><button type="button" onClick={() => { setValues(Object.fromEntries(descriptors.map((item) => [item.key, { kind: 'string', value: '' }]))); setCopied(false) }}>清空</button><button type="button" onClick={() => setValues((previous) => Object.fromEntries(Object.entries(previous).map(([key, input]) => [key, { ...input, kind: 'raw' }])))}>全部设为原始 SQL</button></div>
        <div className={styles.table} role="group" aria-label="SQL 参数列表">
          <div className={styles.tableHead}><span>名称 / 语法</span><span>类型</span><span>值</span></div>
          {descriptors.map((item, index) => {
            const input = values[item.key], recent = history.get(item.key) ?? [], issue = sqlParameterInputIssue(item, input), id = `sql-parameter-${index}`
            return <div key={item.key} className={styles.row}>
              <label htmlFor={id} className={styles.name}><strong title={item.name}>{item.name}</strong><code>{item.token}{item.collection ? ' · 集合' : ''}</code></label>
              <select aria-label={`${item.name} 类型`} value={input.kind} onChange={(event) => update(item.key, { ...input, kind: event.target.value as SqlParameterInput['kind'] })}>{kinds.map((kind) => <option key={kind.kind} value={kind.kind}>{kind.label}</option>)}</select>
              <div className={styles.value}><div className={styles.inputLine}><input id={id} aria-label={`${item.name} 参数值`} aria-invalid={Boolean(issue)} aria-describedby={issue ? `${id}-error` : undefined} autoFocus={index === 0} autoComplete="off" spellCheck={false} disabled={input.kind === 'null'} value={input.kind === 'null' ? 'NULL' : input.value} placeholder={item.collection ? '["Alpha", "Beta"] 或逗号分隔值' : input.kind === 'raw' ? 'SQL 表达式或片段' : '输入参数值'} onChange={(event) => update(item.key, { ...input, value: event.target.value })} />
                {recent.length > 0 && <select className={styles.recent} aria-label={`${item.name} 最近值`} title="此查询标签内的最近参数值" value="" onChange={(event) => { const entry = recent[Number(event.target.value)]; if (entry) update(item.key, { ...entry }) }}><option value="" disabled>最近</option>{recent.map((entry, position) => <option key={position} value={position}>{kinds.find((kind) => kind.kind === entry.kind)?.label} · {entry.kind === 'null' ? 'NULL' : entry.value}</option>)}</select>}
              </div>{issue && <small id={`${id}-error`} role="alert" className={styles.error}>{issue}</small>}</div>
            </div>
          })}
        </div>
        <div className={styles.sectionHead}><span>SQL 预览</span><small>展开后的执行语句</small><button type="button" disabled={Boolean(preview.error)} onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制 SQL'}</button></div>
        <div className={styles.preview}>{preview.error ? <p role="alert" className={styles.error}><WarningCircle size={15} />{preview.error}</p> : <SqlEditor value={preview.sql} onChange={() => {}} onRun={() => { if (!preview.error) onExecute(values) }} editorRef={previewEditor} provider={provider} readOnly label="SQL 参数预览" />}</div>
        <p className={styles.note}>{hasRaw ? <><WarningCircle size={14} />原始 SQL 会直接展开为表达式。执行前仍会校验整批语句的只读范围。</> : '字符串自动转义；数字保留精度；集合支持 JSON 数组。最近值仅保留在当前会话和查询标签内。'}</p>
        {copyError && <p role="alert" className={styles.error}>{copyError}</p>}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}><small>Ctrl / ⌘ + Enter 执行</small><button type="button" className={common.secondary} onClick={onClose}>取消</button><button type="submit" className={common.primary} disabled={Boolean(preview.error)}><Play size={14} weight="fill" />应用参数并执行</button></footer>
    </form>
  </SqlDialog>
}
