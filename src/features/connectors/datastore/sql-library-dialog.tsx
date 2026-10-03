"use client"
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { sqlFolderPath, type SavedSqlDocument, type SavedSqlLibrary } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import common from './relational.module.css'
import styles from './sql-library.module.css'

export function SqlDialog({ title, busy = false, role = 'dialog', className = '', onClose, children }: { title: string; busy?: boolean; role?: 'dialog' | 'alertdialog'; className?: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} role={role} className={`${common.dialog} ${styles.dialog} ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <header className={common.dialogHead}><h2>{title}</h2><button type="button" disabled={busy} aria-label={`关闭${title}`} onClick={onClose}><X size={18} /></button></header>{children}</dialog>
}
export function SaveSqlDialog({ base, sql, database, schema, library, file, onClose, onSaved }: {
  base: string; sql: string; database: string; schema: string | null; library: SavedSqlLibrary | null; file: Pick<SavedSqlDocument, 'id' | 'name' | 'folderId' | 'version'> | null;
  onClose: () => void; onSaved: (document: SavedSqlDocument) => void
}) {
  const [name, setName] = useState(file?.name ?? '查询.sql'), [folder, setFolder] = useState(file?.folderId ?? ''), [saveAs, setSaveAs] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    try { onSaved(await backendFetch<SavedSqlDocument>(`${base}/files${file && !saveAs ? `/${file.id}` : ''}`, { method: file && !saveAs ? 'PUT' : 'POST',
      body: JSON.stringify({ name, folderId: folder || null, database, schema, sql, ...(file && !saveAs ? { version: file.version } : {}) }) })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <SqlDialog title="保存 SQL 文件" busy={busy} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (!busy) void save() }}>
    <div className={common.formBody}><label>文件名称<input aria-label="SQL 文件名称" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} required autoFocus /></label>
      <label>保存文件夹<select aria-label="SQL 保存文件夹" value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">根目录</option>{library?.folders.map((entry) => <option key={entry.id} value={entry.id}>{sqlFolderPath(library.folders, entry.id)}</option>)}</select></label>
      {file && <label className={common.checkbox}><input type="checkbox" checked={saveAs} onChange={(event) => setSaveAs(event.target.checked)} />另存为新文件</label>}
      <small>数据库 {database || '默认'}{schema && schema !== database ? ` / ${schema}` : ''} · 完整 SQL {new TextEncoder().encode(sql).length.toLocaleString()} 字节</small>
      <small>保存完整编辑内容。文件名会补全 .sql；同位置名称冲突或文件版本变化会阻止保存。</small>{error && <p role="alert" className={styles.error}>{error}</p>}
    </div><footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={busy} onClick={onClose}>取消</button><span /><button type="submit" className={common.primary} disabled={busy || !name.trim()}>{busy ? '保存中…' : '确认保存 SQL'}</button></footer>
  </form></SqlDialog>
}
