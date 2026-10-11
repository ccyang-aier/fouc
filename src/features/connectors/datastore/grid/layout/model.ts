/** DBX column order/visibility, with one current Fouc layout schema and explicit resource scopes. */
import type { DatabaseQueryResult } from '@fouc/shared'
import { validateColumnFormatter, type ColumnFormatter } from './formatter'

export type GridDensity = 'compact' | 'standard' | 'comfortable'
export type GridPin = 'left' | 'right'
export type GridLayout = { order: string[]; hidden: string[]; pins: Record<string, GridPin>; widths: Record<string, number>; formatters: Record<string, ColumnFormatter>; density: GridDensity; font: 'mono' | 'sans'; fontSize: number; widthMode: 'content' | 'fill'; searchMode: 'filter' | 'highlight'; rowNumberMode: 'view' | 'source'; transposeMode: 'current' | 'multiple'; numericAlign: 'left' | 'right'; booleanMode: 'text' | 'checkbox'; typeColors: boolean; hideNullColumns: boolean; copyMode: 'smart' | 'tsv' | 'csv' | 'json'; copyHeaders: boolean }
export type GridLayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const GRID_LAYOUT_PREFIX = 'fouc:grid-layout:'
export const GRID_COLUMN_MIN_WIDTH = 60, GRID_COLUMN_MAX_WIDTH = 1200
export function defaultGridLayout(): GridLayout { return { order: [], hidden: [], pins: {}, widths: {}, formatters: {}, density: 'standard', font: 'sans', fontSize: 14, widthMode: 'content', searchMode: 'filter', rowNumberMode: 'view', transposeMode: 'current', numericAlign: 'right', booleanMode: 'text', typeColors: false, hideNullColumns: false, copyMode: 'smart', copyHeaders: false } }

/** Preserve case and repeated names; aliases are distinct columns, never accidentally merged. */
export function gridColumnKeys(columns: readonly string[]): string[] {
  const counts = new Map<string, number>()
  return columns.map((name, index) => { const base = name || `#${index + 1}`, count = counts.get(base) ?? 0; counts.set(base, count + 1); return `${base}\u0000${count}` })
}
export function orderedGridColumns(keys: readonly string[], order: readonly string[]): number[] {
  const indexes = new Map(keys.map((key, index) => [key, index])), used = new Set<number>(), result: number[] = []
  for (const key of order) { const index = indexes.get(key); if (index !== undefined && !used.has(index)) { result.push(index); used.add(index) } }
  for (let index = 0; index < keys.length; index++) if (!used.has(index)) result.push(index)
  return result
}
export function orderedGridFields(keys: readonly string[], layout: GridLayout): number[] {
  const ordered = orderedGridColumns(keys, layout.order)
  return [...ordered.filter(index => layout.pins[keys[index]] === 'left'), ...ordered.filter(index => !layout.pins[keys[index]]), ...ordered.filter(index => layout.pins[keys[index]] === 'right')]
}
export function visibleGridColumns(keys: readonly string[], layout: GridLayout): number[] {
  const hidden = new Set(layout.hidden), ordered = orderedGridColumns(keys, layout.order)
  let visible = ordered.filter((index) => !hidden.has(keys[index]))
  if (!visible.length && ordered.length) visible = [ordered[0]]
  return [...visible.filter((index) => layout.pins[keys[index]] === 'left'), ...visible.filter((index) => !layout.pins[keys[index]]), ...visible.filter((index) => layout.pins[keys[index]] === 'right')]
}
export function setGridColumnVisible(layout: GridLayout, keys: readonly string[], key: string, visible: boolean): GridLayout {
  const hidden = new Set(layout.hidden)
  if (visible) hidden.delete(key)
  else { if (keys.filter((entry) => !hidden.has(entry)).length <= 1) return layout; hidden.add(key) }
  return { ...layout, hidden: [...hidden] }
}
/** Move visible columns while hidden columns keep their anchored position in the full order. */
export function moveGridColumn(layout: GridLayout, keys: readonly string[], fromVisible: number, toVisible: number): GridLayout {
  const visible = visibleGridColumns(keys, layout), source = visible[fromVisible]
  if (source === undefined || !Number.isInteger(toVisible)) return layout
  const remaining = visible.filter((index) => index !== source), destination = Math.max(0, Math.min(toVisible, remaining.length))
  if (fromVisible === destination) return layout
  const ordered = orderedGridColumns(keys, layout.order).filter((index) => index !== source)
  const target = remaining[destination]
  const insertAt = target === undefined ? (remaining.length ? ordered.indexOf(remaining[remaining.length - 1]) + 1 : ordered.length) : ordered.indexOf(target)
  ordered.splice(insertAt, 0, source)
  // Crossing the frozen boundary adopts the destination group, so the drag has a real visible effect.
  const pins = { ...layout.pins }, destinationPin = target === undefined ? remaining.length ? layout.pins[keys[remaining[remaining.length - 1]]] : undefined : layout.pins[keys[target]]
  if (destinationPin) pins[keys[source]] = destinationPin; else delete pins[keys[source]]
  return { ...layout, order: ordered.map((index) => keys[index]), pins }
}
export function allNullGridColumns(result: Pick<DatabaseQueryResult, 'columns' | 'rows'>): number[] {
  if (!result.rows.length) return []
  let candidates = result.columns.map((_, index) => index)
  for (const row of result.rows) { candidates = candidates.filter((index) => row[index] === null); if (!candidates.length) break }
  return candidates
}
export function hideGridColumns(layout: GridLayout, keys: readonly string[], indexes: readonly number[]): GridLayout {
  const hidden = new Set(layout.hidden)
  for (const index of indexes) hidden.add(keys[index])
  if (keys.length && keys.every((key) => hidden.has(key))) hidden.delete(keys[orderedGridColumns(keys, layout.order)[0]])
  return { ...layout, hidden: [...hidden] }
}
export function gridRowHeight(density: GridDensity): number { return density === 'compact' ? 24 : density === 'comfortable' ? 40 : 28 }
/** Field-list moves include hidden columns; the list and the stored order stay in sync. */
export function reorderGridFields(layout: GridLayout, keys: readonly string[], source: number, target: number): GridLayout {
  const order = orderedGridFields(keys, layout)
  if (source < 0 || source >= order.length || target < 0 || target >= order.length || source === target) return layout
  const column = order[source], destinationPin = layout.pins[keys[order[target]]], pins = { ...layout.pins }
  order.splice(source, 1); order.splice(target, 0, column)
  if (destinationPin) pins[keys[column]] = destinationPin; else delete pins[keys[column]]
  return { ...layout, order: order.map(index => keys[index]), pins }
}
export function displayedGridColumns(result: Pick<DatabaseQueryResult, 'columns' | 'rows'>, keys: readonly string[], layout: GridLayout): number[] {
  return visibleGridColumns(keys, layout.hideNullColumns ? hideGridColumns(layout, keys, allNullGridColumns(result)) : layout)
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
/** Read only the current schema. No legacy or cross-scope fallback. Storage failures leave a usable local layout. */
export function loadGridLayout(storage: GridLayoutStorage | undefined, scope: string | undefined): GridLayout {
  const layout = defaultGridLayout()
  if (!storage || !scope) return layout
  try {
    const source: unknown = JSON.parse(storage.getItem(GRID_LAYOUT_PREFIX + scope) ?? 'null')
    if (!record(source) || source.version !== 1 || !record(source.layout)) return layout
    const raw = source.layout
    if (Array.isArray(raw.order)) layout.order = [...new Set(raw.order.filter((item): item is string => typeof item === 'string'))].slice(0, 4096)
    if (Array.isArray(raw.hidden)) layout.hidden = [...new Set(raw.hidden.filter((item): item is string => typeof item === 'string'))].slice(0, 4096)
    if (record(raw.pins)) for (const [key, value] of Object.entries(raw.pins)) if (value === 'left' || value === 'right') Object.defineProperty(layout.pins, key, { value, enumerable: true, configurable: true, writable: true })
    if (record(raw.widths)) for (const [key, value] of Object.entries(raw.widths)) if (typeof value === 'number' && Number.isFinite(value)) Object.defineProperty(layout.widths, key, { value: Math.round(Math.max(GRID_COLUMN_MIN_WIDTH, Math.min(GRID_COLUMN_MAX_WIDTH, value))), enumerable: true, configurable: true, writable: true })
    if (record(raw.formatters)) for (const [key, value] of Object.entries(raw.formatters)) if (!validateColumnFormatter(value)) Object.defineProperty(layout.formatters, key, { value: value as ColumnFormatter, enumerable: true, configurable: true, writable: true })
    if (raw.density === 'compact' || raw.density === 'standard' || raw.density === 'comfortable') layout.density = raw.density
    if (raw.font === 'sans' || raw.font === 'mono') layout.font = raw.font
    if (typeof raw.fontSize === 'number' && Number.isInteger(raw.fontSize) && raw.fontSize >= 12 && raw.fontSize <= 16) layout.fontSize = raw.fontSize
    if (raw.widthMode === 'content' || raw.widthMode === 'fill') layout.widthMode = raw.widthMode
    if (raw.searchMode === 'filter' || raw.searchMode === 'highlight') layout.searchMode = raw.searchMode
    if (raw.rowNumberMode === 'view' || raw.rowNumberMode === 'source') layout.rowNumberMode = raw.rowNumberMode
    if (raw.transposeMode === 'current' || raw.transposeMode === 'multiple') layout.transposeMode = raw.transposeMode
    if (raw.numericAlign === 'left' || raw.numericAlign === 'right') layout.numericAlign = raw.numericAlign
    if (raw.booleanMode === 'text' || raw.booleanMode === 'checkbox') layout.booleanMode = raw.booleanMode
    if (typeof raw.typeColors === 'boolean') layout.typeColors = raw.typeColors
    if (typeof raw.hideNullColumns === 'boolean') layout.hideNullColumns = raw.hideNullColumns
    if (typeof raw.copyHeaders === 'boolean') layout.copyHeaders = raw.copyHeaders
    if (['smart', 'tsv', 'csv', 'json'].includes(String(raw.copyMode))) layout.copyMode = raw.copyMode as GridLayout['copyMode']
    return layout
  } catch { return layout }
}
export function saveGridLayout(storage: GridLayoutStorage | undefined, scope: string | undefined, layout: GridLayout): boolean {
  if (!storage || !scope) return false
  try { storage.setItem(GRID_LAYOUT_PREFIX + scope, JSON.stringify({ version: 1, layout })); return true } catch { return false }
}
