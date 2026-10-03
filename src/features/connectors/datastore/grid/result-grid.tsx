"use client"

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowsDownUp, ArrowUp, Copy, SidebarSimple, Table, X } from '@phosphor-icons/react'
import type { DatabaseCell, DatabaseQueryResult, RelationalSort } from '@fouc/shared'
import { databaseCellText } from '../cell-format'
import { columnLabel } from '../result-format'
import { GridCellDetail } from './cell-detail'
import { formatGridSelection, rawGridCellText } from './clipboard'
import { summarizeExactValues, type ExactSelectionSummary } from './exact-summary'
import { beginDataGridNativeSelectionBlock, finishDataGridNativeSelectionBlock, releaseDataGridNativeSelectionBlock, type NativeSelectionBlockEnvironment } from './native-selection'
import { captureResultGridSelection, dragGridSelection, emptyGridSelection, gridCellSelected, gridSelectionCounts, gridSelectionFrames, gridSelectionScope, moveGridSelection, restoreResultGridSelection, selectAllGridCells, selectedGridCells, selectGridTarget, type GridSelectionModifiers, type GridSelectionTarget, type ResultGridSelection, type ResultGridSelectionScope } from './selection-controller'
import { dataGridSelectionEdgeMask } from './selection-frames'
import styles from './result-grid.module.css'

export type ResultGridCellSelection = { rowIndex: number; columnIndex: number; columnName: string; value: DatabaseCell }
export type { ResultGridSelectionScope } from './selection-controller'
export type ResultGridProps = { result: DatabaseQueryResult; onCellSelect?: (cell: ResultGridCellSelection | null) => void; onSelectionChange?: (scope: ResultGridSelectionScope | null) => void; onNotice?: (message: string) => void; readOnly?: boolean; rowOffset?: number; rowNumbers?: readonly number[]; scopeLabel?: string; emptyLabel?: string; scopeKey?: string; primaryKeys?: readonly string[]; showCellDetails?: boolean; sort?: readonly RelationalSort[]; sortDisabled?: boolean; onSort?: (column: string, additive: boolean) => void; toolbarActions?: ReactNode }

const ROW_HEIGHT = 32, HEADER_HEIGHT = 44, OVERSCAN = 8
const resultKeys = new WeakMap<DatabaseQueryResult, string>()
let nextResultKey = 0
function resultKey(result: DatabaseQueryResult): string { let key = resultKeys.get(result); if (!key) { key = `result-${++nextResultKey}`; resultKeys.set(result, key) } return key }

/** scopeKey must identify one execution/page; only a refresh of that same scope restores selection. */
export function ResultGrid(props: ResultGridProps) {
  return <ResultGridContent key={props.scopeKey ?? resultKey(props.result)} {...props} />
}

function selectionTarget(element: EventTarget | null): GridSelectionTarget | null {
  const cell = (element as Element | null)?.closest?.<HTMLElement>('[data-grid-target]')
  if (!cell) return null
  const kind = cell.dataset.gridTarget
  if (kind !== 'cell' && kind !== 'row' && kind !== 'column') return null
  return { kind, rowIndex: Number(cell.dataset.gridRow), colIndex: Number(cell.dataset.gridColumn) }
}

function ResultGridContent({ result, onCellSelect, onSelectionChange, onNotice, readOnly = true, rowOffset = 0, rowNumbers, scopeLabel, emptyLabel = '查询成功，没有返回记录', primaryKeys = [], showCellDetails = true, sort = [], sortDisabled = false, onSort, toolbarActions }: ResultGridProps) {
  const [state, setState] = useState(() => ({ result, selection: emptyGridSelection() }))
  let selection = state.selection
  if (state.result !== result) {
    selection = restoreResultGridSelection(captureResultGridSelection(state.selection, state.result, primaryKeys), result)
    setState({ result, selection })
  }
  const dimensions = useMemo(() => ({ rows: result.rows.length, columns: result.columns.length }), [result.rows.length, result.columns.length])
  const [detailOpen, setDetailOpen] = useState(false), [includeHeaders, setIncludeHeaders] = useState(false), [feedback, setFeedback] = useState('')
  const [viewportSize, setViewportSize] = useState({ height: 360, top: 0 })
  const [statistics, setStatistics] = useState<{ selection: ResultGridSelection; summary: ExactSelectionSummary } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null), nativeOwner = useRef({}), dragRef = useRef<{ base: ResultGridSelection; start: GridSelectionTarget; modifiers: GridSelectionModifiers; last: string } | null>(null)
  const frameRef = useRef<number | null>(null), pointRef = useRef<{ x: number; y: number } | null>(null), id = useId()
  const counts = useMemo(() => gridSelectionCounts(selection, dimensions), [selection, dimensions])
  const frames = useMemo(() => gridSelectionFrames(selection, dimensions), [selection, dimensions])
  const firstRow = Math.max(0, Math.floor((viewportSize.top - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN)
  const endRow = Math.min(result.rows.length, firstRow + Math.ceil(viewportSize.height / ROW_HEIGHT) + OVERSCAN * 2 + 2)
  const focus = selection.focus, focusSelected = focus !== null && gridCellSelected(selection, focus.rowIndex, focus.colIndex)
  const cell = focusSelected && focus ? { rowIndex: focus.rowIndex, columnIndex: focus.colIndex, columnName: columnLabel(result.columns, focus.colIndex), value: result.rows[focus.rowIndex]?.[focus.colIndex] ?? null } : null
  const notifyCell = useEffectEvent(() => onCellSelect?.(cell))
  const notifySelection = useEffectEvent((scope: ResultGridSelectionScope | null) => onSelectionChange?.(scope))
  const selectionNotificationEnabled = onSelectionChange !== undefined
  useEffect(() => { notifyCell() }, [result, focus?.rowIndex, focus?.colIndex, focusSelected])
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportSize({ height: element.clientHeight, top: element.scrollTop }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    // Clear the previous export scope while a newly changed selection is being measured.
    if (selectionNotificationEnabled) notifySelection(null)
    const timer = setTimeout(() => {
      function* values() { for (const selected of selectedGridCells(selection, result)) yield selected.value }
      setStatistics({ selection, summary: summarizeExactValues(values()) })
      if (selectionNotificationEnabled) notifySelection(gridSelectionScope(selection, result))
    }, 90)
    return () => clearTimeout(timer)
  }, [selection, result, selectionNotificationEnabled])
  useEffect(() => {
    if (!focus) return
    const element = viewportRef.current
    if (!element) return
    const top = focus.rowIndex * ROW_HEIGHT
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + ROW_HEIGHT + HEADER_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = top + ROW_HEIGHT + HEADER_HEIGHT - element.clientHeight
    const timer = requestAnimationFrame(() => element.querySelector<HTMLElement>(`[data-grid-target="cell"][data-grid-row="${focus.rowIndex}"][data-grid-column="${focus.colIndex}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
    return () => cancelAnimationFrame(timer)
  }, [focus])
  useEffect(() => {
    const owner = nativeOwner.current
    return () => { releaseDataGridNativeSelectionBlock(owner); if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [])

  function changeSelection(next: ResultGridSelection) { setState({ result, selection: next }) }
  function notice(message: string) { setFeedback(message); onNotice?.(message) }
  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); notice(`已复制${label}`) }
    catch { notice('复制失败，请检查浏览器剪贴板权限') }
  }
  function copySelection(separator: ',' | '\t') {
    if (!counts.cells) return
    void copyText(formatGridSelection(result, selection, separator, includeHeaders), `${counts.cells.toLocaleString()} 个单元格 · ${separator === ',' ? 'CSV' : 'TSV'}`)
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
      const vertical = point.y < bounds.top + HEADER_HEIGHT + 18 ? -ROW_HEIGHT : point.y > bounds.bottom - 18 ? ROW_HEIGHT : 0
      const horizontal = point.x < bounds.left + 18 ? -24 : point.x > bounds.right - 18 ? 24 : 0
      if (vertical || horizontal) { viewport.scrollBy(horizontal, vertical); frameRef.current = requestAnimationFrame(move) }
    }
    frameRef.current = requestAnimationFrame(move)
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest('input, textarea, button, [contenteditable="true"]')) return
    const control = event.ctrlKey || event.metaKey, key = event.key
    if (control && key.toLowerCase() === 'a') { event.preventDefault(); changeSelection(selectAllGridCells(dimensions)); return }
    if (control && key.toLowerCase() === 'c' && counts.cells) { event.preventDefault(); copySelection('\t'); return }
    if (key === 'Escape') { event.preventDefault(); if (detailOpen) setDetailOpen(false); else changeSelection(emptyGridSelection()); return }
    if (key === 'Enter' && cell && showCellDetails) { event.preventDefault(); setDetailOpen(true); return }
    if (key === ' ' && (control || event.shiftKey)) { event.preventDefault(); changeSelection(selectGridTarget(selection, { kind: control ? 'column' : 'row', rowIndex: focus?.rowIndex ?? 0, colIndex: focus?.colIndex ?? 0 }, {}, dimensions)); return }
    if (/^Arrow(Up|Down|Left|Right)$/.test(key) || ['Home', 'End', 'PageUp', 'PageDown'].includes(key)) {
      event.preventDefault(); changeSelection(moveGridSelection(selection, key, { shift: event.shiftKey, control, pageRows: Math.max(1, Math.floor((viewportSize.height - HEADER_HEIGHT) / ROW_HEIGHT)) }, dimensions))
    }
  }
  function cellEdge(row: number, column: number): number {
    if (!gridCellSelected(selection, row, column)) return 0
    if (!frames.sparse) return dataGridSelectionEdgeMask(frames.frames, row, column)
    return (!gridCellSelected(selection, row - 1, column) ? 1 : 0) | (!gridCellSelected(selection, row, column + 1) ? 2 : 0) | (!gridCellSelected(selection, row + 1, column) ? 4 : 0) | (!gridCellSelected(selection, row, column - 1) ? 8 : 0)
  }
  const summary = statistics?.selection === selection ? statistics.summary : null
  return <div className={styles.gridRoot}>
    <div className={styles.toolbar}><div className={styles.selectionLabel}><Table size={14} /><strong>{counts.cells ? `${counts.cells.toLocaleString()} 个单元格` : '数据结果'}</strong><span>{counts.cells ? `${counts.rows.toLocaleString()} 行` : '点击选择 · Shift 连选 · Ctrl 多选'}</span></div><div className={styles.toolbarActions}>
      <label className={styles.headersToggle}><input type="checkbox" checked={includeHeaders} onChange={(event) => setIncludeHeaders(event.target.checked)} />列名</label>
      <button type="button" disabled={!counts.cells} onClick={() => copySelection('\t')} title="复制选区为 TSV · Ctrl / ⌘ C"><Copy size={13} />TSV</button><button type="button" disabled={!counts.cells} onClick={() => copySelection(',')} title="复制选区为 CSV">CSV</button>
      {showCellDetails && <button type="button" disabled={!cell} aria-pressed={detailOpen && !!cell} onClick={() => setDetailOpen(!detailOpen)} title="单元格详情 · Enter"><SidebarSimple size={14} /><span>详情</span></button>}
      {counts.cells > 0 && <button type="button" aria-label="清除网格选择" title="清除选择 · Escape" onClick={() => changeSelection(emptyGridSelection())}><X size={13} /></button>}
      {toolbarActions}
    </div></div>
    <div className={`${styles.content} ${showCellDetails && detailOpen && cell ? styles.withDetail : ''}`}>
      <div className={styles.viewport} ref={viewportRef} role="grid" tabIndex={0} aria-label="查询结果，使用方向键移动，Shift 扩展选区" aria-rowcount={result.rows.length + 1} aria-colcount={result.columns.length + 1} aria-readonly={readOnly} aria-multiselectable aria-activedescendant={focusSelected && focus && focus.rowIndex >= firstRow && focus.rowIndex < endRow ? `${id}-${focus.rowIndex}-${focus.colIndex}` : undefined} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onScroll={(event) => setViewportSize({ height: event.currentTarget.clientHeight, top: event.currentTarget.scrollTop })} onDoubleClick={(event) => { if (showCellDetails && selectionTarget(event.target)?.kind === 'cell') setDetailOpen(true) }}>
        <table className={styles.table} role="presentation"><thead role="rowgroup"><tr role="row" aria-rowindex={1}><th className={styles.corner} role="columnheader"><button type="button" disabled={!dimensions.rows || !dimensions.columns} title="选择本次已返回的全部单元格" aria-label="选择本次已返回的全部单元格" onClick={() => { changeSelection(selectAllGridCells(dimensions)); viewportRef.current?.focus() }}>#</button></th>{result.columns.map((name, index) => {
          const sortIndex = sort.findIndex((entry) => entry.column === name), direction = sort[sortIndex]?.direction
          return <th key={index} role="columnheader" aria-colindex={index + 2} aria-selected={selection.mode === 'columns' && selection.columns.has(index)} aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined} data-grid-target="column" data-grid-row={focus?.rowIndex ?? 0} data-grid-column={index}><span title={columnLabel(result.columns, index)}>{columnLabel(result.columns, index)}</span><small>{result.columnTypes[index] || '—'}</small>{onSort && result.columnSortables[index] !== false && <button type="button" className={styles.sortButton} disabled={sortDisabled} aria-label={`${name} ${direction === 'asc' ? '升序' : direction === 'desc' ? '降序' : '排序'}`} title="切换排序 · Shift 添加排序列" onClick={(event) => { event.stopPropagation(); onSort(name, event.shiftKey) }}>{direction === 'asc' ? <ArrowUp size={12} /> : direction === 'desc' ? <ArrowDown size={12} /> : <ArrowsDownUp size={12} />}{sort.length > 1 && sortIndex >= 0 && <b>{sortIndex + 1}</b>}</button>}</th>
        })}</tr></thead>
          <tbody role="rowgroup">{firstRow > 0 && <tr aria-hidden="true" className={styles.spacer}><td colSpan={result.columns.length + 1} style={{ height: firstRow * ROW_HEIGHT }} /></tr>}
            {result.rows.slice(firstRow, endRow).map((row, localIndex) => { const rowIndex = firstRow + localIndex; return <tr key={rowIndex} role="row" aria-rowindex={rowIndex + 2}><th role="rowheader" aria-selected={selection.mode === 'rows' && selection.rows.has(rowIndex)} data-grid-target="row" data-grid-row={rowIndex} data-grid-column={focus?.colIndex ?? 0} className={styles.rowNumber}>{rowNumbers?.[rowIndex] ?? rowOffset + rowIndex + 1}</th>{result.columns.map((_, columnIndex) => {
              const value = row[columnIndex] ?? null, selected = gridCellSelected(selection, rowIndex, columnIndex), active = focusSelected && focus?.rowIndex === rowIndex && focus.colIndex === columnIndex, display = databaseCellText(value)
              return <td key={columnIndex} id={`${id}-${rowIndex}-${columnIndex}`} role="gridcell" aria-colindex={columnIndex + 2} aria-selected={selected} data-grid-target="cell" data-grid-row={rowIndex} data-grid-column={columnIndex} data-selected={selected || undefined} data-active={active || undefined} data-edge={cellEdge(rowIndex, columnIndex)} className={value === null ? styles.nullCell : typeof value === 'number' ? styles.numericCell : undefined} title={display.slice(0, 4096)}><span>{value === '' ? <i className={styles.emptyString}>空字符串</i> : display.slice(0, 512)}</span></td>
            })}</tr> })}
            {endRow < result.rows.length && <tr aria-hidden="true" className={styles.spacer}><td colSpan={result.columns.length + 1} style={{ height: (result.rows.length - endRow) * ROW_HEIGHT }} /></tr>}
          </tbody></table>
        {!result.rows.length && <div className={styles.empty}><Table size={22} /><strong>{emptyLabel}</strong><span>{result.columns.length ? `${result.columns.length} 个结果列` : '本次执行没有数据结果'}</span></div>}
      </div>
      {showCellDetails && detailOpen && cell && <GridCellDetail {...cell} rowOffset={rowOffset} rowNumber={rowNumbers?.[cell.rowIndex]} columnType={result.columnTypes[cell.columnIndex]} rowCount={result.rows.length} columnCount={result.columns.length} onMove={(rowIndex, colIndex) => changeSelection(selectGridTarget(selection, { kind: 'cell', rowIndex, colIndex }, {}, dimensions))} onClose={() => { setDetailOpen(false); viewportRef.current?.focus() }} onCopy={(text, label) => void copyText(text, label)} />}
    </div>
    <footer className={styles.footer}><span className={styles.scope}>{scopeLabel ?? (rowOffset > 0 && result.rows.length ? `当前页 ${rowOffset + 1}–${rowOffset + result.rows.length} 行` : `本次返回 ${result.rows.length.toLocaleString()} 行`)}{result.hasMore || result.truncated ? ' · 还有数据' : ''}</span><div className={styles.statistics}>
      {counts.cells > 0 && (summary ? <><span>数值 <strong>{summary.numericCount.toLocaleString()}</strong></span>{summary.sum !== null && <span title={`精确求和：${summary.sum}`}>求和 <strong>{summary.sum}</strong></span>}{summary.average !== null && <span title={`${summary.averageApproximate ? '近似' : '精确'}平均值：${summary.average}`}>平均 <strong>{summary.averageApproximate ? '≈ ' : ''}{summary.average}</strong></span>}{summary.unsafeNumericCount + summary.limitedNumericCount > 0 && <span className={styles.warning} title={`${summary.unsafeNumericCount} 个驱动已返回不安全整数，${summary.limitedNumericCount} 个数值超出统计精度范围；未参与求和与平均`}>{summary.unsafeNumericCount + summary.limitedNumericCount} 个值未计入数值统计</span>}</> : <span>统计中…</span>)}
      {!counts.cells && <span>统计与复制仅作用于当前已返回数据</span>}
    </div></footer>
    {feedback && <div className={styles.feedback} role="status"><span>{feedback}</span>{cell && counts.cells === 1 && <button type="button" onClick={() => void copyText(rawGridCellText(cell.value), '单元格原始值')}>复制原始值</button>}<button type="button" aria-label="关闭复制反馈" onClick={() => setFeedback('')}><X size={12} /></button></div>}
  </div>
}
