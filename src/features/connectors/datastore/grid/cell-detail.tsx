"use client"

import { useRef } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, TextAlignLeft, X } from '@phosphor-icons/react'
import type { DatabaseCell } from '@fouc/shared'
import { rawGridCellText } from './clipboard'
import { adjacentDataGridDetailIndex, detailNavigationDelta, shouldIgnoreDataGridDetailNavigation, type DataGridDetailNavigationAxis, type DataGridDetailNavigationDelta } from './detail-navigation'
import { selectAllCellDetailText } from './detail-selection'
import styles from './result-grid.module.css'

type Props = { value: DatabaseCell; rowIndex: number; rowOffset: number; rowNumber?: number; columnIndex: number; columnName: string; columnType?: string; rowCount: number; columnCount: number; onMove: (row: number, column: number) => void; onClose: () => void; onCopy: (text: string, label: string) => void }

export function GridCellDetail({ value, rowIndex, rowOffset, rowNumber, columnIndex, columnName, columnType, rowCount, columnCount, onMove, onClose, onCopy }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null), text = rawGridCellText(value, true)
  const kind = value === null ? 'NULL' : value === '' ? '空字符串' : typeof value === 'object' ? !Array.isArray(value) && value.type === 'binary' ? '二进制 · 原始数据' : 'JSON' : typeof value === 'boolean' ? '布尔值' : columnType || (typeof value === 'number' ? '数值' : '文本')
  function move(axis: DataGridDetailNavigationAxis, delta: DataGridDetailNavigationDelta) {
    const next = adjacentDataGridDetailIndex(axis === 'row' ? rowIndex : columnIndex, delta, axis === 'row' ? rowCount : columnCount)
    if (next !== null) onMove(axis === 'row' ? next : rowIndex, axis === 'column' ? next : columnIndex)
  }
  function selectAll() {
    const element = textRef.current
    if (!element) return
    element.focus()
    selectAllCellDetailText({ state: { doc: { length: element.value.length } }, dispatch: ({ selection }) => element.setSelectionRange(selection.anchor, selection.head) })
  }
  return <aside className={styles.detail} aria-label="单元格详情" tabIndex={0} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (shouldIgnoreDataGridDetailNavigation(event)) return
    for (const axis of ['row', 'column'] as const) { const delta = detailNavigationDelta(event.key, axis); if (delta !== null) { event.preventDefault(); move(axis, delta) } }
  }}>
    <header className={styles.detailHeader}><div><span>单元格详情</span><strong title={columnName}>{columnName}</strong></div><button type="button" aria-label="关闭单元格详情" onClick={onClose}><X size={15} /></button></header>
    <div className={styles.detailMeta}><span>第 {rowNumber ?? rowOffset + rowIndex + 1} 行</span><span title={kind}>{kind}</span><span>{text.length.toLocaleString()} 字符</span></div>
    <div className={styles.detailNavigation}><div><button type="button" disabled={rowIndex === 0} aria-label="上一行" title="上一行 · ↑" onClick={() => move('row', -1)}><ArrowUp size={14} /></button><button type="button" disabled={rowIndex + 1 === rowCount} aria-label="下一行" title="下一行 · ↓" onClick={() => move('row', 1)}><ArrowDown size={14} /></button><i /><button type="button" disabled={columnIndex === 0} aria-label="上一列" title="上一列 · ←" onClick={() => move('column', -1)}><ArrowLeft size={14} /></button><button type="button" disabled={columnIndex + 1 === columnCount} aria-label="下一列" title="下一列 · →" onClick={() => move('column', 1)}><ArrowRight size={14} /></button></div><span>{columnIndex + 1} / {columnCount} 列</span></div>
    <textarea ref={textRef} aria-label="单元格原始值" readOnly value={text} spellCheck={false} className={styles.detailValue} />
    <footer className={styles.detailFooter}><button type="button" onClick={selectAll}><TextAlignLeft size={14} />全选内容</button><button type="button" onClick={() => onCopy(rawGridCellText(value), '单元格原始值')}><Copy size={14} />复制原始值</button></footer>
  </aside>
}
