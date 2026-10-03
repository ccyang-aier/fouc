'use client'

import { useState } from 'react'
import type { RelationalProvider } from '@fouc/shared'
import { columnLabel } from '../result-format'
import { compareCellAt, type DataCompareEntry, type DataCompareResult } from './model'
import { compareCellKind, compareCellText } from './values'
import styles from './compare.module.css'

export function CompareEntryDetail({ entry, comparison, provider, leftLabel, rightLabel }: { entry: DataCompareEntry; comparison: DataCompareResult; provider?: RelationalProvider; leftLabel: string; rightLabel: string }) {
  const [leftIndex, setLeftIndex] = useState(entry.leftRows[0]), [rightIndex, setRightIndex] = useState(entry.rightRows[0])
  return <section className={styles.detail} aria-label="数据差异详情">
    <div className={styles.sectionHead}><strong>差异详情</strong><span>{entry.changes.length ? `${entry.changes.length} 个字段变化` : entry.kind === 'conflict' ? '需要调整匹配键或原始数据' : entry.kind === 'unchanged' ? '映射列一致' : '当前范围内仅一侧存在'}</span></div>
    {entry.reasons.length > 0 && <div className={styles.conflictReasons} role="alert">{entry.reasons.map((reason) => <p key={reason}>{reason}</p>)}</div>}
    <div className={styles.detailSides}>{(['left', 'right'] as const).map((side) => <label key={side}><span title={side === 'left' ? leftLabel : rightLabel}>{side === 'left' ? leftLabel : rightLabel}</span><select aria-label={`${side === 'left' ? '左' : '右'}侧详情行`} disabled={!entry[side === 'left' ? 'leftRows' : 'rightRows'].length} value={side === 'left' ? leftIndex ?? '' : rightIndex ?? ''} onChange={(event) => side === 'left' ? setLeftIndex(Number(event.target.value)) : setRightIndex(Number(event.target.value))}>{!entry[side === 'left' ? 'leftRows' : 'rightRows'].length && <option value="">当前范围不存在</option>}{entry[side === 'left' ? 'leftRows' : 'rightRows'].map((index) => <option key={index} value={index}>已加载结果第 {index + 1} 行</option>)}</select></label>)}</div>
    <div className={styles.detailMatrix}><table><thead><tr><th>映射列</th><th>左侧原始值</th><th>右侧原始值</th></tr></thead><tbody>{comparison.mapping.map((mapping) => {
      const leftValue = leftIndex === undefined ? undefined : compareCellAt(comparison.left.rows[leftIndex], mapping.left), rightValue = rightIndex === undefined ? undefined : compareCellAt(comparison.right.rows[rightIndex], mapping.right), changed = entry.changes.some((change) => change.mappingId === mapping.id)
      return <tr key={mapping.id} data-changed={changed || undefined}><th><strong>{columnLabel(comparison.left.columns, mapping.left)}</strong><small>→ {columnLabel(comparison.right.columns, mapping.right)}{comparison.keyColumns.includes(mapping.id) ? ' · 匹配键' : ''}</small></th>{(['left', 'right'] as const).map((side) => { const value = side === 'left' ? leftValue : rightValue, type = comparison[side].columnTypes[mapping[side]]; return <td key={side}><small>{compareCellKind(value, type, provider)}</small><pre>{compareCellText(value, true)}</pre></td> })}</tr>
    })}</tbody></table></div>
  </section>
}
