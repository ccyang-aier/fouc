'use client'

import { useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { Copy } from '@phosphor-icons/react/dist/csr/Copy'
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple'
import { Warning } from '@phosphor-icons/react/dist/csr/Warning'
import type { DatabaseAdminObjectSource } from '@fouc/shared/database-admin-objects'
import type { RelationalProvider } from '@fouc/shared'
import { SqlEditor } from '../sql-editor'
import styles from './admin-objects.module.css'

export function AdminObjectSource({ source, name, label, provider }: {
  source: DatabaseAdminObjectSource
  name: string
  label: string
  provider: RelationalProvider
}) {
  const editor = useRef<EditorView | null>(null)
  const [feedback, setFeedback] = useState('')
  const available = source.text !== null && source.complete
  async function copy() {
    if (!available) return
    try { await navigator.clipboard.writeText(source.text!); setFeedback('SQL 已复制。') }
    catch { setFeedback('无法访问剪贴板，可在编辑器中选择源码复制。') }
  }
  function download() {
    if (!available) return
    const url = URL.createObjectURL(new Blob([source.text!], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${name}.sql`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback('SQL 文件已生成。')
  }
  return <section className={styles.source} aria-label={label}>
    <div className={styles.sourceToolbar}>
      <span>{source.origin === 'native' ? '原生源码' : source.origin === 'reconstructed' ? '元数据重建声明' : '源码未知'}
        {source.bytes !== null && <small>{source.bytes.toLocaleString()} bytes{source.complete ? '' : ' · 片段'}</small>}
      </span>
      <button type="button" disabled={!available} aria-label={`复制${label}`} onClick={() => void copy()}><Copy size={13} />复制 SQL</button>
      <button type="button" disabled={!available} aria-label={`下载${label}`} onClick={download}><DownloadSimple size={13} />下载</button>
    </div>
    {source.text !== null ? <div className={styles.editor}>
      <SqlEditor value={source.text} onChange={() => {}} onRun={() => {}} editorRef={editor}
        provider={provider} readOnly label={`${label}源码`} />
    </div> : <p className={styles.empty}>原生目录未提供此源码，或当前角色没有读取权限。</p>}
    {source.warning && <p className={styles.warning}><Warning size={14} />{source.warning}</p>}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
  </section>
}
