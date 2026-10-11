"use client"

import { useRef, useState } from 'react'
import type { DatabaseQueryResult } from '@fouc/shared'
import { Button } from '@/components/ui/button'
import { useAppAlert } from '@/components/app-alert-provider'
import { SqlDialog } from '../sql-library-dialog'
import common from '../relational.module.css'
import { buildResultXlsx } from './xlsx'

export function XlsxExportDialog({ result, title, selectedRows, selectedColumns, onClose }: { result: DatabaseQueryResult; title: string; selectedRows?: readonly number[]; selectedColumns?: readonly number[]; onClose: () => void }) {
  const [filename, setFilename] = useState(title), [headers, setHeaders] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const saving = useRef(false), { notify } = useAppAlert()
  const rows = selectedRows ?? result.rows.map((_, index) => index), columns = selectedColumns ?? result.columns.map((_, index) => index)
  async function download() {
    if (saving.current) return
    saving.current = true; setBusy(true); setError('')
    try { const bytes = await buildResultXlsx(result, title, rows, columns, headers), url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${filename.trim() || title}.xlsx`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_'); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('success', 'XLSX 文件已生成'); onClose() } catch (reason) { setError(reason instanceof Error ? reason.message : 'XLSX 导出失败') } finally { saving.current = false; setBusy(false) }
  }
  return <SqlDialog title="导出 XLSX" busy={busy} onClose={onClose}><form onSubmit={event => { event.preventDefault(); void download() }}><div className={common.formBody}><label>文件名称<input autoFocus aria-label="XLSX 文件名称" value={filename} onChange={event => setFilename(event.target.value)} disabled={busy} /></label><label className={common.checkbox}><input type="checkbox" checked={headers} onChange={event => setHeaders(event.target.checked)} disabled={busy} />包含列名</label><small>当前已加载数据 · {rows.length} 行 · {columns.length} 列</small>{error && <p role="alert" style={{ color: 'var(--err-ink)' }}>{error}</p>}</div><footer className={common.dialogFooter}><Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" loading={busy}>导出 XLSX</Button></footer></form></SqlDialog>
}
