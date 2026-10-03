import type { DatabaseCell, DatabaseQueryResult, RelationalProvider } from '@fouc/shared'
import { createExportPlan, exportRow, RESULT_EXPORT_FORMATS, type ExportPlan, type ResultExportArtifact, type ResultExportControl, type ResultExportOptions, type ResultExportPreview } from './model'
import { jsonCell, jsonString, quoteExportIdentifier, sqlCell, textCell } from './values'
import { ExportWriter, PreviewComplete, textPieces } from './writer'

function* delimitedField(value: DatabaseCell, plan: ExportPlan, header = false): Generator<string> {
  if (value === null) { yield plan.nullText; return }
  const parts = () => textCell(value, plan.provider, plan.options.binaryFormat)
  const special = plan.options.format === 'tsv' ? /[\t"\r\n]/ : /[,"\r\n]/
  let quote = plan.options.quoteMode === 'all' || typeof value === 'string' && (!value.length || !header && value === plan.nullText)
  if (!quote) {
    for (const part of parts()) {
      if (special.test(part)) { quote = true; break }
      yield '' // Yield during quote lookahead for large cells as well as output.
    }
  }
  if (quote) yield '"'
  for (const part of parts()) yield quote ? part.replaceAll('"', '""') : part
  if (quote) yield '"'
}

function* delimitedRow(values: DatabaseCell[], plan: ExportPlan, header = false): Generator<string> {
  const separator = plan.options.format === 'tsv' ? '\t' : ','
  for (let index = 0; index < plan.columns.length; index++) {
    if (index) yield separator
    yield* delimitedField(values[plan.columns[index]] ?? null, plan, header)
  }
  yield plan.newline
}

function* markdownField(value: DatabaseCell, plan: ExportPlan): Generator<string> {
  if (value === null) { yield plan.nullText; return }
  for (const part of textCell(value, plan.provider, plan.options.binaryFormat)) {
    yield part.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replace(/[\\|*_`\[\]]/g, '\\$&').replace(/\r\n|\r|\n/g, '<br>')
  }
}

function markdownWidths(plan: ExportPlan): number[] {
  // Keep padding bounded by headers; wide cell content is retained in full.
  // DBX's Unicode padding used an unbounded whole-result prepass.
  return plan.columns.map((index) => Math.max(3, Math.min(48, Array.from(plan.result.columns[index].slice(0, 96)).length)))
}

function* markdownRow(values: DatabaseCell[], plan: ExportPlan, widths: number[]): Generator<string> {
  yield '| '
  for (let index = 0; index < plan.columns.length; index++) {
    if (index) yield ' | '
    let length = 0
    for (const part of markdownField(values[plan.columns[index]] ?? null, plan)) {
      yield part
      if (length < widths[index]) length += Array.from(part.slice(0, widths[index] * 2)).length
    }
    if (length < widths[index]) yield ' '.repeat(widths[index] - length)
  }
  yield ` |${plan.newline}`
}

function* jsonRow(values: DatabaseCell[], plan: ExportPlan): Generator<string> {
  const records = plan.options.jsonShape === 'records'
  yield records ? '    { ' : '    ['
  for (let index = 0; index < plan.columns.length; index++) {
    if (index) yield ', '
    const column = plan.columns[index]
    if (records) { yield* jsonString(plan.result.columns[column]); yield ': ' }
    yield* jsonCell(values[column] ?? null, plan.provider, plan.result.columnTypes[column])
  }
  yield records ? ' }' : ']'
}

function sqlPrefix(plan: ExportPlan): string {
  const target = plan.options.target!
  const name = [target.schema, target.table].filter((part): part is string => !!part).map((part) => quoteExportIdentifier(part, plan.provider)).join('.')
  const columns = plan.columns.map((index) => quoteExportIdentifier(plan.result.columns[index], plan.provider)).join(', ')
  return `INSERT INTO ${name} (${columns}) VALUES${plan.newline}`
}

function* sqlRow(values: DatabaseCell[], plan: ExportPlan): Generator<string> {
  yield '  ('
  for (let index = 0; index < plan.columns.length; index++) {
    if (index) yield ', '
    const column = plan.columns[index]
    yield* sqlCell(values[column] ?? null, plan.provider, plan.result.columnTypes[column])
  }
  yield ')'
}

async function writeExport(plan: ExportPlan, writer: ExportWriter, limitRows = plan.rowCount) {
  const write = (parts: Iterable<string>) => writer.write(parts)
  const count = Math.min(plan.rowCount, limitRows)
  if (plan.options.bom) await write(['\ufeff'])
  switch (plan.options.format) {
    case 'csv': case 'tsv':
      if (plan.options.includeHeader) await write(delimitedRow(plan.result.columns, plan, true))
      for (let row = 0; row < count; row++) {
        await write(delimitedRow(exportRow(plan, row), plan))
        writer.completedRows++
      }
      break
    case 'json': {
      const matrix = plan.options.jsonShape === 'matrix'
      if (matrix) {
        await write(['{', plan.newline, '  "columns": ['])
        for (let column = 0; column < plan.columns.length; column++) {
          if (column) await write([', '])
          await write(jsonString(plan.result.columns[plan.columns[column]]))
        }
        await write([`],${plan.newline}  "rows": [${plan.newline}`])
      } else await write(['[', plan.newline])
      for (let row = 0; row < count; row++) {
        if (row) await write([',', plan.newline])
        await write(jsonRow(exportRow(plan, row), plan))
        writer.completedRows++
      }
      await write([plan.newline, matrix ? `  ]${plan.newline}}${plan.newline}` : `]${plan.newline}`])
      break
    }
    case 'markdown': {
      const widths = markdownWidths(plan)
      // A Markdown table requires a header and separator, independent of DSV's header switch.
      await write(markdownRow(plan.result.columns, plan, widths))
      await write([`| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |${plan.newline}`])
      for (let row = 0; row < count; row++) {
        await write(markdownRow(exportRow(plan, row), plan, widths))
        writer.completedRows++
      }
      break
    }
    case 'sql': {
      const batchSize = plan.options.sqlInsertMode === 'single' ? 1 : plan.options.sqlBatchSize
      for (let row = 0; row < count; row++) {
        if (row % batchSize === 0) await write([sqlPrefix(plan)])
        await write(sqlRow(exportRow(plan, row), plan))
        await write([row % batchSize === batchSize - 1 || row === count - 1 ? ';' : ',', plan.newline])
        writer.completedRows++
      }
      break
    }
  }
}

/** Exports the loaded result only. No DBX bridge or additional database reads. */
export async function exportQueryResult(result: DatabaseQueryResult, provider: RelationalProvider, options: ResultExportOptions, control: ResultExportControl = {}): Promise<ResultExportArtifact> {
  control.signal?.throwIfAborted()
  const plan = createExportPlan(result, provider, options, control)
  const writer = new ExportWriter(plan.rowCount, control)
  await writeExport(plan, writer)
  const chunks = await writer.finish()
  const format = RESULT_EXPORT_FORMATS.find((entry) => entry.value === options.format)!
  return { chunks, mimeType: format.mimeType, extension: format.extension, rowCount: plan.rowCount, columnCount: plan.columns.length, byteLength: writer.byteLength }
}

/** The bounded preview is separate from the full download/copy artifact. */
export async function previewQueryResult(result: DatabaseQueryResult, provider: RelationalProvider, options: ResultExportOptions, control: ResultExportControl = {}): Promise<ResultExportPreview> {
  const plan = createExportPlan(result, provider, { ...options, bom: false }, control)
  const maxRows = 25
  const writer = new ExportWriter(plan.rowCount, control, 65_536)
  let cut = false
  try { await writeExport(plan, writer, maxRows) }
  catch (error) { if (!(error instanceof PreviewComplete)) throw error; cut = true }
  const chunks = await writer.finish()
  return { text: chunks.join(''), rowCount: writer.completedRows, totalRows: plan.rowCount, truncated: cut || plan.rowCount > maxRows }
}

export function* exportSqlLiteral(value: DatabaseCell, provider: RelationalProvider, type?: string) {
  yield* sqlCell(value, provider, type)
}

export function downloadResultExport(artifact: ResultExportArtifact, filename: string) {
  const url = URL.createObjectURL(new Blob(artifact.chunks, { type: artifact.mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyResultExport(artifact: ResultExportArtifact) {
  if (artifact.byteLength > 8 * 1024 * 1024) throw new Error('结果超过 8 MiB，请下载文件以保留完整数据。')
  if (!navigator.clipboard?.writeText) throw new Error('当前浏览器无法写入剪贴板，请下载文件。')
  // BOM is an encoding signature for files and should not appear in pasted text.
  await navigator.clipboard.writeText(artifact.chunks.join('').replace(/^\ufeff/, ''))
}

// Exported for tests of UTF-8 chunk boundaries without an intermediate full result.
export { textPieces }
