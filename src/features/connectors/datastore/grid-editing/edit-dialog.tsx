"use client"

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ClipboardText, PencilSimple, WarningCircle } from '@phosphor-icons/react'
import type { DatabaseColumnInfo, DatabaseTablePage, RelationalProvider } from '@fouc/shared'
import { SqlDialog } from '../sql-library-dialog'
import common from '../relational.module.css'
import { parseGridEditClipboard } from './clipboard'
import { fillGridSelection, pasteGridSelection, stageGridCellEdits } from './operations'
import { GRID_EDIT_LIMITS, gridDraftCellValue, type GridCellEdit, type GridEditDraft, type GridEditSelection, type GridEditValue } from './model'
import { coerceGridEditValue, gridCellEditorText, sameGridEditValue } from './values'
import styles from './grid-editing.module.css'

export type GridEditOperation = { kind: 'fill' | 'paste'; page: DatabaseTablePage; provider: RelationalProvider; scope: GridEditSelection; drafts: readonly GridEditDraft[]; revision: number; signature: string; initialMode?: 'value' | 'null'; initialPaste?: string }
type Props = { operation: GridEditOperation; provider: RelationalProvider; sourceCurrent: boolean; isCurrent: () => boolean; onApply: (edits: readonly GridCellEdit[], label: string) => void; onClose: () => void }
function previewText(value: ReturnType<typeof gridDraftCellValue>, column: DatabaseColumnInfo): string { return value === null ? 'NULL' : value === '' ? '"" · 空字符串' : value === 'NULL' ? '"NULL"' : gridCellEditorText(value, column) }

export function GridEditDialog({ operation, provider, sourceCurrent, isCurrent, onApply, onClose }: Props) {
  const { page, scope, drafts } = operation, first = gridDraftCellValue(page, drafts, { rowIndex: scope.rows[0], columnIndex: scope.columns[0] })
  const [mode, setMode] = useState<GridEditValue['mode']>(operation.initialMode ?? (first === null ? 'null' : 'value')), [text, setText] = useState(operation.kind === 'paste' ? operation.initialPaste ?? '' : gridCellEditorText(first, page.columns[scope.columns[0]]))
  const [separator, setSeparator] = useState<',' | '\t'>('\t'), [nullMarker, setNullMarker] = useState(false), [emptyAsNull, setEmptyAsNull] = useState(false)
  const [reading, setReading] = useState(false), [readError, setReadError] = useState(''), inputRevision = useRef(0), alive = useRef(true)
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const plan = useMemo(() => {
    try {
      const edits = operation.kind === 'paste' ? pasteGridSelection(scope, parseGridEditClipboard(text, { separator, ...(nullMarker ? { nullToken: 'NULL' } : {}), emptyStringAsNull: emptyAsNull })) : fillGridSelection(scope, mode === 'value' ? { mode, text } : { mode })
      let ordinal = 0
      const next = stageGridCellEdits(page, drafts, edits, provider, () => `preview-${ordinal++}`)
      const changed = edits.filter((edit) => !sameGridEditValue(gridDraftCellValue(page, drafts, edit), gridDraftCellValue(page, next, edit))).length
      return { edits, changed, error: '' }
    } catch (reason) { return { edits: [] as GridCellEdit[], changed: 0, error: reason instanceof Error ? reason.message : '无法预览编辑' } }
  }, [operation.kind, page, drafts, scope, provider, mode, text, separator, nullMarker, emptyAsNull])
  async function readClipboard() {
    const revision = ++inputRevision.current
    setReading(true); setReadError('')
    try {
      const value = await navigator.clipboard.readText()
      if (!alive.current) return
      if (!isCurrent()) { setReadError('原始页、选区或待提交列表已改变，请关闭后重新打开'); return }
      if (revision !== inputRevision.current) { setReadError('读取期间已编辑输入内容，保留当前输入'); return }
      setText(value)
    } catch { if (alive.current) setReadError('无法读取剪贴板，可直接在下面粘贴；请检查浏览器权限') }
    finally { if (alive.current) setReading(false) }
  }
  const canApply = sourceCurrent && !plan.error && plan.changed > 0
  return <SqlDialog title={operation.kind === 'paste' ? '粘贴到网格选区' : '编辑网格选区'} className={styles.dialog} onClose={onClose}><form className={styles.form} onSubmit={(event) => { event.preventDefault(); if (canApply) onApply(plan.edits, operation.kind === 'paste' ? '粘贴选区' : mode === 'restore' ? '恢复选区原值' : mode === 'null' ? '选区设为 NULL' : '填充选区') }}>
    <div className={styles.scope}><span>{operation.kind === 'paste' ? <ClipboardText size={15} /> : <PencilSimple size={15} />}<strong>{scope.rows.length} 行 × {scope.columns.length} 列</strong><small>{scope.rows.length * scope.columns.length} 个单元格</small></span><small>本次已加载页 · 最多 {GRID_EDIT_LIMITS.rows} 行 / {GRID_EDIT_LIMITS.cells} 单元格</small></div>
    <div className={styles.body}><section className={styles.inputSection} aria-label="编辑内容">{operation.kind === 'paste' ? <><div className={styles.inputHead}><label>分隔格式<select value={separator} onChange={(event) => setSeparator(event.target.value as ',' | '\t')}><option value={'\t'}>TSV · 制表符</option><option value=",">CSV · 逗号</option></select></label><button type="button" disabled={reading || !sourceCurrent} onClick={() => void readClipboard()}><ClipboardText size={14} />{reading ? '读取中…' : '读取剪贴板'}</button></div><label>粘贴矩阵<textarea aria-label="网格粘贴内容" value={text} rows={5} maxLength={GRID_EDIT_LIMITS.characters} autoFocus spellCheck={false} placeholder="粘贴 CSV / TSV；单个值填充选区，多单元格须与选区尺寸一致" onChange={(event) => { inputRevision.current++; setText(event.target.value); setReadError('') }} /></label><div className={styles.pasteOptions}><label><input type="checkbox" checked={nullMarker} onChange={(event) => setNullMarker(event.target.checked)} />未加引号的 NULL → 空值</label><label><input type="checkbox" checked={emptyAsNull} onChange={(event) => setEmptyAsNull(event.target.checked)} />空字符串 → 空值</label></div><small>默认保留 NULL 文字与空字符串。字段可用双引号包裹，以保留制表符、逗号和换行；不会跳过空行或截断数据。</small></> : <><label>值模式<select value={mode} onChange={(event) => setMode(event.target.value as GridEditValue['mode'])}><option value="value">明确赋值 · 保留空字符串</option><option value="null">设为 SQL NULL</option><option value="restore">恢复原值 · 移除此字段的暂存变更</option></select></label>{mode === 'value' && <label>填充值<textarea aria-label="网格填充值" value={text} rows={4} maxLength={GRID_EDIT_LIMITS.characters} autoFocus spellCheck={false} onChange={(event) => setText(event.target.value)} /></label>}<small>{mode === 'restore' ? '恢复所选字段在原始已加载行中的值，不影响同一行的其他暂存字段。' : mode === 'null' ? '所有选中字段必须允许 NULL。任一字段验证失败时整次操作不会加入待提交列表。' : '按目标字段类型解析。大整数与十进制保留精确文本；JSON 与布尔值须有效，二进制填写 Base64。'}</small></>}{readError && <p className={styles.error} role="alert">{readError}</p>}{!sourceCurrent && <p className={styles.error} role="alert"><WarningCircle size={14} />原始页、选区或待提交列表已改变，请关闭后重新打开</p>}{plan.error && <p className={styles.error} role="alert">{plan.error}</p>}</section>
    <section className={styles.preview} aria-label="编辑预览"><header><strong>逐单元格预览</strong><small>原始快照保留 · 一次操作可完整撤销</small></header><div className={styles.previewScroll}><table><thead><tr><th>位置</th><th>原始值</th><th>已有暂存值</th><th>本次新值</th></tr></thead><tbody>{plan.edits.map((edit) => {
      const original = page.rows[edit.rowIndex][edit.columnIndex], pending = gridDraftCellValue(page, drafts, edit), column = page.columns[edit.columnIndex]
      const value = edit.input.mode === 'restore' ? original : edit.input.mode === 'null' ? null : coerceGridEditValue(edit.input.text, column, original, provider)
      return <tr key={`${edit.rowIndex}:${edit.columnIndex}`}><th><b>第 {page.offset + edit.rowIndex + 1} 行</b><span title={column.name}>{column.name}</span></th>{[original, pending, value].map((cell, index) => <td key={index} title={previewText(cell, column).slice(0, 4096)} data-null={cell === null || undefined}><code>{previewText(cell, column).slice(0, 240)}</code></td>)}</tr>
    })}</tbody></table>{!plan.edits.length && <p className={styles.empty}>修正输入后显示完整编辑预览</p>}</div></section></div>
    <footer className={`${common.dialogFooter} ${styles.footer}`}><small>{plan.edits.length ? plan.changed ? `${plan.changed} 个值改变 · ` : '值与当前暂存内容一致 · ' : ''}保存时仍需 SQL 预览确认</small><button type="button" className={common.secondary} onClick={onClose}>取消</button><button type="submit" className={common.primary} disabled={!canApply}>应用到待提交列表</button></footer>
  </form></SqlDialog>
}
