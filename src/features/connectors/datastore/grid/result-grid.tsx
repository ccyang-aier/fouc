"use client"

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAppAlert } from '@/components/app-alert-provider'
import { SqlDialog } from '../sql-library-dialog'
import { GridContextMenu } from './context-menu'
import type { TableGridContextActions } from './context-actions'
import { downloadGridSelectionImage } from './selection-image'
import contextStyles from './context-menu.module.css'
import { ArrowsLeftRight, Check, Copy, PushPin, SidebarSimple, Table, X, Columns, Key, Hash } from '@phosphor-icons/react'
import { GridColumnActions, type GridColumnQueryActions } from './column-actions'
import type { DatabaseCell, DatabaseQueryResult, RelationalSort } from '@fouc/shared'
import { databaseCellText } from '../cell-format'
import { columnLabel } from '../result-format'
import { GridCellDetail } from './cell-detail'
import { formatGridSelection, rawGridCellText } from './clipboard'
import { summarizeExactValues, type ExactSelectionSummary } from './exact-summary'
import { beginDataGridNativeSelectionBlock, finishDataGridNativeSelectionBlock, releaseDataGridNativeSelectionBlock, type NativeSelectionBlockEnvironment } from './native-selection'
import { captureResultGridSelection, dragGridSelection, emptyGridSelection, gridCellSelected, gridSelectionCounts, gridSelectionFrames, gridSelectionScope, moveGridSelection, restoreResultGridSelection, selectAllGridCells, selectedGridCells, selectGridContextTarget, selectGridTarget, type GridSelectionModifiers, type GridSelectionTarget, type ResultGridSelection, type ResultGridSelectionScope } from './selection-controller'
import { dataGridSelectionEdgeFlags, dataGridSelectionEdgeMaskFromFlags } from './selection-frames'
import { useGridColumnInteractions } from './layout/column-interactions'
import { applyColumnFormatter } from './layout/formatter'
import { GridLayoutDialog } from './layout/layout-dialog'
import { GridFieldFilter } from './layout/field-filter'
import { GridViewOptions } from './layout/view-options'
import { GridJumpPanel } from './layout/jump-panel'
import { displayedGridColumns, gridColumnKeys, gridRowHeight, hideGridColumns, moveGridColumn } from './layout/model'
import { remapGridColumnSelection } from './layout/selection-map'
import { useGridLayout } from './layout/use-layout'
import { fitGridColumn } from './layout/width'
import { TransposedResultGrid } from './transpose/transposed-grid'
import styles from './result-grid.module.css'
import { binaryGridValue, equalSelectedGridColumns, highlightedGridCell, jsonGridPreview, type GridHighlight, type GridValuePresentation } from './presentation'

export type ResultGridCellSelection = { rowIndex: number; columnIndex: number; columnName: string; value: DatabaseCell }
export type { ResultGridSelectionScope } from './selection-controller'
export type ResultGridProps = { result: DatabaseQueryResult; displayRows?: DatabaseCell[][]; editedCells?: ReadonlySet<string>; onCellSelect?: (cell: ResultGridCellSelection | null) => void; onSelectionChange?: (scope: ResultGridSelectionScope | null) => void; onNotice?: (message: string) => void; readOnly?: boolean; rowOffset?: number; rowNumbers?: readonly number[]; scopeLabel?: string; emptyLabel?: string; scopeKey?: string; layoutScopeKey?: string; primaryKeys?: readonly string[]; uniqueKeys?: readonly string[]; showCellDetails?: boolean; sort?: readonly RelationalSort[]; sortDisabled?: boolean; columnQueryActions?: GridColumnQueryActions; toolbarActions?: ReactNode; headerTarget?: HTMLElement | null; toolsTarget?: HTMLElement | null; viewTarget?: HTMLElement | null; highlightSearch?: string; columnComments?: readonly (string | null)[]; tableActions?: TableGridContextActions }

function nativeGridType(type?: string) { return /int|numeric|decimal|real|float|double/i.test(type ?? "") ? "number" : /date|time/i.test(type ?? "") ? "date" : /char|text|string/i.test(type ?? "") ? "text" : undefined }

const HEADER_HEIGHT = 44, OVERSCAN = 8
const resultKeys = new WeakMap<DatabaseQueryResult, string>()
let nextResultKey = 0
function resultKey(result: DatabaseQueryResult): string { let key = resultKeys.get(result); if (!key) { key = `result-${++nextResultKey}`; resultKeys.set(result, key) } return key }

/** scopeKey must identify one execution/page; only a refresh of that same scope restores selection. */
export function ResultGrid(props: ResultGridProps) {
  return <ResultGridContent key={JSON.stringify([props.scopeKey ?? resultKey(props.result), props.layoutScopeKey])} {...props} />
}

function selectionTarget(element: EventTarget | null): GridSelectionTarget | null {
  const cell = (element as Element | null)?.closest?.<HTMLElement>('[data-grid-target]')
  if (!cell) return null
  const kind = cell.dataset.gridTarget
  if (kind !== 'cell' && kind !== 'row' && kind !== 'column') return null
  return { kind, rowIndex: Number(cell.dataset.gridRow), colIndex: Number(cell.dataset.gridColumn) }
}

function ResultGridContent({ result, displayRows, editedCells, onCellSelect, onSelectionChange, onNotice, readOnly = true, rowOffset = 0, rowNumbers, scopeLabel, emptyLabel = '查询成功，没有返回记录', primaryKeys = [], uniqueKeys = [], showCellDetails = true, sort = [], sortDisabled = false, columnQueryActions, toolbarActions, layoutScopeKey, headerTarget, toolsTarget, viewTarget, highlightSearch = '', columnComments, tableActions }: ResultGridProps) {
  const [jumpOpen, setJumpOpen] = useState(false), [jumpColumn, setJumpColumn] = useState<number | null>(null)
  const [layoutColumn, setLayoutColumn] = useState<number | null>(null), [transposed, setTransposed] = useState(false)
  const [contextPoint, setContextPoint] = useState<{ x: number; y: number } | null>(null), [rowDetail, setRowDetail] = useState(false)
  const [highlight, setHighlight] = useState<{ sourceKey: string; mark: GridHighlight } | null>(null)
  const [detailPresentation, setDetailPresentation] = useState<GridValuePresentation | undefined>()
  const activeHighlight = highlight?.sourceKey === resultKey(result) ? highlight.mark : null
  const { notify } = useAppAlert()
  function notice(message: string) { if (onNotice) onNotice(message); else notify('info', message) }
  const { layout, changeLayout } = useGridLayout(layoutScopeKey, notice)
  const keys = useMemo(() => gridColumnKeys(result.columns), [result.columns])
  const visible = useMemo(() => displayedGridColumns(result, keys, layout), [result, keys, layout])
  const rowHeight = gridRowHeight(layout.density)
  const [state, setState] = useState(() => ({ result, visible, selection: emptyGridSelection() }))
  let selection = state.selection
  if (state.result !== result) {
    selection = restoreResultGridSelection(captureResultGridSelection(state.selection, state.result, primaryKeys, state.visible), result, visible)
    setState({ result, visible, selection })
  } else if (state.visible !== visible) {
    selection = remapGridColumnSelection(state.selection, state.visible, visible)
    setState({ result, visible, selection })
  }
  const dimensions = useMemo(() => ({ rows: result.rows.length, columns: visible.length }), [result.rows.length, visible.length])
  const [detailOpen, setDetailOpen] = useState(false)
  const includeHeaders = layout.copyHeaders, setIncludeHeaders = (copyHeaders: boolean) => changeLayout({ ...layout, copyHeaders })
  const [viewportSize, setViewportSize] = useState({ height: 360, top: 0, width: 0 })
  const [statistics, setStatistics] = useState<{ selection: ResultGridSelection; summary: ExactSelectionSummary } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null), nativeOwner = useRef({}), dragRef = useRef<{ base: ResultGridSelection; start: GridSelectionTarget; modifiers: GridSelectionModifiers; last: string } | null>(null)
  const frameRef = useRef<number | null>(null), pointRef = useRef<{ x: number; y: number } | null>(null), id = useId()
  const rowNumberWidth = useMemo(() => { let maximum = layout.rowNumberMode === 'view' ? result.rows.length : rowOffset + result.rows.length; if (layout.rowNumberMode === 'source') for (const number of rowNumbers ?? []) maximum = Math.max(maximum, number); return Math.max(48, String(maximum).length * 7 + 18) }, [rowOffset, result.rows.length, rowNumbers, layout.rowNumberMode])
  const widths = useMemo(() => { const widths = visible.map(column => layout.widths[keys[column]] ?? fitGridColumn(result, column, { density: layout.density, fontSize: layout.fontSize, formatter: layout.formatters[keys[column]] })); const extra = layout.widthMode === 'fill' && widths.length ? Math.max(0, (viewportSize.width - rowNumberWidth - widths.reduce((sum, width) => sum + width, 0)) / widths.length) : 0; return widths.map(width => width + extra) }, [visible, result, keys, layout.widths, layout.density, layout.fontSize, layout.formatters, layout.widthMode, viewportSize.width, rowNumberWidth])
  const columnPointer = useGridColumnInteractions({ viewport: viewportRef, keys, visible, widths, layout, onChange: changeLayout })
  const renderedWidths = useMemo(() => widths.map((width, index) => columnPointer.preview?.kind === 'resize' && columnPointer.preview.column === visible[index] ? columnPointer.preview.width : width), [widths, visible, columnPointer.preview])
  const columnPositions = useMemo(() => {
    let left = rowNumberWidth, right = 0
    const positions: CSSProperties[] = visible.map(() => ({}))
    visible.forEach((column, index) => { if (layout.pins[keys[column]] === 'left') { positions[index] = { position: 'sticky', left }; left += renderedWidths[index] } })
    for (let index = visible.length - 1; index >= 0; index--) if (layout.pins[keys[visible[index]]] === 'right') { positions[index] = { position: 'sticky', right }; right += renderedWidths[index] }
    return positions
  }, [visible, keys, layout.pins, rowNumberWidth, renderedWidths])
  const counts = useMemo(() => gridSelectionCounts(selection, dimensions), [selection, dimensions])
  const frames = useMemo(() => gridSelectionFrames(selection, dimensions), [selection, dimensions])
  const firstRow = Math.max(0, Math.floor((viewportSize.top - HEADER_HEIGHT) / rowHeight) - OVERSCAN)
  const endRow = Math.min(result.rows.length, firstRow + Math.ceil(viewportSize.height / rowHeight) + OVERSCAN * 2 + 2)
  const displayValues = useMemo(() => (displayRows ?? result.rows).slice(firstRow, endRow).map((row) => visible.map((column) => applyColumnFormatter(row[column] ?? null, layout.formatters[keys[column]]))), [displayRows, result.rows, firstRow, endRow, visible, layout.formatters, keys])
  const focus = selection.focus, focusSelected = focus !== null && gridCellSelected(selection, focus.rowIndex, focus.colIndex)
  const cell = focusSelected && focus ? { rowIndex: focus.rowIndex, columnIndex: visible[focus.colIndex], columnName: columnLabel(result.columns, visible[focus.colIndex]), value: result.rows[focus.rowIndex]?.[visible[focus.colIndex]] ?? null } : null
  const contextScope = gridSelectionScope(selection, result, visible)
  const equalColumns = contextPoint ? equalSelectedGridColumns(displayRows ?? result.rows, contextScope, visible) : []
  const notifyCell = useEffectEvent(() => onCellSelect?.(cell))
  const notifySelection = useEffectEvent((scope: ResultGridSelectionScope | null) => onSelectionChange?.(scope))
  const selectionNotificationEnabled = onSelectionChange !== undefined
  useEffect(() => { if (!transposed) notifyCell() }, [result, visible, focus?.rowIndex, focus?.colIndex, focusSelected, transposed])
  useEffect(() => {

  if (transposed) return
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportSize({ height: element.clientHeight, top: element.scrollTop, width: element.clientWidth }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [transposed])
  useEffect(() => {
    // Editing captures the current selection immediately; only statistics are deferred.
    if (transposed) return
    if (selectionNotificationEnabled) notifySelection(gridSelectionScope(selection, result, visible))
    const timer = setTimeout(() => {
      function* values() { for (const selected of selectedGridCells(selection, result, visible)) yield selected.value }
      setStatistics({ selection, summary: summarizeExactValues(values()) })
    }, 90)
    return () => clearTimeout(timer)
  }, [selection, result, visible, selectionNotificationEnabled, transposed])
  useEffect(() => {
    if (!focus) return
    const element = viewportRef.current
    if (!element) return
    const top = focus.rowIndex * rowHeight
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + rowHeight + HEADER_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = top + rowHeight + HEADER_HEIGHT - element.clientHeight
    const timer = requestAnimationFrame(() => element.querySelector<HTMLElement>(`[data-grid-target="cell"][data-grid-row="${focus.rowIndex}"][data-grid-column="${focus.colIndex}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
    return () => cancelAnimationFrame(timer)
  }, [focus, rowHeight])
  useEffect(() => {
    const owner = nativeOwner.current
    return () => { releaseDataGridNativeSelectionBlock(owner); if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [])

  function changeSelection(next: ResultGridSelection) {
    setJumpColumn(null)
    setState({ result, visible, selection: next })
  }
  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); notice(`已复制${label}`) }
    catch { notice('复制失败，请检查浏览器剪贴板权限') }
  }
  function copySelection(separator: ',' | '\t') {
    if (!counts.cells) return
    void copyText(formatGridSelection(result, selection, separator, includeHeaders, visible), `${counts.cells.toLocaleString()} 个单元格 · ${separator === ',' ? 'CSV' : 'TSV'}`)
  }
  function contextAt(target: GridSelectionTarget, point: { x: number; y: number }) {
    const next = selectGridContextTarget(selection, target, dimensions)
    changeSelection(next)
    onSelectionChange?.(gridSelectionScope(next, result, visible))
    const column = visible[target.colIndex]
    onCellSelect?.({ rowIndex: target.rowIndex, columnIndex: column, columnName: columnLabel(result.columns, column), value: result.rows[target.rowIndex]?.[column] ?? null })
    setContextPoint(point)
  }
  function contextCopy(format: 'raw' | 'tsv' | 'csv' | 'json') {
    if (!cell) return
    if (format === 'raw') void copyText(rawGridCellText(cell.value), '单元格原始值')
    else if (format === 'json') void copyText(JSON.stringify([...selectedGridCells(selection, result, visible)].map(value => ({ row: rowNumbers?.[value.rowIndex] ?? rowOffset + value.rowIndex + 1, column: value.colIndex, name: result.columns[value.colIndex], value: value.value })), null, 2), '选区原始值 · JSON')
    else copySelection(format === 'tsv' ? '\t' : ',')
  }
  function nativeEnvironment(): NativeSelectionBlockEnvironment {
    return { document: { documentElement: viewportRef.current ?? undefined, activeElement: document.activeElement }, getSelection: () => window.getSelection(), setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay), clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer) }
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    finishDataGridNativeSelectionBlock(nativeOwner.current, nativeEnvironment())
    if (frameRef.current !== null) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !dimensions.rows || !dimensions.columns) return
    if ((event.target as Element).closest('button, input, textarea, [contenteditable="true"]')) return
    const target = selectionTarget(event.target)
    if (!target) return
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true })
    const modifiers = { shift: event.shiftKey, additive: event.ctrlKey || event.metaKey }
    dragRef.current = { base: selection, start: target, modifiers, last: `${target.rowIndex}:${target.colIndex}` }
    changeSelection(selectGridTarget(selection, target, modifiers, dimensions))
    beginDataGridNativeSelectionBlock(nativeOwner.current, nativeEnvironment())
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    pointRef.current = { x: event.clientX, y: event.clientY }
    if (frameRef.current !== null) return
    const move = () => {
      frameRef.current = null
      const drag = dragRef.current, point = pointRef.current, viewport = viewportRef.current
      if (!drag || !point || !viewport) return
      const bounds = viewport.getBoundingClientRect(), x = Math.max(bounds.left + 2, Math.min(bounds.right - 2, point.x)), y = Math.max(bounds.top + HEADER_HEIGHT + 2, Math.min(bounds.bottom - 2, point.y))
      const target = selectionTarget(document.elementFromPoint(x, y))
      if (target) {
        const key = `${target.rowIndex}:${target.colIndex}`
        if (key !== drag.last) { drag.last = key; changeSelection(dragGridSelection(drag.base, drag.start, target, drag.modifiers, dimensions)) }
      }
      const vertical = point.y < bounds.top + HEADER_HEIGHT + 18 ? -rowHeight : point.y > bounds.bottom - 18 ? rowHeight : 0
      const horizontal = point.x < bounds.left + 18 ? -24 : point.x > bounds.right - 18 ? 24 : 0
      if (vertical || horizontal) { viewport.scrollBy(horizontal, vertical); frameRef.current = requestAnimationFrame(move) }
    }
    frameRef.current = requestAnimationFrame(move)
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest('input, textarea, button, [contenteditable="true"]')) return
    const control = event.ctrlKey || event.metaKey, key = event.key
    if ((key === 'ContextMenu' || event.shiftKey && key === 'F10') && focus) {
      event.preventDefault(); const element = viewportRef.current?.querySelector<HTMLElement>(`[data-grid-target="cell"][data-grid-row="${focus.rowIndex}"][data-grid-column="${focus.colIndex}"]`), rect = element?.getBoundingClientRect()
      if (rect) contextAt({ kind: 'cell', ...focus }, { x: rect.left + Math.min(40, rect.width / 2), y: rect.bottom })
      return
    }
    if (control && key.toLowerCase() === 'r' && tableActions) { event.preventDefault(); if (!tableActions.queryDisabled) tableActions.onRefresh(); return }
    if (control && key.toLowerCase() === 'a') { event.preventDefault(); changeSelection(selectAllGridCells(dimensions)); return }
    if (control && key.toLowerCase() === 'c' && counts.cells) { event.preventDefault(); if (layout.copyMode === 'json') contextCopy('json'); else if (layout.copyMode === 'smart' && counts.cells === 1 && !includeHeaders) { const value = selectedGridCells(selection, result, visible).next().value; if (value) void copyText(rawGridCellText(value.value), '单元格原始值') } else copySelection(layout.copyMode === 'csv' ? ',' : '\t'); return }
    if (key === 'Escape') { event.preventDefault(); if (detailOpen) setDetailOpen(false); else changeSelection(emptyGridSelection()); return }
    if (key === 'Enter' && cell && showCellDetails) { event.preventDefault(); setDetailOpen(true); return }
    if (key === ' ' && (control || event.shiftKey)) { event.preventDefault(); changeSelection(selectGridTarget(selection, { kind: control ? 'column' : 'row', rowIndex: focus?.rowIndex ?? 0, colIndex: focus?.colIndex ?? 0 }, {}, dimensions)); return }
    if (/^Arrow(Up|Down|Left|Right)$/.test(key) || ['Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
      event.preventDefault(); changeSelection(moveGridSelection(selection, key, { shift: event.shiftKey, control, pageRows: Math.max(1, Math.floor((viewportSize.height - HEADER_HEIGHT) / rowHeight)) }, dimensions))
    }
  }
  function cellEdge(row: number, column: number): number {
    if ((counts.cells < 2 && selection.mode !== 'columns') || !gridCellSelected(selection, row, column)) return 0
    if (!frames.sparse) {
      const edges = dataGridSelectionEdgeFlags(frames.frames, row, column)
      // Whole columns start their outer frame at the header, not the first data row.
      if (edges && selection.mode === 'columns') edges.top = false
      return edges ? dataGridSelectionEdgeMaskFromFlags(edges) : 0
    }
    return (!gridCellSelected(selection, row - 1, column) ? 1 : 0) | (!gridCellSelected(selection, row, column + 1) ? 2 : 0) | (!gridCellSelected(selection, row + 1, column) ? 4 : 0) | (!gridCellSelected(selection, row, column - 1) ? 8 : 0)
  }
  const summary = statistics?.selection === selection ? statistics.summary : null
  const gridTools = <div className={styles.toolbarActions}>
      <label className={styles.headersToggle}><input type="checkbox" checked={includeHeaders} onChange={(event) => setIncludeHeaders(event.target.checked)} />列名</label>
      <button type="button" disabled={!counts.cells} onClick={() => copySelection('\t')} title="复制选区为 TSV · Ctrl / ⌘ C"><Copy size={13} />TSV</button><button type="button" disabled={!counts.cells} onClick={() => copySelection(',')} title="复制选区为 CSV">CSV</button>
      {showCellDetails && <button type="button" disabled={!cell} aria-pressed={detailOpen && !!cell} onClick={() => setDetailOpen(!detailOpen)} title="单元格详情 · Enter"><SidebarSimple size={14} /><span>详情</span></button>}
      {counts.cells > 0 && <button type="button" aria-label="清除网格选择" title="清除选择 · Escape" onClick={() => changeSelection(emptyGridSelection())}><X size={13} /></button>}
      <button type="button" disabled={!result.rows.length || !visible.length} aria-label="转置结果视图" title="字段按行、记录按列显示；原始值保持不变" onClick={() => setTransposed(true)}><ArrowsLeftRight size={14} /><span>转置</span></button>
      {!headerTarget && <GridViewOptions result={result} layout={layout} onChange={changeLayout} />}{toolbarActions}
    </div>
  if (transposed) return <>{headerTarget && createPortal(<GridFieldFilter result={result} keys={keys} layout={layout} onChange={changeLayout} />, headerTarget)}{(viewTarget ?? headerTarget) && createPortal(<GridViewOptions result={result} layout={layout} onChange={changeLayout} />, (viewTarget ?? headerTarget)!)}<TransposedResultGrid result={result} displayRows={displayRows} editedCells={editedCells} visible={visible} keys={keys} layout={layout} rowHeight={rowHeight} initialRow={cell?.rowIndex ?? 0} rowOffset={rowOffset} rowNumbers={rowNumbers} scopeLabel={scopeLabel} onCellSelect={onCellSelect} onSelectionChange={onSelectionChange} onNotice={onNotice} showCellDetails={showCellDetails} readOnly={readOnly} toolbarActions={toolbarActions} onExit={() => setTransposed(false)} /></>
  return <div className={styles.gridRoot} data-selection-multiple={counts.cells > 1 || selection.mode === 'columns' || undefined} onContextMenu={event => {
    const target = selectionTarget(event.target)
    if (!target || !dimensions.rows || !dimensions.columns) return
    event.preventDefault(); viewportRef.current?.focus({ preventScroll: true }); contextAt(target, { x: event.clientX, y: event.clientY })
  }} style={{ '--grid-row-height': `${rowHeight}px`, '--grid-font-size': `${layout.fontSize}px`, '--grid-value-font': layout.font === 'mono' ? 'var(--font-code)' : 'var(--font-sans)', '--grid-row-number-width': `${rowNumberWidth}px`, '--grid-number-align': layout.numericAlign } as CSSProperties}>
    {headerTarget ? createPortal(<><GridFieldFilter result={result} keys={keys} layout={layout} onChange={changeLayout} /><button type="button" className="fouc-action" title="跳转列" data-workbench-panel-trigger aria-expanded={jumpOpen} disabled={!visible.length} onClick={() => setJumpOpen(value => !value)}><Columns size={16} />跳转列</button>{!viewTarget && <GridViewOptions result={result} layout={layout} onChange={changeLayout} />}</>, headerTarget) : null}
    {viewTarget && createPortal(<GridViewOptions result={result} layout={layout} onChange={changeLayout} />, viewTarget)}
    <div className={styles.toolbar} data-external={!!toolsTarget}><div className={styles.selectionLabel}><Table size={14} /><strong>{counts.cells ? `${counts.cells.toLocaleString()} 个单元格` : '数据结果'}</strong><span>{counts.cells ? `${counts.rows.toLocaleString()} 行` : '点击选择 · Shift 连选 · Ctrl 多选'}</span></div>{toolsTarget ? createPortal(gridTools, toolsTarget) : gridTools}</div>
    <div className={`${styles.content} ${detailOpen && cell ? styles.withDetail : ''}`}>
      <div className={styles.viewport} ref={viewportRef} role="grid" tabIndex={0} aria-label="查询结果，使用方向键移动，Shift 扩展选区" aria-rowcount={result.rows.length + 1} aria-colcount={visible.length + 1} aria-readonly={readOnly} aria-multiselectable data-column-dragging={columnPointer.preview?.kind === 'move' || undefined} aria-activedescendant={focusSelected && focus && focus.rowIndex >= firstRow && focus.rowIndex < endRow ? `${id}-${focus.rowIndex}-${focus.colIndex}` : undefined} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onScroll={(event) => setViewportSize({ height: event.currentTarget.clientHeight, top: event.currentTarget.scrollTop, width: event.currentTarget.clientWidth })} onDoubleClick={(event) => { if (showCellDetails && !(event.target as Element).closest('button') && selectionTarget(event.target)?.kind === 'cell') setDetailOpen(true) }}>
        <table className={styles.table} style={{ width: rowNumberWidth + renderedWidths.reduce((sum, width) => sum + width, 0) }} role="presentation"><colgroup><col style={{ width: rowNumberWidth }} />{visible.map((column, index) => <col key={keys[column]} style={{ width: renderedWidths[index] }} />)}</colgroup><thead role="rowgroup"><tr role="row" aria-rowindex={1}><th className={styles.corner} role="columnheader"><button type="button" disabled={!dimensions.rows || !dimensions.columns} title="选择本次已返回的全部可见单元格" aria-label="选择本次已返回的全部可见单元格" onClick={() => { changeSelection(selectAllGridCells(dimensions)); viewportRef.current?.focus() }}>#</button></th>{visible.map((column, index) => {
          const name = result.columns[column], columnKey = keys[column], preview = columnPointer.preview
          const sortIndex = sort.findIndex((entry) => entry.column === name), direction = sort[sortIndex]?.direction
          const shownDirection = columnQueryActions?.localSort?.column === column ? columnQueryActions.localSort.direction : direction
          const dropping = preview?.kind === 'move' && preview.target !== visible.indexOf(preview.column)
          const selected = selection.mode === 'columns' && selection.columns.has(index)
          const edge = selected ? 1 | (selection.columns.has(index + 1) ? 0 : 2) | (selection.columns.has(index - 1) ? 0 : 8) : 0
          return <th key={columnKey} style={columnPositions[index]} role="columnheader" tabIndex={0} title="长按拖动列 · Alt + ← / →" aria-colindex={index + 2} aria-selected={selected} data-selected={selected || undefined} data-edge={edge} aria-sort={shownDirection === 'asc' ? 'ascending' : shownDirection === 'desc' ? 'descending' : undefined} data-highlight={activeHighlight?.mode === "columns" && activeHighlight.columns.includes(column) || undefined} data-grid-target="column" data-grid-row={focus?.rowIndex ?? 0} data-grid-column={index} data-pinned={layout.pins[columnKey]} data-jump-current={jumpColumn === column || undefined} data-drop-edge={dropping && preview.slot === index ? 'before' : dropping && preview.slot === visible.length && index === visible.length - 1 ? 'after' : undefined} data-moving={preview?.kind === 'move' && preview.column === column || undefined}
            onPointerDown={event => columnPointer.start(event, 'move', index)} onPointerMove={columnPointer.move} onPointerUp={event => columnPointer.finish(event)} onPointerCancel={event => columnPointer.finish(event, true)} onLostPointerCapture={event => columnPointer.finish(event, true)}
            onClick={event => {
              if (!event.currentTarget.contains(event.target as Node) || (event.target as Element).closest('button, [data-grid-column-actions]') || columnPointer.click(event)) return
              viewportRef.current?.focus({ preventScroll: true })
              changeSelection(selectGridTarget(selection, { kind: 'column', rowIndex: focus?.rowIndex ?? 0, colIndex: index }, { shift: event.shiftKey, additive: event.ctrlKey || event.metaKey }, dimensions))
            }}
            onKeyDown={event => {
              if (event.target !== event.currentTarget) return
              if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                event.preventDefault(); event.stopPropagation()
                changeLayout(moveGridColumn(layout, keys, index, index + (event.key === 'ArrowLeft' ? -1 : 1)))
              } else if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault(); event.stopPropagation()
                changeSelection(selectGridTarget(selection, { kind: 'column', rowIndex: focus?.rowIndex ?? 0, colIndex: index }, { shift: event.shiftKey, additive: event.ctrlKey || event.metaKey }, dimensions))
              }
            }}>
            <div className={styles.headerContent}>
              <div className={styles.headerText}>
                <span title={columnLabel(result.columns, column)}>{primaryKeys.includes(name) ? <Key size={13} className={styles.primaryKey} /> : uniqueKeys.includes(name) ? <Hash size={13} className={styles.uniqueKey} /> : null}<span>{columnLabel(result.columns, column)}</span></span>
                <small data-type={nativeGridType(result.columnTypes[column])} title={result.columnTypes[column] || '—'}>{layout.pins[columnKey] && <PushPin size={9} />}<span>{result.columnTypes[column] || '—'}</span>{layout.formatters[columnKey] && <i title="此列设置了显示格式">ƒ</i>}</small>
              </div>
              <GridColumnActions name={name} column={column} direction={direction} priority={sort.length > 1 && sortIndex >= 0 ? sortIndex + 1 : undefined} sortable={!!tableActions && result.columnSortables[column] !== false} disabled={sortDisabled} formatted={!!layout.formatters[columnKey]} actions={tableActions} queryActions={columnQueryActions} onFormat={() => setLayoutColumn(column)} onClearFormat={() => { const formatters = { ...layout.formatters }; delete formatters[columnKey]; changeLayout({ ...layout, formatters }) }} />
            </div>
            <button type="button" className={`fouc-resize-handle ${styles.resizeHandle}`} data-resize-axis="x" data-resizing={preview?.kind === 'resize' && preview.column === column || undefined} aria-label={`调整 ${name} 列宽`} title="拖动调整列宽 · 双击自动适宽 · ← / →" onPointerDown={(event) => columnPointer.start(event, 'resize', index)} onPointerMove={columnPointer.move} onPointerUp={(event) => columnPointer.finish(event)} onPointerCancel={(event) => columnPointer.finish(event, true)} onLostPointerCapture={(event) => columnPointer.finish(event, true)} onDoubleClick={(event) => { event.stopPropagation(); changeLayout({ ...layout, widths: { ...layout.widths, [columnKey]: fitGridColumn(result, column, { density: layout.density, fontSize: layout.fontSize, formatter: layout.formatters[columnKey], autoFit: true }) } }) }} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeLayout({ ...layout, widths: { ...layout.widths, [columnKey]: Math.min(1200, Math.max(60, widths[index] + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 10))) } }) } }} />
          </th>
        })}</tr></thead>
          <tbody role="rowgroup">{firstRow > 0 && <tr aria-hidden="true" className={styles.spacer}><td colSpan={visible.length + 1} style={{ height: firstRow * rowHeight }} /></tr>}
            {result.rows.slice(firstRow, endRow).map((row, localIndex) => { const rowIndex = firstRow + localIndex; return <tr key={rowIndex} role="row" aria-rowindex={rowIndex + 2}><th role="rowheader" aria-selected={selection.mode === 'rows' && selection.rows.has(rowIndex)} data-grid-target="row" data-grid-row={rowIndex} data-grid-column={focus?.colIndex ?? 0} data-highlight={activeHighlight?.mode === "rows" && activeHighlight.rows.includes(rowIndex) || undefined} className={styles.rowNumber}>{layout.rowNumberMode === 'view' ? rowIndex + 1 : rowNumbers?.[rowIndex] ?? rowOffset + rowIndex + 1}</th>{visible.map((columnIndex, visibleIndex) => {
              const value = displayRows ? displayRows[rowIndex]?.[columnIndex] ?? null : row[columnIndex] ?? null, columnKey = keys[columnIndex], selected = gridCellSelected(selection, rowIndex, visibleIndex), active = focusSelected && focus?.rowIndex === rowIndex && focus.colIndex === visibleIndex, formatted = displayValues[localIndex][visibleIndex]
              return <td key={columnKey} style={columnPositions[visibleIndex]} id={`${id}-${rowIndex}-${visibleIndex}`} role="gridcell" aria-colindex={visibleIndex + 2} aria-selected={selected} data-grid-target="cell" data-grid-row={rowIndex} data-grid-column={visibleIndex} data-pinned={layout.pins[columnKey]} data-highlight={highlightedGridCell(activeHighlight, rowIndex, columnIndex, value) || undefined} data-selected={selected || undefined} data-active={active || undefined} data-edge={cellEdge(rowIndex, visibleIndex)} data-format-error={!!formatted.error || undefined} data-dirty={editedCells?.has(`${rowIndex}:${columnIndex}`) || undefined} data-search-match={!!highlightSearch && databaseCellText(value).toLocaleLowerCase().includes(highlightSearch.toLocaleLowerCase()) || undefined} data-value-type={layout.typeColors ? nativeGridType(result.columnTypes[columnIndex]) : undefined} className={value === null ? styles.nullCell : (typeof value === 'number' || nativeGridType(result.columnTypes[columnIndex]) === 'number') && !layout.formatters[columnKey] ? styles.numericCell : undefined} title={(formatted.error ? `${formatted.error}\n保持原始值：${databaseCellText(value)}` : layout.formatters[columnKey] ? `显示值：${formatted.text}\n原始值：${databaseCellText(value)}` : formatted.text).slice(0, 4096)}><span>{typeof value === 'boolean' && layout.booleanMode === 'checkbox' && !layout.formatters[columnKey] ? <span className={styles.booleanValue} role="img" aria-label={value ? 'true' : 'false'} data-checked={value}>{value && <Check size={12} weight="bold" />}</span> : value === '' && !layout.formatters[columnKey] ? <i className={styles.emptyString}>空字符串</i> : formatted.text.slice(0, 512)}</span></td>
            })}</tr> })}
            {endRow < result.rows.length && <tr aria-hidden="true" className={styles.spacer}><td colSpan={visible.length + 1} style={{ height: (result.rows.length - endRow) * rowHeight }} /></tr>}
          </tbody></table>
        {!result.rows.length && <div className={styles.empty}><Table size={22} /><strong>{emptyLabel}</strong><span>{result.columns.length ? `${result.columns.length} 个结果列` : '本次执行没有数据结果'}</span></div>}
      </div>
      {jumpOpen && <GridJumpPanel result={result} comments={columnComments} columns={visible} selected={jumpColumn} onClose={() => setJumpOpen(false)} onJump={column => { setJumpColumn(column); const index = visible.indexOf(column); if (viewportRef.current && !layout.pins[keys[column]]) viewportRef.current.scrollLeft = renderedWidths.slice(0, index).reduce((sum, width) => sum + width, 0); viewportRef.current?.querySelector<HTMLElement>('[data-grid-column="' + index + '"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }} />}
      {detailOpen && cell && <GridCellDetail {...cell} presentation={detailPresentation} columnIndex={focus!.colIndex} rowOffset={rowOffset} rowNumber={rowNumbers?.[cell.rowIndex]} columnType={result.columnTypes[cell.columnIndex]} rowCount={result.rows.length} columnCount={visible.length} onMove={(rowIndex, colIndex) => changeSelection(selectGridTarget(selection, { kind: 'cell', rowIndex, colIndex }, {}, dimensions))} onClose={() => { setDetailOpen(false); viewportRef.current?.focus() }} onCopy={(text, label) => void copyText(text, label)} />}
    </div>
    {(!headerTarget || counts.cells > 0) && <footer className={styles.footer}><span className={styles.scope}>{scopeLabel ?? (rowOffset > 0 && result.rows.length ? `当前页 ${rowOffset + 1}–${rowOffset + result.rows.length} 行` : `本次返回 ${result.rows.length.toLocaleString()} 行`)}{result.hasMore || result.truncated ? ' · 还有数据' : ''}</span><div className={styles.statistics}>
      {counts.cells > 0 && (summary ? <><span>数值 <strong>{summary.numericCount.toLocaleString()}</strong></span>{summary.sum !== null && <span title={`精确求和：${summary.sum}`}>求和 <strong>{summary.sum}</strong></span>}{summary.average !== null && <span title={`${summary.averageApproximate ? '近似' : '精确'}平均值：${summary.average}`}>平均 <strong>{summary.averageApproximate ? '≈ ' : ''}{summary.average}</strong></span>}{summary.unsafeNumericCount + summary.limitedNumericCount > 0 && <span className={styles.warning} title={`${summary.unsafeNumericCount} 个驱动已返回不安全整数，${summary.limitedNumericCount} 个数值超出统计精度范围；未参与求和与平均`}>{summary.unsafeNumericCount + summary.limitedNumericCount} 个值未计入数值统计</span>}</> : <span>统计中…</span>)}
      {!counts.cells && <span>统计与复制仅作用于当前已返回数据</span>}
    </div></footer>}
    <GridContextMenu point={contextPoint} cell={cell} scope={contextScope} actions={tableActions} includeHeaders={includeHeaders} onHeaders={setIncludeHeaders} onClose={() => setContextPoint(null)} onReturnFocus={() => { const active = document.activeElement; if (!active || active === document.body || active.getAttribute('aria-hidden') === 'true' || active.closest('[role="menu"]')) viewportRef.current?.focus({ preventScroll: true }) }}
      hasHighlight={!!activeHighlight} canHideEqual={equalColumns.length > 0} hasHiddenColumns={layout.hidden.length > 0} canViewJson={!!contextPoint && !!cell && jsonGridPreview(cell.value) !== null} canViewBinary={!!cell && binaryGridValue(cell.value)}
      onHighlight={mode => { if (mode && cell && contextScope) setHighlight({ sourceKey: resultKey(result), mark: { mode, value: mode === 'value' ? structuredClone((displayRows ?? result.rows)[cell.rowIndex][cell.columnIndex] ?? null) : null, rows: [...contextScope.rows], columns: [...contextScope.columns] } }); else setHighlight(null) }}
      onHideEqual={() => changeLayout(hideGridColumns(layout, keys, equalColumns))} onShowColumns={() => changeLayout({ ...layout, hidden: [] })} onOpenWith={mode => { setDetailPresentation(mode); setDetailOpen(true) }}
      onCellDetails={() => { setDetailPresentation(undefined); setDetailOpen(true) }} onRowDetails={() => setRowDetail(true)} onColumnDetails={() => tableActions ? tableActions.onColumnDetails(cell!.columnName) : setLayoutColumn(cell!.columnIndex)} onCopy={contextCopy} onTranspose={() => { setContextPoint(null); setTransposed(true) }} onClear={() => { setContextPoint(null); changeSelection(emptyGridSelection()) }}
      onScreenshot={() => { if (viewportRef.current) void downloadGridSelectionImage(result, displayRows, selection, visible, keys, layout, renderedWidths, rowHeight, viewportRef.current).catch(error => notice(error instanceof Error ? error.message : '截图失败')) }} />
    {rowDetail && cell && <SqlDialog title={`行详情 · 第 ${rowNumbers?.[cell.rowIndex] ?? rowOffset + cell.rowIndex + 1} 行`} onClose={() => setRowDetail(false)}><dl className={contextStyles.record}>{result.columns.map((name, column) => <div key={column}><dt>{columnLabel(result.columns, column)}</dt><dd><pre>{rawGridCellText((displayRows ?? result.rows)[cell.rowIndex][column] ?? null, true)}</pre></dd></div>)}</dl></SqlDialog>}
    {layoutColumn !== null && <GridLayoutDialog result={result} keys={keys} initial={layout} initialColumn={layoutColumn} persistent={!!layoutScopeKey} onApply={(next) => { changeLayout(next); setLayoutColumn(null); viewportRef.current?.focus() }} onClose={() => { setLayoutColumn(null); viewportRef.current?.focus() }} />}
  </div>
}
