"use client"

import { useState } from 'react'
import { Columns, MagnifyingGlass } from '@phosphor-icons/react'
import type { DatabaseQueryResult } from '@fouc/shared'
import { columnLabel } from '../../result-format'
import { WorkbenchSidePanel } from '../../workbench-side-panel'
import styles from './jump-panel.module.css'

export function GridJumpPanel({ result, comments, columns, selected, onJump, onClose }: { result: DatabaseQueryResult; comments?: readonly (string | null)[]; columns: readonly number[]; selected: number | null; onJump: (column: number) => void; onClose: () => void }) {
  const [search, setSearch] = useState(''), [pinned, setPinned] = useState(false)
  const needle = search.trim().toLocaleLowerCase(), matches = columns.filter(column => [result.columns[column], comments?.[column] ?? ''].some(value => value.toLocaleLowerCase().includes(needle)))
  return <WorkbenchSidePanel label="跳转列" title="跳转列" icon={<Columns size={16} />} pinned={pinned} onPin={() => setPinned(value => !value)} onClose={onClose}>
    <label className={styles.search}><MagnifyingGlass size={16} /><input autoFocus aria-label="搜索跳转列" placeholder="搜索列/注释..." value={search} onChange={event => setSearch(event.target.value)} /></label>
    <div className={styles.list} aria-label="可见字段">{matches.map(column => <button type="button" key={column} className="fouc-action" data-active={selected === column || undefined} onClick={() => onJump(column)} title={`${result.columns[column]} · ${result.columnTypes[column]}`}><span>{columnLabel(result.columns, column)}</span><small>#{columns.indexOf(column) + 1}</small></button>)}{!matches.length && <p>没有匹配字段</p>}</div>
  </WorkbenchSidePanel>
}
