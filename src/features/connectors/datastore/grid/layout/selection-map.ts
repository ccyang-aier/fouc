import { emptyGridSelection, gridCellKey, type ResultGridSelection } from '../selection-controller'
import { normalizeSelectionRange, type CellPosition, type CellSelectionRange } from '../selection'

/** Reorder only the view. Split old rectangles into column runs instead of adding unselected cells. */
export function remapGridColumnSelection(selection: ResultGridSelection, previous: readonly number[], next: readonly number[]): ResultGridSelection {
  if (selection.mode === 'none' || previous.length === next.length && previous.every((column, index) => column === next[index])) return selection
  const nextIndex = new Map(next.map((column, index) => [column, index]))
  const mappedColumn = (column: number): number | undefined => nextIndex.get(previous[column])
  const point = (value: CellPosition | null): CellPosition | null => value && mappedColumn(value.colIndex) !== undefined ? { rowIndex: value.rowIndex, colIndex: mappedColumn(value.colIndex)! } : null
  if (selection.mode === 'rows') return { ...selection, anchor: point(selection.anchor) ?? (selection.anchor ? { ...selection.anchor, colIndex: 0 } : null), focus: point(selection.focus) ?? (selection.focus ? { ...selection.focus, colIndex: 0 } : null) }
  if (selection.mode === 'columns') {
    const columns = new Set([...selection.columns].map(mappedColumn).filter((column): column is number => column !== undefined))
    if (!columns.size) return emptyGridSelection()
    const fallback = { rowIndex: selection.focus?.rowIndex ?? 0, colIndex: [...columns][0] }
    return { ...selection, columns, anchor: point(selection.anchor) ?? fallback, focus: point(selection.focus) ?? fallback }
  }
  const ranges = selection.mode === 'range' && selection.range ? [selection.range] : selection.baseRanges
  const baseRanges: CellSelectionRange[] = []
  for (const range of ranges) {
    const columns = previous.slice(range.startCol, range.endCol + 1).map((column) => nextIndex.get(column)).filter((column): column is number => column !== undefined).sort((a, b) => a - b)
    let start: number | undefined, end = 0
    for (const column of columns) { if (start === undefined) start = column; else if (column !== end + 1) { baseRanges.push({ ...range, startCol: start, endCol: end }); start = column } end = column }
    if (start !== undefined) baseRanges.push({ ...range, startCol: start, endCol: end })
  }
  function mappedKeys(keys: ReadonlySet<string>): Set<string> {
    const result = new Set<string>()
    for (const key of keys) { const [row, column] = key.split(':').map(Number), mapped = mappedColumn(column); if (mapped !== undefined) result.add(gridCellKey(row, mapped)) }
    return result
  }
  const cells = mappedKeys(selection.cells), excluded = mappedKeys(selection.excluded)
  if (!baseRanges.length && !cells.size) return emptyGridSelection()
  const firstRange = baseRanges[0], firstCell = cells.size ? [...cells][0].split(':').map(Number) : undefined
  const fallback = firstRange ? { rowIndex: firstRange.startRow, colIndex: firstRange.startCol } : { rowIndex: firstCell![0], colIndex: firstCell![1] }
  const anchor = point(selection.anchor), focus = point(selection.focus)
  if (baseRanges.length === 1 && !cells.size && !excluded.size && anchor && focus) {
    const range = normalizeSelectionRange(anchor, focus)
    if (range.startRow === firstRange.startRow && range.endRow === firstRange.endRow && range.startCol === firstRange.startCol && range.endCol === firstRange.endCol) return { ...emptyGridSelection(), mode: 'range', range, anchor, focus }
  }
  return { ...emptyGridSelection(), mode: 'cells', baseRanges, cells, excluded, anchor: point(selection.anchor) ?? fallback, focus: point(selection.focus) ?? fallback }
}
