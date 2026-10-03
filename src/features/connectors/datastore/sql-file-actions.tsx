"use client"
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle, CircleNotch, FileSql, WarningCircle } from '@phosphor-icons/react'
import { SQL_FILE_MAX_BYTES, type RelationalProvider } from '@fouc/shared'
import type { EditorView } from '@codemirror/view'
import { SqlEditor } from './sql-editor'
import { SqlDialog } from './sql-library-dialog'
import { downloadSqlFile, formatSqlFileSize, readBrowserSqlFile, type OpenSqlFile, type SqlFileEncoding } from './sql-files'
import common from './relational.module.css'
import styles from './sql-file-actions.module.css'

type Props = { provider: RelationalProvider; disabled: boolean; getDocument: () => { sql: string; title: string } | null; onOpen: (files: OpenSqlFile[]) => void; onNotice: (message: string) => void }
export function SqlFileActions({ provider, disabled, getDocument, onOpen, onNotice }: Props) {
  const input = useRef<HTMLInputElement>(null), reader = useRef<AbortController | null>(null), editor = useRef<EditorView | null>(null)
  const [files, setFiles] = useState<File[]>([]), [encoding, setEncoding] = useState<SqlFileEncoding>('auto')
  const [decoded, setDecoded] = useState<OpenSqlFile[]>([]), [index, setIndex] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); reader.current = controller
    if (!files.length) return () => controller.abort()
    void (async () => {
      const items: OpenSqlFile[] = []
      for (const file of files) items.push(await readBrowserSqlFile(file, encoding, controller.signal))
      if (!controller.signal.aborted) setDecoded(items)
    })().catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [files, encoding])
  function prepareRead() { reader.current?.abort(); setBusy(true); setDecoded([]); setError('') }
  function close() { reader.current?.abort(); setFiles([]); setDecoded([]); setError(''); setBusy(false) }
  const preview = decoded[index], partial = (preview?.sql.length ?? 0) > 16000
  return <>
    <input ref={input} type="file" accept=".sql" multiple hidden aria-label="打开 SQL 文件" onChange={(event) => {
      const selected = [...(event.target.files ?? [])]; event.target.value = ''
      if (!selected.length) return
      if (selected.length > 20) { onNotice('每次最多打开 20 个 SQL 文件。'); return }
      if (selected.reduce((bytes, file) => bytes + file.size, 0) > SQL_FILE_MAX_BYTES) { onNotice('本批 SQL 文件合计最多 64 MiB，请分批打开。'); return }
      prepareRead(); setIndex(0); setFiles(selected)
    }} />
    <button type="button" aria-label="导入 SQL 文件" title="打开本机 SQL 文件 · 仅加载到查询标签" disabled={disabled} onClick={() => input.current?.click()}><ArrowUp size={17} /></button>
    <button type="button" aria-label="下载 SQL 文件" title="下载当前完整文档为 UTF-8 SQL" disabled={disabled} onClick={() => {
      const document = getDocument(); if (!document) return
      try { downloadSqlFile(document.sql, document.title); onNotice('已下载完整 SQL 文档（UTF-8）。') }
      catch (reason) { onNotice(reason instanceof Error ? reason.message : String(reason)) }
    }}><ArrowDown size={17} /></button>
    {files.length > 0 && <SqlDialog title="打开 SQL 文件" className={styles.dialog} onClose={close}>
      <div className={styles.body}>
        <div className={styles.intro}><FileSql size={24} /><div><strong>在当前连接中打开脚本</strong><p>每个文件建立独立查询标签，打开后由你选择执行范围。</p></div></div>
        <div className={styles.controls}><label>文件编码<select aria-label="SQL 文件编码" value={encoding} onChange={(event) => { const next = event.target.value as SqlFileEncoding; if (next !== encoding) { prepareRead(); setEncoding(next) } }}><option value="auto">自动识别 BOM / UTF-8</option><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option><option value="gb18030">GB18030 / GBK</option></select></label><small>{files.length} 个文件 · 每个最多 64 MiB</small></div>
        <div className={styles.files} role="list" aria-label="待打开 SQL 文件">{files.map((file, position) => <button type="button" role="listitem" key={position} data-active={index === position} onClick={() => setIndex(position)}><FileSql size={15} /><span>{file.name}</span><small>{formatSqlFileSize(file.size)}</small>{decoded[position] && <CheckCircle size={14} />}</button>)}</div>
        {busy ? <p className={styles.loading} role="status"><CircleNotch size={16} className="mw-spin" />正在读取和校验原始文件…</p> : error ? <p className={styles.error} role="alert"><WarningCircle size={16} />{error}</p> : preview && <>
          <div className={styles.previewHead}><strong>原始内容预览</strong><span>{preview.encoding.toUpperCase()} · {partial ? '前 16,000 字符' : '完整文件'}</span></div>
          <div className={styles.preview}><SqlEditor key={`${index}:${encoding}`} provider={provider} value={preview.sql.slice(0, 16000)} editorRef={editor} readOnly label="SQL 文件内容预览" onRun={() => {}} onChange={() => {}} /></div>
          <small className={styles.note}>{partial ? '预览已截取；打开后仍保留完整原始文件。' : '原始 SQL 内容保留，不进行格式化或替换。'}单次执行最多 1 MiB，较大的脚本可以选择部分语句执行。</small>
        </>}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}><small>当前连接 · {provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite'}</small><button type="button" className={common.secondary} onClick={close}>取消</button><button type="button" className={common.primary} disabled={busy || Boolean(error) || decoded.length !== files.length || disabled} onClick={() => {
        try { onOpen(decoded); close() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      }}>打开 {files.length} 个查询标签</button></footer>
    </SqlDialog>}
  </>
}
