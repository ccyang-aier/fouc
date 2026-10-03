'use client'

import { ArrowRight, Key, Plus, Trash } from '@phosphor-icons/react'
import type { DatabaseQueryResult } from '@fouc/shared'
import { columnLabel } from '../result-format'
import { inferCompareKeys, type DataCompareColumnMapping } from './model'
import styles from './compare.module.css'

type Props = { left: DatabaseQueryResult; right: DatabaseQueryResult; mapping: readonly DataCompareColumnMapping[]; keys: readonly string[]; primaryKeys?: readonly string[]; disabled: boolean; onChange: (mapping: DataCompareColumnMapping[], keys: string[]) => void }
export function CompareMappingEditor({ left, right, mapping, keys, primaryKeys = [], disabled, onChange }: Props) {
  const availableLeft = left.columns.map((_, index) => index).filter((index) => !mapping.some((entry) => entry.left === index)), availableRight = right.columns.map((_, index) => index).filter((index) => !mapping.some((entry) => entry.right === index))
  return <section className={styles.mapping} aria-label="比较列与匹配键">
    <div className={styles.sectionHead}><strong>列映射与匹配键</strong><span>匹配键必须能唯一标识行，可选择多个列</span><button type="button" disabled={disabled || !primaryKeys.length} onClick={() => onChange([...mapping], inferCompareKeys(left, mapping, primaryKeys))}>使用已知主键</button></div>
    <div className={styles.mappingRows}>{mapping.map((entry) => <div className={styles.mappingRow} key={entry.id}>
      <button type="button" disabled={disabled} className={keys.includes(entry.id) ? styles.keyActive : styles.keyButton} aria-label={`${columnLabel(left.columns, entry.left)} 作为匹配键`} aria-pressed={keys.includes(entry.id)} onClick={() => onChange([...mapping], keys.includes(entry.id) ? keys.filter((id) => id !== entry.id) : [...keys, entry.id])}><Key size={14} /><span>键{keys.includes(entry.id) && keys.length > 1 ? ` ${keys.indexOf(entry.id) + 1}` : ''}</span></button>
      <select disabled={disabled} aria-label={`${entry.id} 左侧列`} value={entry.left} onChange={(event) => onChange(mapping.map((item) => item.id === entry.id ? { ...item, left: Number(event.target.value) } : item), [...keys])}>{left.columns.map((_, index) => <option key={index} value={index} disabled={mapping.some((item) => item.id !== entry.id && item.left === index)}>{columnLabel(left.columns, index)} · {left.columnTypes[index] || '未知类型'}</option>)}</select>
      <ArrowRight size={13} className={styles.mappingArrow} />
      <select disabled={disabled} aria-label={`${entry.id} 右侧列`} value={entry.right} onChange={(event) => onChange(mapping.map((item) => item.id === entry.id ? { ...item, right: Number(event.target.value) } : item), [...keys])}>{right.columns.map((_, index) => <option key={index} value={index} disabled={mapping.some((item) => item.id !== entry.id && item.right === index)}>{columnLabel(right.columns, index)} · {right.columnTypes[index] || '未知类型'}</option>)}</select>
      <button type="button" disabled={disabled} aria-label={`移除 ${columnLabel(left.columns, entry.left)} 映射`} onClick={() => onChange(mapping.filter((item) => item.id !== entry.id), keys.filter((id) => id !== entry.id))}><Trash size={14} /></button>
    </div>)}</div>
    <div className={styles.mappingFoot}><button type="button" disabled={disabled || !availableLeft.length || !availableRight.length} onClick={() => onChange([...mapping, { id: `mapping-${crypto.randomUUID()}`, left: availableLeft[0], right: availableRight[0] }], [...keys])}><Plus size={13} />添加列映射</button><span>{mapping.length} 对列 · {keys.length ? `${keys.length} 个匹配键` : '尚未选择匹配键'}</span></div>
  </section>
}
