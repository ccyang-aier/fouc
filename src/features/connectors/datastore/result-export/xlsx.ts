import type { DatabaseQueryResult } from '@fouc/shared'
import { rawGridCellText } from '../grid/clipboard'

/** Export raw loaded values; strings stay strings, including formulas and exact numeric text. */
export async function buildResultXlsx(result: DatabaseQueryResult, name: string, rows: readonly number[], columns: readonly number[], includeHeaders = true): Promise<Uint8Array<ArrayBuffer>> {
  if (!columns.length || columns.length > 16384 || rows.length > 100000 || rows.length * columns.length > 1000000) throw new Error('XLSX 导出最多 100000 行、1000000 个单元格')
  if (rows.some(row => !Number.isInteger(row) || row < 0 || row >= result.rows.length) || columns.some(column => !Number.isInteger(column) || column < 0 || column >= result.columns.length)) throw new Error('导出选区不属于当前数据结果')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(name.replace(/[\\/?*:[\]]/g, '_').replace(/^'+|'+$/g, '').slice(0, 31) || '数据')
  let characters = 0
  const text = (value: string) => { if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('内容含 XLSX 不支持的控制字符，请使用 JSON 导出'); if (value.length > 32767) throw new Error('单元格超过 XLSX 的 32767 字符限制，请使用 CSV 或 JSON 导出'); characters += value.length; if (characters > 20 * 1024 * 1024) throw new Error('当前内容超过 XLSX 导出大小限制，请使用 CSV 或 JSON'); return value }
  if (includeHeaders) { const header = sheet.addRow(columns.map(column => text(result.columns[column]))); header.font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }] }
  for (const [index, row] of rows.entries()) { if (index > 0 && index % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0)); sheet.addRow(columns.map(column => { const value = result.rows[row][column] ?? null; return value === null ? null : typeof value === 'number' || typeof value === 'boolean' ? value : text(typeof value === 'string' ? value : rawGridCellText(value)) })) }
  sheet.columns.forEach(column => { column.width = 22 })
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
