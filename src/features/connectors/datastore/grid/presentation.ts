import { formatJsonSource, type DatabaseCell } from '@fouc/shared'
import { sameGridEditValue } from '../grid-editing/values'
import type { ResultGridSelectionScope } from './selection-controller'

export type GridHighlightMode = 'value' | 'rows' | 'columns'
export type GridHighlight = { mode: GridHighlightMode; value: DatabaseCell; rows: readonly number[]; columns: readonly number[] }
export type GridValuePresentation = 'text' | 'json' | 'binary'

export function highlightedGridCell(mark: GridHighlight | null, row: number, column: number, value: DatabaseCell): boolean {
  if (!mark) return false
  return mark.mode === 'rows' ? mark.rows.includes(row) : mark.mode === 'columns' ? mark.columns.includes(column) : sameGridEditValue(mark.value, value)
}

/** Compare raw loaded values, never formatted strings, and require at least two selected rows. */
export function equalSelectedGridColumns(rows: readonly DatabaseCell[][], scope: ResultGridSelectionScope | null, visible: readonly number[]): number[] {
  if (!scope || scope.rows.length < 2) return []
  return visible.filter(column => scope.rows.every(row => rows[row] && sameGridEditValue(rows[scope.rows[0]][column] ?? null, rows[row][column] ?? null)))
}

export function binaryGridValue(value: DatabaseCell): boolean { return value !== null && typeof value === 'object' && !Array.isArray(value) && value.type === 'binary' }

/** Formatting source text preserves JSON numeric tokens instead of parsing them as JS numbers. */
export function jsonGridPreview(value: DatabaseCell): string | null {
  if (binaryGridValue(value)) return null
  try { return formatJsonSource(typeof value === 'string' ? value : JSON.stringify(value), 2) }
  catch { return null }
}
