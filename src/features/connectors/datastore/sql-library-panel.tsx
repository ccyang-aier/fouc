"use client"
import { useState, type ReactNode } from 'react'
import { ArrowsClockwise, CaretDown, CaretRight, FileCode, Folder, FolderPlus, PencilSimple, Trash, Copy, ArrowUp, ArrowDown, X } from '@phosphor-icons/react'
import { savedSqlScore, sqlFolderPath, type SavedSqlDocument, type SavedSqlFile, type SavedSqlFolder, type SavedSqlLibrary } from '@fouc/shared'
import { backendFetch } from '@/lib/backend'
import { SqlDialog } from './sql-library-dialog'
import common from './relational.module.css'
import styles from './sql-library.module.css'

type Edit = { kind: 'folder'; folder: SavedSqlFolder | null; parent: string | null } | { kind: 'file'; file: SavedSqlFile }
export function SqlLibraryPanel({ base, library, busy, error, onRefresh, onClose, onOpen, onUpdated, onDeleted }: {
  base: string; library: SavedSqlLibrary | null; busy: boolean; error: string; onRefresh: () => void; onClose: () => void; onOpen: (file: SavedSqlDocument) => void;
  onUpdated: (file: SavedSqlDocument) => void; onDeleted: (ids: string[]) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set()), [search, setSearch] = useState(''), [sort, setSort] = useState('folder')
  const [edit, setEdit] = useState<Edit | null>(null), [name, setName] = useState(''), [parent, setParent] = useState(''), [moving, setMoving] = useState(false)
  const [removing, setRemoving] = useState<{ kind: 'folder' | 'file'; id: string; name: string; version?: string } | null>(null)
  const [actionBusy, setActionBusy] = useState(false), [actionError, setActionError] = useState(''), [notice, setNotice] = useState('')
  const files = library?.files ?? [], folders = library?.folders ?? [], normalizedSearch = search.trim().toLocaleLowerCase()
  const matches = (file: SavedSqlFile) => !normalizedSearch || `${file.name} ${file.database} ${file.schema ?? ''}`.toLocaleLowerCase().includes(normalizedSearch)
  async function action(work: () => Promise<unknown>, message = '') {
    if (actionBusy) return
    setActionBusy(true); setActionError(''); setNotice('')
    try { await work(); onRefresh(); setNotice(message) }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setActionBusy(false) }
  }
  function beginEdit(next: Edit) { setActionError(''); setMoving(false); setEdit(next); setName(next.kind === 'file' ? next.file.name : next.folder?.name ?? '新建文件夹'); setParent(next.kind === 'file' ? next.file.folderId ?? '' : next.folder?.parentFolderId ?? next.parent ?? '') }
  async function saveMetadata() {
    if (!edit) return
    await action(async () => {
      const document = await backendFetch<SavedSqlDocument | SavedSqlFolder>(`${base}/${edit.kind === 'folder' ? 'folders' : 'files'}${edit.kind === 'folder' ? edit.folder ? `/${edit.folder.id}` : '' : `/${edit.file.id}`}`, {
        method: edit.kind === 'folder' && !edit.folder ? 'POST' : 'PUT', body: JSON.stringify(edit.kind === 'folder' ? { name, parentFolderId: moving || !edit.folder ? parent || null : edit.folder.parentFolderId } : { name, folderId: moving ? parent || null : edit.file.folderId, version: edit.file.version }),
      }); if ('sql' in document) onUpdated(document); setEdit(null)
    }, '已保存名称和位置')
  }
  async function reorder(file: SavedSqlFile, direction: number) {
    const siblings = files.filter((item) => item.folderId === file.folderId && item.database === file.database).sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
    const index = siblings.findIndex((item) => item.id === file.id), target = index + direction
    if (target < 0 || target >= siblings.length) return
    ;[siblings[index], siblings[target]] = [siblings[target], siblings[index]]
    await action(() => backendFetch(`${base}/order`, { method: 'PUT', body: JSON.stringify({ kind: 'files', ids: siblings.map((item) => item.id), parentFolderId: file.folderId, database: file.database }) }), '已调整 SQL 顺序')
  }
  async function deleteSelected() {
    if (!removing) return
    await action(async () => {
      await backendFetch(`${base}/${removing.kind === 'folder' ? 'folders' : 'files'}/${removing.id}`, { method: 'DELETE', body: JSON.stringify({ confirmed: true, version: removing.version }) })
      const ids = removing.kind === 'file' ? [removing.id] : files.filter((file) => {
        let folder = file.folderId
        while (folder) { if (folder === removing.id) return true; folder = folders.find((entry) => entry.id === folder)?.parentFolderId ?? null }
        return false
      }).map((file) => file.id)
      onDeleted(ids); setRemoving(null)
    }, 'SQL 资料已删除')
  }
  function fileRow(file: SavedSqlFile, depth = 0) { return <div className={styles.fileRow} key={file.id} style={{ paddingLeft: 12 + depth * 14 }}>
    <button type="button" className={styles.fileOpen} disabled={busy || actionBusy} onClick={() => void action(async () => { onOpen(await backendFetch<SavedSqlDocument>(`${base}/files/${file.id}/open`, { method: 'POST' })) })}><FileCode size={15} /><span>{file.name}<small>{file.database}{file.schema && file.schema !== file.database ? ` / ${file.schema}` : ''} · {file.sqlBytes.toLocaleString()} 字节</small></span></button>
    <div className={styles.rowActions}><button type="button" aria-label={`复制 SQL 文件 ${file.name}`} disabled={actionBusy} onClick={() => void action(async () => { const document = await backendFetch<SavedSqlDocument>(`${base}/files/${file.id}`); await navigator.clipboard.writeText(document.sql) }, '已复制完整 SQL')}><Copy size={13} /></button>
      <button type="button" aria-label={`重命名或移动 SQL ${file.name}`} disabled={actionBusy} onClick={() => beginEdit({ kind: 'file', file })}><PencilSimple size={13} /></button>
      <button type="button" aria-label={`上移 SQL ${file.name}`} disabled={actionBusy} onClick={() => void reorder(file, -1)}><ArrowUp size={12} /></button><button type="button" aria-label={`下移 SQL ${file.name}`} disabled={actionBusy} onClick={() => void reorder(file, 1)}><ArrowDown size={12} /></button>
      <button type="button" aria-label={`删除 SQL ${file.name}`} disabled={actionBusy} onClick={() => setRemoving({ kind: 'file', id: file.id, name: file.name, version: file.version })}><Trash size={13} /></button></div></div> }
  function tree(parentId: string | null, depth = 0): ReactNode {
    return <>{folders.filter((folder) => folder.parentFolderId === parentId).map((folder) => <div key={folder.id}><div className={styles.folderRow} style={{ paddingLeft: 12 + depth * 14 }}>
      <button type="button" aria-expanded={expanded.has(folder.id)} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(folder.id)) next.delete(folder.id); else next.add(folder.id); return next })}>{expanded.has(folder.id) ? <CaretDown size={13} /> : <CaretRight size={13} />}<Folder size={15} /><span>{folder.name}</span></button>
      <button type="button" aria-label={`在 ${folder.name} 下新建 SQL 文件夹`} disabled={actionBusy} onClick={() => beginEdit({ kind: 'folder', folder: null, parent: folder.id })}><FolderPlus size={13} /></button>
      <button type="button" aria-label={`重命名或移动文件夹 ${folder.name}`} disabled={actionBusy} onClick={() => beginEdit({ kind: 'folder', folder, parent: folder.parentFolderId })}><PencilSimple size={13} /></button>
      <button type="button" aria-label={`删除 SQL 文件夹 ${folder.name}`} disabled={actionBusy} onClick={() => setRemoving({ kind: 'folder', id: folder.id, name: folder.name })}><Trash size={13} /></button></div>
      {expanded.has(folder.id) && tree(folder.id, depth + 1)}</div>)}{files.filter((file) => file.folderId === parentId).map((file) => fileRow(file, depth))}</>
  }
  return <aside className={styles.panel} aria-label="已保存 SQL 库"><header><div><strong>SQL 库</strong><small>当前连接 · {files.length} 个文件</small></div>
    <button type="button" aria-label="新建 SQL 文件夹" disabled={busy || actionBusy} onClick={() => beginEdit({ kind: 'folder', folder: null, parent: null })}><FolderPlus size={17} /></button><button type="button" aria-label="刷新 SQL 库" disabled={busy || actionBusy} onClick={onRefresh}><ArrowsClockwise size={16} /></button><button type="button" aria-label="关闭 SQL 库" onClick={onClose}><X size={17} /></button></header>
    <div className={styles.filters}><input aria-label="搜索已保存 SQL" placeholder="搜索文件名、数据库、Schema…" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="SQL 库排序" value={sort} onChange={(event) => setSort(event.target.value)}><option value="folder">文件夹顺序</option><option value="recent">最近打开</option><option value="frequent">常用 SQL</option></select></div>
    {(error || actionError) && <p role="alert" className={styles.error}>{error || actionError}<button type="button" onClick={onRefresh}>刷新重试</button></p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}{busy && <p role="status" className={styles.notice}>正在读取 SQL 库…</p>}
    <div className={styles.list}>{search || sort !== 'folder' ? files.filter(matches).sort((a, b) => sort === 'frequent' ? savedSqlScore(b) - savedSqlScore(a) : (b.openedAt ?? 0) - (a.openedAt ?? 0) || b.updatedAt - a.updatedAt).map((file) => fileRow(file)) : tree(null)}
      {!busy && !files.length && !folders.length && !error && <p className={styles.empty}>还没有保存 SQL。编辑查询后点击工具栏的“保存 SQL”。</p>}{search && !files.some(matches) && <p className={styles.empty}>没有匹配的 SQL 文件。</p>}</div>
    <footer><span>打开文件恢复编辑内容；点击运行后才会执行。</span></footer>
    {edit && <SqlDialog title={edit.kind === 'folder' ? edit.folder ? '管理 SQL 文件夹' : '新建 SQL 文件夹' : '管理 SQL 文件'} busy={actionBusy} onClose={() => setEdit(null)}><form onSubmit={(event) => { event.preventDefault(); void saveMetadata() }}>
      <div className={common.formBody}><label>名称<input aria-label="SQL 项目名称" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} autoFocus /></label><label className={common.checkbox}><input type="checkbox" checked={moving} onChange={(event) => setMoving(event.target.checked)} />同时调整文件夹位置</label>
        {(moving || (edit.kind === 'folder' && !edit.folder)) && <label>目标文件夹<select aria-label="SQL 目标文件夹" value={parent} onChange={(event) => setParent(event.target.value)}><option value="">根目录</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{sqlFolderPath(folders, folder.id)}</option>)}</select></label>}{actionError && <p role="alert" className={styles.error}>{actionError}</p>}</div>
      <footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={actionBusy} onClick={() => setEdit(null)}>取消</button><span /><button type="submit" className={common.primary} disabled={actionBusy}>{actionBusy ? '保存中…' : '保存 SQL 项目'}</button></footer></form></SqlDialog>}
    {removing && <SqlDialog title="删除 SQL 资料" busy={actionBusy} onClose={() => setRemoving(null)}><div className={common.formBody}><p>删除 {removing.name}？{removing.kind === 'folder' && '文件夹中的所有子文件夹和 SQL 文档也会删除。'}</p><small>不会执行 SQL 或修改数据源。</small>{actionError && <p role="alert" className={styles.error}>{actionError}</p>}</div><footer className={common.dialogFooter}><button type="button" className={common.secondary} disabled={actionBusy} onClick={() => setRemoving(null)}>取消</button><span /><button type="button" className={common.primary} disabled={actionBusy} onClick={() => void deleteSelected()}>确认删除 SQL 资料</button></footer></SqlDialog>}
  </aside>
}
