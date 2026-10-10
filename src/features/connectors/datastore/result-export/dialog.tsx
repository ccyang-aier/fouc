'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, Copy, DownloadSimple, FileCode, SpinnerGap, Table } from '@phosphor-icons/react'
import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared'
import { SqlDialog } from '../sql-library-dialog'
import common from '../relational.module.css'
import styles from './export.module.css'
import { copyResultExport, downloadResultExport, exportQueryResult, previewQueryResult } from './export'
import { DEFAULT_RESULT_EXPORT_OPTIONS, RESULT_EXPORT_FORMATS, resultExportFilename, type ResultExportOptions, type ResultExportPreview, type ResultExportProgress, type ResultExportTarget } from './model'

export interface ResultExportDialogProps {
  result: DatabaseQueryResult
  provider: RelationalProvider
  title?: string
  target?: ResultExportTarget
  selectedRows?: readonly number[]
  selectedColumns?: readonly number[]
  initialFormat?: import('./model').ResultExportFormat
  onClose: () => void
}

const providerNames: Record<RelationalProvider, string> = { postgres: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite' }
const count = (value: number) => value.toLocaleString()
function bytes(value: number) {
  return value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`
}
function errorText(error: unknown) { return error instanceof Error ? error.message : String(error) }

export function ResultExportDialog({ result, provider, title = '查询结果', target, selectedRows, selectedColumns, initialFormat, onClose }: ResultExportDialogProps) {
  const [options, setOptions] = useState<ResultExportOptions>(() => ({ ...DEFAULT_RESULT_EXPORT_OPTIONS, ...(initialFormat ? { format: initialFormat } : {}), target: target ?? { table: '' } }))
  const [filename, setFilename] = useState(title)
  const [rowScope, setRowScope] = useState<'all' | 'selected'>(selectedRows?.length ? 'selected' : 'all')
  const [columns, setColumns] = useState<number[]>(() => selectedColumns ? [...new Set(selectedColumns)] : result.columns.map((_, index) => index))
  const [preview, setPreview] = useState<ResultExportPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(true)
  const [action, setAction] = useState<'copy' | 'download' | null>(null)
  const [progress, setProgress] = useState<ResultExportProgress | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const previewController = useRef<AbortController | null>(null)
  const actionController = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const selected = useMemo(() => ({ selectedRows: rowScope === 'selected' ? selectedRows ?? [] : undefined, selectedColumns: columns }), [rowScope, selectedRows, columns])
  const totalRows = rowScope === 'selected' ? new Set(selectedRows).size : result.rows.length
  const format = RESULT_EXPORT_FORMATS.find((entry) => entry.value === options.format)!
  const dsv = options.format === 'csv' || options.format === 'tsv'
  const plainTable = dsv || options.format === 'markdown'
  const busy = action !== null

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; previewController.current?.abort(); actionController.current?.abort() }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    previewController.current?.abort()
    previewController.current = controller
    const timer = setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError('')
      void previewQueryResult(result, provider, options, { ...selected, signal: controller.signal }).then((next) => {
        if (!controller.signal.aborted) setPreview(next)
      }).catch((error) => {
        if (!controller.signal.aborted) { setPreview(null); setPreviewError(errorText(error)) }
      }).finally(() => { if (!controller.signal.aborted) setPreviewLoading(false) })
    }, 80)
    return () => { clearTimeout(timer); controller.abort() }
  }, [result, provider, options, selected])

  function update<K extends keyof ResultExportOptions>(key: K, value: ResultExportOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }))
    setFeedback(null)
    setPreviewLoading(true)
  }

  function close() {
    previewController.current?.abort()
    actionController.current?.abort()
    onClose()
  }

  function cancelGeneration() {
    actionController.current?.abort()
    setAction(null)
    setFeedback({ kind: 'success', text: '已取消生成。' })
  }

  async function run(nextAction: 'copy' | 'download') {
    const controller = new AbortController()
    actionController.current?.abort()
    actionController.current = controller
    setAction(nextAction)
    setProgress({ completedRows: 0, totalRows, byteLength: 0 })
    setFeedback(null)
    try {
      const artifact = await exportQueryResult(result, provider, options, { ...selected, signal: controller.signal,
        onProgress: (value) => { if (mounted.current && !controller.signal.aborted) setProgress(value) } })
      controller.signal.throwIfAborted()
      if (nextAction === 'copy') await copyResultExport(artifact)
      else downloadResultExport(artifact, resultExportFilename(filename, artifact.extension))
      if (mounted.current && !controller.signal.aborted) setFeedback({ kind: 'success', text: nextAction === 'copy' ? `已复制 ${count(artifact.rowCount)} 行完整结果。` : `已下载 ${count(artifact.rowCount)} 行 · ${bytes(artifact.byteLength)}。` })
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setFeedback({ kind: 'error', text: errorText(error) })
    } finally {
      if (mounted.current && actionController.current === controller) setAction(null)
    }
  }

  function toggleColumn(index: number) {
    setColumns((current) => current.includes(index) ? current.filter((entry) => entry !== index) : [...current, index].sort((a, b) => a - b))
    setPreviewLoading(true)
    setFeedback(null)
  }

  return <SqlDialog title="导出查询结果" className={styles.dialog} onClose={close}>
    <div className={styles.scopeNote}><Table size={16} /><span>仅导出当前已加载结果</span><strong>{count(result.rows.length)} 行 · {count(result.columns.length)} 列</strong>
      {(result.hasMore || result.truncated) && <small>还有未加载数据，本次不会包含</small>}</div>
    <div className={styles.body}>
      <aside className={styles.settings} aria-label="导出配置">
        <fieldset disabled={busy}>
          <legend>文件格式</legend>
          <div className={styles.formats}>{RESULT_EXPORT_FORMATS.map((entry) => <button type="button" key={entry.value} aria-pressed={options.format === entry.value} onClick={() => update('format', entry.value)}>
            <strong>{entry.label}</strong><small>{entry.detail}</small></button>)}</div>
          <label className={styles.field}>文件名称<div className={styles.filename}><input aria-label="导出文件名称" value={filename} maxLength={160} onChange={(event) => setFilename(event.target.value)} /><span>.{format.extension}</span></div></label>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>数据范围</legend>
          <label className={styles.field}>导出行<select aria-label="导出行范围" value={rowScope} onChange={(event) => { setRowScope(event.target.value as 'all' | 'selected'); setPreviewLoading(true); setFeedback(null) }}>
            <option value="all">全部已加载行（{count(result.rows.length)}）</option><option value="selected" disabled={!selectedRows?.length}>仅选中行（{count(new Set(selectedRows).size)}）</option></select></label>
          <div className={styles.columnHead}><span>导出列 <small>{columns.length}/{result.columns.length}</small></span><button type="button" onClick={() => { setColumns(result.columns.map((_, index) => index)); setPreviewLoading(true) }}>全选</button><button type="button" onClick={() => { setColumns([]); setPreviewLoading(true) }}>清空</button></div>
          <div className={styles.columns} role="group" aria-label="导出列">{result.columns.map((name, index) => <label key={index}><input type="checkbox" checked={columns.includes(index)} onChange={() => toggleColumn(index)} /><span title={name}>{name || `第 ${index + 1} 列`}</span><small>{index + 1}</small></label>)}</div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>格式设置</legend>
          {dsv && <><label className={styles.checkbox}><input type="checkbox" checked={options.includeHeader} onChange={(event) => update('includeHeader', event.target.checked)} />包含列名行</label>
            <label className={styles.field}>引号策略<select aria-label="导出引号策略" value={options.quoteMode} onChange={(event) => update('quoteMode', event.target.value as 'all' | 'necessary')}><option value="all">所有非 NULL 值加引号</option><option value="necessary">仅在需要转义时加引号</option></select></label></>}
          {plainTable && <><label className={styles.field}>NULL 显示<select aria-label="NULL 导出策略" value={options.nullMode} onChange={(event) => update('nullMode', event.target.value as 'empty' | 'literal' | 'custom')}><option value="empty">空字段</option><option value="literal">NULL 标记</option><option value="custom">自定义标记</option></select></label>
            {options.nullMode === 'custom' && <input className={styles.standaloneInput} aria-label="自定义 NULL 标记" value={options.nullText} maxLength={64} onChange={(event) => update('nullText', event.target.value)} placeholder="例如 \N" />}
            <label className={styles.field}>二进制显示<select aria-label="二进制导出表示" value={options.binaryFormat} onChange={(event) => update('binaryFormat', event.target.value as 'hex' | 'base64')}><option value="hex">十六进制（0x…）</option><option value="base64">Base64（base64:…）</option></select></label></>}
          {options.format === 'json' && <><label className={styles.field}>JSON 结构<select aria-label="JSON 导出结构" value={options.jsonShape} onChange={(event) => update('jsonShape', event.target.value as 'matrix' | 'records')}><option value="matrix">列名 + 行矩阵</option><option value="records">对象数组</option></select></label><p className={styles.help}>矩阵保留重复列名。数值按原始精度写入；二进制保留 Base64 原始数据。</p></>}
          {options.format === 'sql' && <><div className={styles.nativeLabel}><FileCode size={15} />{providerNames[provider]} INSERT</div>
            <label className={styles.field}>{provider === 'mysql' ? '目标数据库（可选）' : '目标 Schema（可选）'}<input aria-label="SQL 导出目标 Schema" value={options.target?.schema ?? ''} onChange={(event) => update('target', { ...options.target!, schema: event.target.value })} placeholder={provider === 'postgres' ? 'public' : '保持当前数据库'} /></label>
            <label className={styles.field}>目标表名<input aria-label="SQL 导出目标表名" value={options.target?.table ?? ''} onChange={(event) => update('target', { ...options.target!, table: event.target.value })} placeholder="请输入真实表名" /></label>
            <label className={styles.field}>INSERT 方式<select aria-label="SQL INSERT 方式" value={options.sqlInsertMode} onChange={(event) => update('sqlInsertMode', event.target.value as 'batch' | 'single')}><option value="batch">批量 VALUES</option><option value="single">每行一条 INSERT</option></select></label>
            {options.sqlInsertMode === 'batch' && <label className={styles.field}>每批行数<input type="number" aria-label="SQL 每批行数" min={1} max={1000} value={options.sqlBatchSize} onChange={(event) => update('sqlBatchSize', Number(event.target.value))} /></label>}
            <p className={styles.help}>按原始列名生成语句。别名、计算列及生成列请先调整选列；导出只生成文件。</p></>}
          <label className={styles.field}>行结束符<select aria-label="导出换行符" value={options.newline} onChange={(event) => update('newline', event.target.value as 'lf' | 'crlf')}><option value="lf">LF（\n）</option><option value="crlf">CRLF（\r\n）</option></select></label>
          <label className={styles.checkbox}><input type="checkbox" checked={options.bom} onChange={(event) => update('bom', event.target.checked)} />UTF-8 BOM<small>便于 Excel 识别中文</small></label>
        </fieldset>
      </aside>
      <section className={styles.preview} aria-label="导出预览面板">
        <header><div><FileCode size={16} /><strong>实时预览</strong><span>{format.label}</span></div><small>{count(totalRows)} 行 · {columns.length} 列</small></header>
        <div className={styles.previewContent} aria-busy={previewLoading}>
          {previewError ? <div className={styles.previewEmpty} role="alert"><FileCode size={25} /><strong>调整配置后即可预览</strong><p>{previewError}</p></div>
            : preview ? <pre tabIndex={0} aria-label="导出预览">{preview.text || '当前范围没有数据行。'}</pre>
              : <div className={styles.previewEmpty}><SpinnerGap size={24} className={styles.spin} /><p>正在生成预览…</p></div>}
          {previewLoading && preview && <div className={styles.previewUpdating}><SpinnerGap size={13} className={styles.spin} />更新预览</div>}
        </div>
        <footer><span>UTF-8 · {options.newline === 'crlf' ? 'CRLF' : 'LF'}{options.bom ? ' · 文件含 BOM' : ''}</span><small>{preview?.truncated ? `预览前 ${preview.rowCount} 行，最多 64 KiB` : preview ? `预览 ${preview.rowCount} 行` : '预览最多 25 行'}</small></footer>
        <p className={styles.previewHint}>下载与复制生成完整选定范围；预览不会改变原始结果。</p>
      </section>
    </div>
    {feedback && <div className={feedback.kind === 'error' ? styles.error : styles.success} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.kind === 'success' && <CheckCircle size={15} />}{feedback.text}</div>}
    {busy && <div className={styles.progress} role="status" aria-live="polite"><SpinnerGap size={14} className={styles.spin} /><span>{action === 'copy' ? '准备复制' : '生成文件'} · {count(progress?.completedRows ?? 0)}/{count(totalRows)} 行 · {bytes(progress?.byteLength ?? 0)}</span><button type="button" onClick={cancelGeneration}>取消生成</button></div>}
    <footer className={`${common.dialogFooter} ${styles.footer}`}><button type="button" className={common.secondary} onClick={close}>取消</button><span />
      <button type="button" className={common.secondary} disabled={busy || previewLoading || !!previewError || !columns.length} onClick={() => void run('copy')}><Copy size={15} />复制内容</button>
      <button type="button" className={common.primary} disabled={busy || previewLoading || !!previewError || !columns.length || !filename.trim()} onClick={() => void run('download')}><DownloadSimple size={15} />{action === 'download' ? '生成中…' : `下载 .${format.extension}`}</button></footer>
  </SqlDialog>
}
