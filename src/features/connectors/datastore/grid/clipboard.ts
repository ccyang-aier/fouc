import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared'
import { gridCellSelected, selectedGridCells, type ResultGridSelection } from './selection-controller'

/** Keep the driver value intact: binary cells retain their payload rather than a display label. */
export function rawGridCellText(value: DatabaseCell, pretty = false): string {
  return value === null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value, null, pretty ? 2 : undefined) : String(value)
}

function delimitedCell(value: DatabaseCell, separator: ',' | '\t'): string {
  if (value === null) return 'NULL'
  const text = rawGridCellText(value)
  const quote = separator === ',' && typeof value === 'string' || text === '' || text === 'NULL' || text.includes(separator) || /["\r\n]/.test(text)
  return quote ? `"${text.replace(/"/g, '""')}"` : text
}

/** Sparse selections preserve their layout; unselected intersections are blank, never copied values. */
export function formatGridSelection(result: Pick<DatabaseQueryResult, 'columns' | 'rows'>, selection: ResultGridSelection, separator: ',' | '\t', includeHeaders = false, visibleColumns: readonly number[] = result.columns.map((_, index) => index)): string {
  const rows = new Set<number>(), columns = new Set<number>()
  for (const cell of selectedGridCells(selection, result, visibleColumns)) { rows.add(cell.rowIndex); columns.add(cell.visibleColIndex) }
  if (!rows.size || !columns.size) return ''
  const rowIndexes = [...rows].sort((a, b) => a - b), columnIndexes = [...columns].sort((a, b) => a - b)
  const lines = rowIndexes.map((row) => columnIndexes.map((column) => gridCellSelected(selection, row, column) ? delimitedCell(result.rows[row][visibleColumns[column]] ?? null, separator) : '').join(separator))
  if (includeHeaders) lines.unshift(columnIndexes.map((column) => delimitedCell(result.columns[visibleColumns[column]], separator)).join(separator))
  return lines.join('\n')
}
