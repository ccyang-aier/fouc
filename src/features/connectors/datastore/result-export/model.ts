import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared'

export type ResultExportFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'sql'
export interface ResultExportTarget { schema?: string | null; table: string }
export interface ResultExportOptions {
  format: ResultExportFormat
  includeHeader?: boolean
  quoteMode?: 'all' | 'necessary'
  newline?: 'lf' | 'crlf'
  bom?: boolean
  nullMode?: 'empty' | 'literal' | 'custom'
  nullText?: string
  binaryFormat?: 'hex' | 'base64'
  jsonShape?: 'matrix' | 'records'
  sqlInsertMode?: 'batch' | 'single'
  sqlBatchSize?: number
  target?: ResultExportTarget
}
export interface ResultExportSelection {
  selectedRows?: readonly number[]
  selectedColumns?: readonly number[]
}
export interface ResultExportProgress { completedRows: number; totalRows: number; byteLength: number }
export interface ResultExportControl extends ResultExportSelection {
  signal?: AbortSignal
  onProgress?: (progress: ResultExportProgress) => void
}
export interface ResultExportArtifact {
  chunks: string[]
  mimeType: string
  extension: string
  rowCount: number
  columnCount: number
  byteLength: number
}
export interface ResultExportPreview {
  text: string
  rowCount: number
  totalRows: number
  truncated: boolean
}

export const RESULT_EXPORT_FORMATS: readonly { value: ResultExportFormat; label: string; detail: string; extension: string; mimeType: string }[] = [
  { value: 'csv', label: 'CSV', detail: '逗号分隔', extension: 'csv', mimeType: 'text/csv;charset=utf-8' },
  { value: 'tsv', label: 'TSV', detail: '制表符分隔', extension: 'tsv', mimeType: 'text/tab-separated-values;charset=utf-8' },
  { value: 'json', label: 'JSON', detail: '结构化数据', extension: 'json', mimeType: 'application/json;charset=utf-8' },
  { value: 'markdown', label: 'Markdown', detail: '文档表格', extension: 'md', mimeType: 'text/markdown;charset=utf-8' },
  { value: 'sql', label: 'SQL', detail: '原生 INSERT', extension: 'sql', mimeType: 'application/sql;charset=utf-8' },
]

export const DEFAULT_RESULT_EXPORT_OPTIONS: ResultExportOptions = {
  format: 'csv', includeHeader: true, quoteMode: 'all', newline: 'lf', bom: false,
  nullMode: 'empty', nullText: '', binaryFormat: 'hex', jsonShape: 'matrix',
  sqlInsertMode: 'batch', sqlBatchSize: 500,
}

export interface ExportPlan {
  provider: RelationalProvider
  result: DatabaseQueryResult
  options: Required<Omit<ResultExportOptions, 'target'>> & { target?: ResultExportTarget }
  columns: number[]
  rows: readonly number[] | null
  rowCount: number
  newline: string
  nullText: string
}

function indices(input: readonly number[] | undefined, length: number, label: string): number[] | null {
  if (input === undefined) return null
  const selected = new Set<number>()
  for (const index of input) {
    if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`${label}范围已变化，请重新选择。`)
    selected.add(index)
  }
  return [...selected]
}

export function createExportPlan(result: DatabaseQueryResult, provider: RelationalProvider, input: ResultExportOptions, selection: ResultExportSelection = {}): ExportPlan {
  if (!['mysql', 'postgres', 'sqlite'].includes(provider)) throw new Error('当前数据库暂不支持结果导出。')
  if (!RESULT_EXPORT_FORMATS.some((entry) => entry.value === input.format)) throw new Error('请选择支持的导出格式。')
  const options = { ...DEFAULT_RESULT_EXPORT_OPTIONS, ...input } as ExportPlan['options']
  const columns = indices(selection.selectedColumns, result.columns.length, '列') ?? result.columns.map((_, index) => index)
  const rows = indices(selection.selectedRows, result.rows.length, '行')
  if (!columns.length) throw new Error('请至少选择一列。')
  if (!['all', 'necessary'].includes(options.quoteMode) || !['lf', 'crlf'].includes(options.newline)
    || !['empty', 'literal', 'custom'].includes(options.nullMode) || !['hex', 'base64'].includes(options.binaryFormat)
    || !['matrix', 'records'].includes(options.jsonShape) || !['batch', 'single'].includes(options.sqlInsertMode)) throw new Error('导出配置无效。')
  if (!Number.isInteger(options.sqlBatchSize) || options.sqlBatchSize < 1 || options.sqlBatchSize > 1000) throw new Error('SQL 每批行数须为 1–1000。')
  const nullText = options.nullMode === 'empty' ? '' : options.nullMode === 'literal' ? 'NULL' : options.nullText
  const textFormat = ['csv', 'tsv', 'markdown'].includes(options.format)
  const nullSpecial = options.format === 'tsv' ? /[\r\n\t"]/ : /[\r\n\t,"]/
  if (textFormat && (nullText.length > 64 || nullSpecial.test(nullText))) throw new Error('NULL 标记最多 64 个字符，且不能包含分隔符、引号或换行。')
  if (options.format === 'sql') {
    if (!options.target?.table.trim()) throw new Error('请输入 INSERT 目标表名。')
    if (/\0/.test(options.target.table) || /\0/.test(options.target.schema ?? '')) throw new Error('表名或 schema 不能含空字符。')
  }
  if (options.format === 'sql' || options.format === 'json' && options.jsonShape === 'records') {
    const labels = columns.map((index) => result.columns[index])
    if (new Set(labels).size !== labels.length) throw new Error(options.format === 'sql' ? 'INSERT 不允许重复列名，请调整选列或查询别名。' : '对象 JSON 不允许重复列名；请使用矩阵 JSON 保留所有列。')
  }
  return { provider, result, options, columns, rows, rowCount: rows?.length ?? result.rows.length,
    newline: options.newline === 'crlf' ? '\r\n' : '\n', nullText }
}

export function exportRow(plan: ExportPlan, index: number) {
  return plan.result.rows[plan.rows?.[index] ?? index]
}

export function resultExportFilename(title: string, extension: string): string {
  const basename = title.replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[.\s]+$/, '').trim().slice(0, 160)
  return `${basename || '查询结果'}.${extension}`
}
