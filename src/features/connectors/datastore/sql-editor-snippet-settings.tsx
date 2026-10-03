"use client"

import { useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { ArrowDown, ArrowUp, CodeBlock, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import { SQL_SNIPPET_MAX_COUNT, SQL_SNIPPET_MAX_PREFIX_LENGTH, validateSqlSnippets, type RelationalProvider, type SqlSnippet } from '@fouc/shared'
import { SqlEditor } from './sql-editor'
import styles from './sql-editor-preferences.module.css'

export function sqlSnippetSettingsIssue(entries: readonly SqlSnippet[]): string {
  try { validateSqlSnippets(entries); return '' }
  catch (reason) { return reason instanceof Error ? reason.message : String(reason) }
}

export function SqlEditorSnippetSettings({ value, provider, disabled, onChange }: { value: SqlSnippet[]; provider: RelationalProvider; disabled: boolean; onChange: (value: SqlSnippet[]) => void }) {
  const [search, setSearch] = useState(''), [selectedId, setSelectedId] = useState<string | null>(value[0]?.id ?? null)
  const editor = useRef<EditorView | null>(null)
  const selected = value.find((entry) => entry.id === selectedId) ?? value[0]
  const filtered = value.filter((entry) => `${entry.label}\n${entry.prefix}\n${entry.body}`.toLowerCase().includes(search.toLowerCase()))
  function update(patch: Partial<SqlSnippet>) { if (selected) onChange(value.map((entry) => entry.id === selected.id ? { ...entry, ...patch } : entry)) }
  function add() {
    if (value.length >= SQL_SNIPPET_MAX_COUNT) return
    const prefixes = new Set(value.map((entry) => entry.prefix.toLowerCase()))
    let prefix = 'sql', index = 1
    while (prefixes.has(prefix)) prefix = `sql${index++}`
    const entry: SqlSnippet = { id: `custom-${crypto.randomUUID()}`, label: '新片段', prefix, body: 'SELECT ${value};', enabled: true }
    onChange([...value, entry]); setSelectedId(entry.id); setSearch('')
  }
  function remove() {
    if (!selected) return
    const index = value.indexOf(selected), next = value.filter((entry) => entry.id !== selected.id)
    onChange(next); setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null)
  }
  function move(direction: -1 | 1) {
    if (!selected) return
    const index = value.indexOf(selected), target = index + direction
    if (target < 0 || target >= value.length) return
    const next = [...value]; [next[index], next[target]] = [next[target], next[index]]; onChange(next)
  }
  return <div className={styles.snippetsLayout}>
    <aside className={styles.snippetList}><div className={styles.sectionHeading}><CodeBlock size={16} /><h3>SQL 片段</h3><small>{value.filter((entry) => entry.enabled).length} / {value.length} 启用</small><button type="button" className={styles.iconButton} aria-label="新建 SQL 片段" disabled={disabled || value.length >= SQL_SNIPPET_MAX_COUNT} onClick={add}><Plus size={15} /></button></div>
      <label className={styles.search}><MagnifyingGlass size={15} /><input aria-label="搜索 SQL 片段" placeholder="搜索名称或触发词" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className={styles.snippetRows} role="list" aria-label="SQL 片段列表">{filtered.length ? filtered.map((entry) => <button type="button" role="listitem" key={entry.id} className={styles.snippetRow} data-selected={selected?.id === entry.id} disabled={disabled} onClick={() => setSelectedId(entry.id)}><span className={styles.snippetTrigger}>{entry.prefix || '—'}</span><span className={styles.snippetName}><strong>{entry.label || '未命名片段'}</strong><small>{entry.id.startsWith('builtin-') ? '内置片段' : '自定义片段'}</small></span><span className={styles.enabledDot} data-enabled={entry.enabled} aria-label={entry.enabled ? '已启用' : '已停用'} /></button>) : <div className={styles.empty}><MagnifyingGlass size={22} /><strong>{value.length ? '没有匹配的片段' : '添加你的第一个 SQL 片段'}</strong><p>{value.length ? '试试其他名称或触发词。' : '将常用查询保存在当前连接中。'}</p></div>}</div>
    </aside>
    <section className={styles.snippetDetail} aria-label="SQL 片段编辑">{selected ? <>
      <div className={styles.sectionHeading}><h3>编辑片段</h3><label className={styles.check}><input type="checkbox" checked={selected.enabled} disabled={disabled} onChange={(event) => update({ enabled: event.target.checked })} />启用</label><button type="button" className={styles.iconButton} title="上移片段" aria-label="上移 SQL 片段" disabled={disabled || value.indexOf(selected) === 0} onClick={() => move(-1)}><ArrowUp size={14} /></button><button type="button" className={styles.iconButton} title="下移片段" aria-label="下移 SQL 片段" disabled={disabled || value.indexOf(selected) === value.length - 1} onClick={() => move(1)}><ArrowDown size={14} /></button><button type="button" className={`${styles.iconButton} ${styles.danger}`} aria-label="删除 SQL 片段" title="删除片段，保存后生效" disabled={disabled} onClick={remove}><Trash size={15} /></button></div>
      <fieldset disabled={disabled} className={styles.snippetFields}><label>片段名称<input aria-label="SQL 片段名称" maxLength={200} value={selected.label} onChange={(event) => update({ label: event.target.value })} /></label><label>触发词<input aria-label="SQL 片段触发词" maxLength={SQL_SNIPPET_MAX_PREFIX_LENGTH} spellCheck={false} value={selected.prefix} onChange={(event) => update({ prefix: event.target.value })} /></label></fieldset>
      <div className={styles.snippetCodeHeading}><span>SQL 内容</span><small>输入触发词后选择片段插入</small></div><div className={styles.snippetCode}><SqlEditor key={selected.id} documentId={selected.id} value={selected.body} onChange={(body) => update({ body })} onRun={() => {}} editorRef={editor} provider={provider} readOnly={disabled} label="SQL 片段内容" snippets={[]} /></div>
      <p className={styles.previewNote}>用 <code>{'${字段}'}</code> 定义可替换内容，插入后按 Tab / Shift + Tab 切换字段。自定义 SQL 保持原样。</p>
    </> : <div className={styles.empty}><CodeBlock size={28} /><strong>常用 SQL，随手插入</strong><p>新建片段后，可以设置触发词和可替换字段。</p><button type="button" disabled={disabled} className={styles.textButton} onClick={add}><Plus size={14} />新建片段</button></div>}</section>
  </div>
}
