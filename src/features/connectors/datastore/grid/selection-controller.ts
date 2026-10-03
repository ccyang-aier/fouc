import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared'
import { allCellsSelectionRange, isCellInSelection, normalizeSelectionRange, rowSelectionRange, type CellPosition, type CellSelectionRange } from './selection'
import { resolveDataGridSelectionFrames, type DataGridSelectionFrames } from './selection-frames'
import { captureDataGridSelection, restoreDataGridSelection, type PersistedDataGridSelection } from './selection-persistence'

export type GridDimensions = { rows: number; columns: number }
export type GridSelectionTarget = { kind: 'cell' | 'row' | 'column'; rowIndex: number; colIndex: number }
export type GridSelectionModifiers = { shift?: boolean; additive?: boolean }
export type ResultGridSelectionScope = { rows: readonly number[]; columns: readonly number[]; rectangular: boolean }
export type ResultGridSelection = {
  mode: 'none' | 'range' | 'rows' | 'columns' | 'cells'
  anchor: CellPosition | null
  focus: CellPosition | null
  range: CellSelectionRange | null
  rows: ReadonlySet<number>
  columns: ReadonlySet<number>
  baseRanges: readonly CellSelectionRange[]
  cells: ReadonlySet<string>
  excluded: ReadonlySet<string>
}
export function emptyGridSelection(): ResultGridSelection { return { mode: 'none', anchor: null, focus: null, range: null, rows: new Set(), columns: new Set(), baseRanges: [], cells: new Set(), excluded: new Set() } }
export function gridCellKey(row: number, column: number): string { return `${row}:${column}` }
function clampPoint(point: CellPosition, dimensions: GridDimensions): CellPosition { return { rowIndex: Math.max(0, Math.min(dimensions.rows - 1, point.rowIndex)), colIndex: Math.max(0, Math.min(dimensions.columns - 1, point.colIndex)) } }
function runs(values: ReadonlySet<number>, build: (first: number, last: number) => CellSelectionRange): CellSelectionRange[] {
  const sorted = [...values].sort((a, b) => a - b), result: CellSelectionRange[] = []
  let first = -1, last = -1
  for (const value of sorted) { if (value === last + 1) { if (first < 0) first = value; last = value } else { if (first >= 0) result.push(build(first, last)); first = last = value } }
  if (first >= 0) result.push(build(first, last))
  return result
}
export function gridSelectionFrames(selection: ResultGridSelection, dimensions: GridDimensions): DataGridSelectionFrames {
  if (selection.mode === 'rows') return { frames: runs(selection.rows, (first, last) => rowSelectionRange(first, dimensions.columns, last)!), sparse: false }
  if (selection.mode === 'cells') return selection.cells.size || selection.excluded.size ? { frames: [], sparse: true } : { frames: [...selection.baseRanges], sparse: false }
  return resolveDataGridSelectionFrames({ sparseCellCount: 0, hasColumnSelection: selection.mode === 'columns', selectedColumnIndexes: selection.columns, selectedRange: selection.range, rowCount: dimensions.rows })
}
export function gridCellSelected(selection: ResultGridSelection, row: number, column: number): boolean {
  if (selection.mode === 'rows') return selection.rows.has(row)
  if (selection.mode === 'columns') return selection.columns.has(column)
  if (selection.mode === 'range') return isCellInSelection(row, column, selection.range)
  if (selection.mode !== 'cells') return false
  const key = gridCellKey(row, column)
  return selection.cells.has(key) || !selection.excluded.has(key) && selection.baseRanges.some((range) => isCellInSelection(row, column, range))
}
function rangeSelection(anchor: CellPosition, focus: CellPosition): ResultGridSelection { return { ...emptyGridSelection(), mode: 'range', anchor, focus, range: normalizeSelectionRange(anchor, focus) } }
function inclusive(first: number, last: number): number[] { return Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => Math.min(first, last) + index) }

/** DBX modes stay mutually exclusive; additive cells keep large base rectangles lazily. */
export function selectGridTarget(selection: ResultGridSelection, target: GridSelectionTarget, modifiers: GridSelectionModifiers, dimensions: GridDimensions): ResultGridSelection {
  if (!dimensions.rows || !dimensions.columns) return emptyGridSelection()
  const point = clampPoint(target, dimensions)
  if (target.kind !== 'cell') {
    const mode = target.kind === 'row' ? 'rows' : 'columns', sameMode = selection.mode === mode
    const selected = new Set(modifiers.additive && sameMode ? mode === 'rows' ? selection.rows : selection.columns : [])
    const axis = mode === 'rows' ? 'rowIndex' : 'colIndex', anchor = modifiers.shift && sameMode && selection.anchor ? selection.anchor : point
    const values = modifiers.shift ? inclusive(anchor[axis], point[axis]) : [point[axis]]
    if (modifiers.additive && !modifiers.shift && selected.has(point[axis])) selected.delete(point[axis]); else for (const index of values) selected.add(index)
    return { ...emptyGridSelection(), mode, anchor, focus: point, [mode]: selected }
  }
  if (modifiers.shift && !modifiers.additive) return rangeSelection(selection.anchor ?? point, point)
  if (modifiers.shift && modifiers.additive) return dragGridSelection(selection, target, point, modifiers, dimensions)
  if (!modifiers.additive) return rangeSelection(point, point)
  const previous = selection.mode === 'cells' ? selection : { ...emptyGridSelection(), mode: 'cells' as const, baseRanges: gridSelectionFrames(selection, dimensions).frames }
  const cells = new Set(previous.cells), excluded = new Set(previous.excluded), key = gridCellKey(point.rowIndex, point.colIndex)
  const inBase = previous.baseRanges.some((range) => isCellInSelection(point.rowIndex, point.colIndex, range))
  if (inBase) { if (excluded.has(key)) excluded.delete(key); else excluded.add(key) }
  else { if (cells.has(key)) cells.delete(key); else cells.add(key) }
  return { ...previous, mode: 'cells', anchor: point, focus: point, cells, excluded }
}

export function dragGridSelection(base: ResultGridSelection, start: GridSelectionTarget, end: CellPosition, modifiers: GridSelectionModifiers, dimensions: GridDimensions): ResultGridSelection {
  if (!dimensions.rows || !dimensions.columns) return emptyGridSelection()
  const sameMode = start.kind === 'cell' || base.mode === (start.kind === 'row' ? 'rows' : 'columns')
  const focus = clampPoint(end, dimensions), anchor = modifiers.shift && sameMode && base.anchor ? base.anchor : clampPoint(start, dimensions)
  if (start.kind === 'cell') {
    if (!modifiers.additive) return rangeSelection(anchor, focus)
    const range = normalizeSelectionRange(anchor, focus), previous = base.mode === 'cells' ? base : { ...emptyGridSelection(), baseRanges: gridSelectionFrames(base, dimensions).frames }
    return { ...previous, mode: 'cells', anchor, focus, baseRanges: [...previous.baseRanges, range], excluded: new Set([...previous.excluded].filter((key) => { const [row, column] = key.split(':').map(Number); return !isCellInSelection(row, column, range) })) }
  }
  const mode = start.kind === 'row' ? 'rows' : 'columns', axis = mode === 'rows' ? 'rowIndex' : 'colIndex'
  const selected = new Set(modifiers.additive && base.mode === mode ? mode === 'rows' ? base.rows : base.columns : [])
  for (const index of inclusive(anchor[axis], focus[axis])) selected.add(index)
  return { ...emptyGridSelection(), mode, anchor, focus, [mode]: selected }
}

export function selectAllGridCells(dimensions: GridDimensions): ResultGridSelection {
  const range = allCellsSelectionRange(dimensions.rows, dimensions.columns)
  return range ? rangeSelection({ rowIndex: 0, colIndex: 0 }, { rowIndex: dimensions.rows - 1, colIndex: dimensions.columns - 1 }) : emptyGridSelection()
}
export function moveGridSelection(selection: ResultGridSelection, key: string, modifiers: GridSelectionModifiers & { control?: boolean; pageRows?: number }, dimensions: GridDimensions): ResultGridSelection {
  if (!dimensions.rows || !dimensions.columns) return emptyGridSelection()
  const focus = selection.focus ?? { rowIndex: 0, colIndex: 0 }
  let row = focus.rowIndex, column = focus.colIndex
  if (!selection.focus && key.startsWith('Arrow')) return rangeSelection(focus, focus)
  if (key === 'ArrowUp') row = modifiers.control ? 0 : row - 1
  else if (key === 'ArrowDown') row = modifiers.control ? dimensions.rows - 1 : row + 1
  else if (key === 'ArrowLeft') column = modifiers.control ? 0 : column - 1
  else if (key === 'ArrowRight') column = modifiers.control ? dimensions.columns - 1 : column + 1
  else if (key === 'Home') { column = 0; if (modifiers.control) row = 0 }
  else if (key === 'End') { column = dimensions.columns - 1; if (modifiers.control) row = dimensions.rows - 1 }
  else if (key === 'PageUp') row -= modifiers.pageRows ?? 15
  else if (key === 'PageDown') row += modifiers.pageRows ?? 15
  return selectGridTarget(selection, { kind: 'cell', rowIndex: row, colIndex: column }, { shift: modifiers.shift }, dimensions)
}

export function* selectedGridCells(selection: ResultGridSelection, result: Pick<DatabaseQueryResult, 'columns' | 'rows'>, visibleColumns: readonly number[] = result.columns.map((_, index) => index)): Generator<{ rowIndex: number; colIndex: number; visibleColIndex: number; value: DatabaseCell }> {
  if (selection.mode === 'none') return
  for (let row = 0; row < result.rows.length; row++) for (let column = 0; column < visibleColumns.length; column++) if (gridCellSelected(selection, row, column)) yield { rowIndex: row, colIndex: visibleColumns[column], visibleColIndex: column, value: result.rows[row][visibleColumns[column]] ?? null }
}
/** Export may use the row/column product only when it exactly matches the real selected cells. */
export function gridSelectionScope(selection: ResultGridSelection, result: Pick<DatabaseQueryResult, 'columns' | 'rows'>, visibleColumns?: readonly number[]): ResultGridSelectionScope | null {
  const rows = new Set<number>(), columns = new Set<number>(); let cellCount = 0
  for (const cell of selectedGridCells(selection, result, visibleColumns)) { rows.add(cell.rowIndex); columns.add(cell.colIndex); cellCount++ }
  return cellCount ? { rows: [...rows], columns: [...columns], rectangular: rows.size * columns.size === cellCount } : null
}
export function gridSelectionCounts(selection: ResultGridSelection, dimensions: GridDimensions): { cells: number; rows: number } {
  if (selection.mode === 'none') return { cells: 0, rows: 0 }
  if (selection.mode === 'range' && selection.range) return { cells: (selection.range.endRow - selection.range.startRow + 1) * (selection.range.endCol - selection.range.startCol + 1), rows: selection.range.endRow - selection.range.startRow + 1 }
  if (selection.mode === 'rows') return { cells: selection.rows.size * dimensions.columns, rows: selection.rows.size }
  if (selection.mode === 'columns') return { cells: selection.columns.size * dimensions.rows, rows: selection.columns.size ? dimensions.rows : 0 }
  let cells = 0, rows = 0
  for (let row = 0; row < dimensions.rows; row++) { let found = false; for (let column = 0; column < dimensions.columns; column++) if (gridCellSelected(selection, row, column)) { cells++; found = true } if (found) rows++ }
  return { cells, rows }
}

export function captureResultGridSelection(selection: ResultGridSelection, result: DatabaseQueryResult, primaryKeys: readonly string[] = [], visibleColumnIndexes: readonly number[] = result.columns.map((_, index) => index)): PersistedDataGridSelection | null {
  const cells = selection.mode === 'cells' ? new Set([...selectedGridCells(selection, result, visibleColumnIndexes)].map((cell) => gridCellKey(cell.rowIndex, cell.visibleColIndex))) : new Set<string>()
  return captureDataGridSelection({ columns: result.columns, rows: result.rows, primaryKeys, visibleColumnIndexes, displayItems: result.rows.map((_, index) => ({ id: index, sourceIndex: index })),
    selectedRowIds: selection.rows, selectedColumnIndexes: selection.columns, selectedCellKeys: cells, selectionAnchor: selection.mode === 'range' ? selection.anchor : null, selectionFocus: selection.mode === 'range' ? selection.focus : null,
    selectingAll: selection.mode === 'range' && selection.range?.startRow === 0 && selection.range.startCol === 0 && selection.range.endRow === result.rows.length - 1 && selection.range.endCol === visibleColumnIndexes.length - 1, lastClickedRowIndex: selection.anchor?.rowIndex })
}
export function restoreResultGridSelection(snapshot: PersistedDataGridSelection | null, result: DatabaseQueryResult, visibleColumnIndexes: readonly number[] = result.columns.map((_, index) => index)): ResultGridSelection {
  if (!snapshot) return emptyGridSelection()
  const restored = restoreDataGridSelection({ snapshot, columns: result.columns, rows: result.rows, visibleColumnIndexes, displayItems: result.rows.map((_, index) => ({ id: index, sourceIndex: index })) })
  if (!restored) return emptyGridSelection()
  if (restored.kind === 'range') return rangeSelection(restored.anchor, restored.focus)
  if (restored.kind === 'rows') { const point = { rowIndex: restored.anchorRowIndex ?? restored.rowIds[0], colIndex: 0 }; return { ...emptyGridSelection(), mode: 'rows', rows: new Set(restored.rowIds), anchor: point, focus: point } }
  if (restored.kind === 'columns') { const point = { rowIndex: 0, colIndex: restored.columnIndexes[0] }; return { ...emptyGridSelection(), mode: 'columns', columns: new Set(restored.columnIndexes), anchor: point, focus: point } }
  const [rowIndex, colIndex] = [...restored.cellKeys][0].split(':').map(Number)
  return { ...emptyGridSelection(), mode: 'cells', cells: restored.cellKeys, anchor: { rowIndex, colIndex }, focus: { rowIndex, colIndex } }
}
