"use client"

import { useState } from 'react'
import { ArrowClockwise, Check, CodeBlock, FloppyDisk, SlidersHorizontal, WarningCircle } from '@phosphor-icons/react'
import type { RelationalProvider, SqlEditorPreferences } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlDialog } from './sql-library-dialog'
import { SqlEditorFormatterSettings } from './sql-editor-formatter-settings'
import { SqlEditorSnippetSettings, sqlSnippetSettingsIssue } from './sql-editor-snippet-settings'
import common from './relational.module.css'
import styles from './sql-editor-preferences.module.css'

type Props = { base: string; initial: SqlEditorPreferences; provider: RelationalProvider; onSaved: (value: SqlEditorPreferences) => void; onClose: () => void }
function content(value: SqlEditorPreferences): string { return JSON.stringify([value.formatter, value.formatOnSave, value.snippets]) }

/** One connection owns the draft; failed writes never replace the user's local edits. */
export function SqlEditorPreferencesDialog({ base, initial, provider, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState<SqlEditorPreferences>(() => structuredClone(initial)), [tab, setTab] = useState<'format' | 'snippets'>('format')
  const [busy, setBusy] = useState<'save' | 'read' | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [formatterIssue, setFormatterIssue] = useState('')
  const [remote, setRemote] = useState<SqlEditorPreferences | null>(null), [discard, setDiscard] = useState(false)
  const [loadedRevision, setLoadedRevision] = useState(0)
  const dirty = content(draft) !== content(initial), issue = formatterIssue || sqlSnippetSettingsIssue(draft.snippets)
  function close() { if (busy) return; if (dirty || formatterIssue) setDiscard(true); else onClose() }
  async function save() {
    if (busy || issue) return
    setBusy('save'); setError(''); setNotice('')
    try {
      const saved = await backendFetch<SqlEditorPreferences>(`${base}/preferences`, { method: 'PUT', body: JSON.stringify({ version: draft.version, formatter: draft.formatter, formatOnSave: draft.formatOnSave, snippets: draft.snippets }) })
      onSaved(saved)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(null) }
  }
  async function readRemote() {
    if (busy) return
    setBusy('read'); setNotice('')
    try { setRemote(await backendFetch<SqlEditorPreferences>(`${base}/preferences`)); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(null) }
  }
  function useRemote() {
    if (!remote) return
    setDraft(structuredClone(remote)); setRemote(null); setLoadedRevision((current) => current + 1); setFormatterIssue(''); setNotice('已载入设备版本，保存后应用于编辑器。')
  }
  function retainDraft() {
    if (!remote) return
    setDraft((current) => ({ ...current, version: remote.version, updatedAt: remote.updatedAt })); setRemote(null); setNotice('已保留当前编辑。点击保存后，以当前编辑替换设备版本。')
  }
  return <SqlDialog title="SQL 编辑器设置" busy={Boolean(busy)} className={styles.dialog} onClose={close}>
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void save() }}>
      <div className={styles.intro}><div><strong>让每次查询保持整洁</strong><p>排版规则与常用片段 · 仅作用于当前工作空间和连接</p></div><span className={styles.scopeBadge}>{provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}</span></div>
      <nav className={styles.tabs} role="tablist" aria-label="SQL 编辑器设置分类"><button type="button" role="tab" aria-selected={tab === 'format'} aria-controls="sql-preferences-format" id="sql-preferences-format-tab" onClick={() => setTab('format')}><SlidersHorizontal size={15} />格式化</button><button type="button" role="tab" aria-selected={tab === 'snippets'} aria-controls="sql-preferences-snippets" id="sql-preferences-snippets-tab" onClick={() => setTab('snippets')}><CodeBlock size={15} />代码片段<span>{draft.snippets.length}</span></button><label className={styles.saveToggle}><input type="checkbox" disabled={Boolean(busy)} checked={draft.formatOnSave} onChange={(event) => setDraft((current) => ({ ...current, formatOnSave: event.target.checked }))} />保存文件时自动格式化</label></nav>
      <div className={styles.body}>
        <div id="sql-preferences-format" role="tabpanel" aria-labelledby="sql-preferences-format-tab" hidden={tab !== 'format'} key={`format-${loadedRevision}`}><SqlEditorFormatterSettings value={draft.formatter} provider={provider} disabled={Boolean(busy)} onChange={(formatter) => setDraft((current) => ({ ...current, formatter }))} onIssueChange={setFormatterIssue} /></div>
        <div id="sql-preferences-snippets" role="tabpanel" aria-labelledby="sql-preferences-snippets-tab" hidden={tab !== 'snippets'}><SqlEditorSnippetSettings value={draft.snippets} provider={provider} disabled={Boolean(busy)} onChange={(snippets) => setDraft((current) => ({ ...current, snippets }))} /></div>
      </div>
      <div className={styles.feedback}>
        {issue && <p className={styles.error} role="alert"><WarningCircle size={14} />{issue}</p>}
        {error && <div className={styles.errorBox} role="alert"><WarningCircle size={16} /><div><strong>设置未保存，当前编辑已保留</strong><p>{error}</p></div><button type="button" className={styles.textButton} disabled={Boolean(busy)} onClick={() => void readRemote()}><ArrowClockwise size={13} />{busy === 'read' ? '读取中…' : '查看设备版本'}</button></div>}
        {remote && <div className={styles.conflictBox}><div><strong>已读取设备上的设置</strong><p>请选择如何处理当前编辑。{remote.updatedAt ? `设备版本更新于 ${new Date(remote.updatedAt).toLocaleString()}` : '设备尚未保存自定义设置。'}</p></div><div className={styles.conflictActions}><button type="button" className={common.secondary} onClick={useRemote}>使用设备版本</button><button type="button" className={common.secondary} onClick={retainDraft}>以设备版本为基础保留当前编辑</button></div></div>}
        {notice && <p className={styles.notice} role="status"><Check size={14} />{notice}</p>}
        {discard && <div className={styles.discardBox} role="alert"><strong>放弃尚未保存的修改？</strong><button type="button" className={styles.textButton} onClick={() => setDiscard(false)}>继续编辑</button><button type="button" className={`${styles.textButton} ${styles.danger}`} onClick={onClose}>放弃修改</button></div>}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}><small>{busy === 'save' ? '正在保存到当前连接…' : dirty ? '有尚未保存的修改' : '格式化快捷键 Ctrl / ⌘ + Shift + F'}</small><button type="button" className={common.secondary} disabled={Boolean(busy)} onClick={close}>取消</button><button type="submit" className={common.primary} disabled={Boolean(busy) || Boolean(issue) || Boolean(remote)}><FloppyDisk size={14} />{busy === 'save' ? '保存中…' : '保存设置'}</button></footer>
    </form>
  </SqlDialog>
}
