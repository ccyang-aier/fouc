"use client"

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ArrowCounterClockwise, ArrowClockwise, ClipboardText, Copy, PencilSimple, ArrowUUpLeft } from '@phosphor-icons/react'
import type { DatabaseTablePage, RelationalProvider } from '@fouc/shared'
import { formatGridEditClipboard } from './clipboard'
import { GridEditDialog, type GridEditOperation } from './edit-dialog'
import { editableGridScope, gridDraftCellValue, gridEditScopeSignature, gridEditSourceCurrent, type GridEditCell, type GridEditSelection } from './model'
import { sameGridEditValue } from './values'
import { fillGridSelection, stageGridCellEdits, validateGridEditScope } from './operations'
import type { GridDraftHistory } from './use-grid-draft-history'
import { gridEditNativeInput, gridEditShortcut } from './shortcuts'
import styles from './grid-editing.module.css'

export type GridEditingActionsProps = { page: DatabaseTablePage; provider: RelationalProvider; selection: GridEditSelection | null; activeCell?: GridEditCell | null; writable: boolean; disabled: boolean; history: GridDraftHistory; onNotice?: (message: string) => void; shortcutTarget?: RefObject<HTMLElement | null> }
export function GridEditingActions({ page, provider, selection, activeCell, writable, disabled, history, onNotice, shortcutTarget }: GridEditingActionsProps) {
  const scope = editableGridScope(selection, activeCell), signature = gridEditScopeSignature(scope), scopeError = validateGridEditScope(page, scope)
  const [operation, setOperation] = useState<GridEditOperation | null>(null), [feedback, setFeedback] = useState('')
  const latest = useRef({ page, provider, revision: history.revision, signature, writable, disabled, alive: true })
  useLayoutEffect(() => { latest.current = { page, provider, revision: history.revision, signature, writable, disabled, alive: true }; return () => { latest.current.alive = false } }, [page, provider, history.revision, signature, writable, disabled])
  const busy = disabled || !writable, current = !operation || gridEditSourceCurrent(operation, { page, provider, revision: history.revision, signature, writable, disabled, alive: true })
  function notice(message: string) { setFeedback(message); onNotice?.(message) }
  function isCurrent() { return !!operation && gridEditSourceCurrent(operation, latest.current) }
  function open(kind: GridEditOperation['kind'], initialMode?: 'value' | 'null', initialPaste?: string) {
    if (busy || !scope || scopeError) { notice(scopeError ?? '解锁表格写入后可编辑'); return }
    setOperation({ kind, page, provider, scope: { ...scope, rows: [...scope.rows], columns: [...scope.columns] }, drafts: history.drafts, revision: history.revision, signature, initialMode, initialPaste }); setFeedback('')
  }
  const scopedKey = useEffectEvent((event: globalThis.KeyboardEvent) => {
    const command = gridEditShortcut(event)
    if (!command || busy) return
    event.preventDefault(); event.stopPropagation()
    if (command === 'undo') history.undo(); else history.redo()
  })
  const scopedPaste = useEffectEvent((event: ClipboardEvent) => {
    if (gridEditNativeInput(event.target)) return
    event.preventDefault(); event.stopPropagation()
    if (busy || scopeError) { notice(busy ? '解锁表格写入后可粘贴' : scopeError!); return }
    const text = event.clipboardData?.getData('text/plain')
    if (text === undefined) { notice('剪贴板未提供文本，可使用粘贴工具手动输入'); return }
    open('paste', undefined, text)
  })
  useEffect(() => {
    const element = shortcutTarget?.current
    if (!element) return
    const key = (event: globalThis.KeyboardEvent) => scopedKey(event), paste = (event: ClipboardEvent) => scopedPaste(event)
    element.addEventListener('keydown', key, true); element.addEventListener('paste', paste, true)
    return () => { element.removeEventListener('keydown', key, true); element.removeEventListener('paste', paste, true) }
  }, [shortcutTarget])
  function restore() {
    if (busy || !scope || scopeError) return
    try { history.apply(stageGridCellEdits(page, history.drafts, fillGridSelection(scope, { mode: 'restore' }), provider), '恢复选区原值'); notice('已移除选区字段的暂存变更，原始数据保持完整') }
    catch (reason) { notice(reason instanceof Error ? reason.message : '无法恢复原值') }
  }
  async function copyPending() {
    if (!scope?.rectangular) return
    try { const rows = scope.rows.map((rowIndex) => scope.columns.map((columnIndex) => gridDraftCellValue(page, history.drafts, { rowIndex, columnIndex }))); await navigator.clipboard.writeText(formatGridEditClipboard(rows, '\t')); notice('已复制选区当前值 · TSV · 包含暂存编辑；NULL 文字与空值分别编码') }
    catch { notice('复制失败，请检查浏览器剪贴板权限') }
  }
  return <div className={styles.actions} aria-label="网格暂存编辑工具" onKeyDown={(event) => {
    const command = gridEditShortcut(event)
    if (!command || busy) return
    event.preventDefault(); if (command === 'undo') history.undo(); else history.redo()
  }}><div className={styles.actionButtons}>
    <button type="button" disabled={busy || !!scopeError} title={scopeError ?? '编辑当前单元格或完整选区'} onClick={() => open('fill')}><PencilSimple size={14} />编辑选区</button><button type="button" disabled={busy || !!scopeError} title={scopeError ?? '粘贴矩阵或单个填充值'} onClick={() => open('paste')}><ClipboardText size={14} />粘贴</button><button type="button" disabled={busy || !!scopeError} title={scopeError ?? '所选字段设为 NULL，先查看预览'} onClick={() => open('fill', 'null')}>NULL</button><button type="button" disabled={busy || !!scopeError || !history.drafts.length} title={scopeError ?? '移除选中字段的暂存赋值'} onClick={restore}><ArrowUUpLeft size={14} /><span>恢复原值</span></button>
    <i /><button type="button" disabled={busy || !history.canUndo} title={`撤销${history.undoLabel} · Ctrl / ⌘ Z（工具栏焦点）`} aria-label="撤销待提交变更" onClick={history.undo}><ArrowCounterClockwise size={14} /></button><button type="button" disabled={busy || !history.canRedo} title={`重做${history.redoLabel} · Ctrl / ⌘ Shift Z（工具栏焦点）`} aria-label="重做待提交变更" onClick={history.redo}><ArrowClockwise size={14} /></button>{history.drafts.length > 0 && <button type="button" disabled={!scope?.rectangular || !scope.rows.length || scope.rows.length * scope.columns.length > 100} title="复制选区当前值（包含暂存变更），不使用显示格式" onClick={() => void copyPending()}><Copy size={14} /><span>复制暂存值</span></button>}
    <small title={scopeError ?? ''}>{scope ? `${scope.rows.length} 行 × ${scope.columns.length} 列${!scope.rectangular ? ' · 离散选区' : ''}` : '选择单元格或矩形以编辑'}</small>
  </div>{feedback && <p className={styles.feedback} role="status">{feedback}</p>}{operation && <GridEditDialog operation={operation} provider={operation.provider} sourceCurrent={current} isCurrent={isCurrent} onClose={() => setOperation(null)} onApply={(edits, label) => {
    if (!isCurrent()) { notice('来源已改变，保留当前输入；请关闭后重新打开选区编辑'); return }
    try { const next = stageGridCellEdits(page, history.drafts, edits, provider), changed = edits.filter((edit) => !sameGridEditValue(gridDraftCellValue(page, history.drafts, edit), gridDraftCellValue(page, next, edit))).length; history.apply(next, label); setOperation(null); notice(changed ? `已暂存 ${changed} 个单元格 · 单次撤销 · 尚未写入数据库` : '当前值一致，没有新增待提交变更') }
    catch (reason) { notice(reason instanceof Error ? reason.message : '无法加入待提交变更') }
  }} />}</div>
}
