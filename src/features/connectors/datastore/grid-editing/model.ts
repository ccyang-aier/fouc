import type { DatabaseCell, DatabaseTablePage, RelationalProvider, RelationalRowChange } from '@fouc/shared'

export type GridEditDraft = { id: string; row: number | null; change: RelationalRowChange }
export type GridEditSelection = { rows: readonly number[]; columns: readonly number[]; rectangular: boolean }
export type GridEditCell = { rowIndex: number; columnIndex: number }
export type GridEditValue = { mode: 'value'; text: string } | { mode: 'null' } | { mode: 'restore' }
export type GridCellEdit = GridEditCell & { input: GridEditValue }
export const GRID_EDIT_LIMITS = { rows: 50, cells: 100, changes: 100, characters: 1_000_000, history: 100 } as const
export function editableGridScope(selection: GridEditSelection | null | undefined, activeCell?: GridEditCell | null): GridEditSelection | null {
  return selection?.rows.length && selection.columns.length ? selection : activeCell ? { rows: [activeCell.rowIndex], columns: [activeCell.columnIndex], rectangular: true } : null
}
export function gridEditScopeSignature(scope: GridEditSelection | null): string { return scope ? JSON.stringify([scope.rows, scope.columns, scope.rectangular]) : '' }
export type GridEditSourceSnapshot = { page: DatabaseTablePage; provider: RelationalProvider; revision: number; signature: string }
export function gridEditSourceCurrent(operation: GridEditSourceSnapshot, current: GridEditSourceSnapshot & { writable: boolean; disabled: boolean; alive: boolean }): boolean { return current.alive && current.writable && !current.disabled && operation.page === current.page && operation.provider === current.provider && operation.revision === current.revision && operation.signature === current.signature }
export function gridDraftCellValue(page: DatabaseTablePage, drafts: readonly GridEditDraft[], cell: GridEditCell): DatabaseCell {
  const draft = drafts.find((entry) => entry.row === cell.rowIndex), name = page.columns[cell.columnIndex]?.name
  return draft?.change.kind === 'update' && name && Object.hasOwn(draft.change.values, name) ? draft.change.values[name] : page.rows[cell.rowIndex]?.[cell.columnIndex] ?? null
}
