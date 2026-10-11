"use client"

import { useId, useRef, useState } from 'react'
import { Check, DotsSixVertical, ListChecks, MagnifyingGlass } from '@phosphor-icons/react'
import type { DatabaseQueryResult } from '@fouc/shared'
import { columnLabel } from '../../result-format'
import { TableQueryPopover } from '../../table-query-popover'
import { useQueryRuleReorder } from '../../use-query-rule-reorder'
import { displayedGridColumns, hideGridColumns, orderedGridFields, reorderGridFields, setGridColumnVisible, type GridLayout } from './model'
import { fitGridColumn } from './width'
import styles from './workbench-controls.module.css'

export function GridFieldFilter({ result, keys, layout, onChange }: { result: DatabaseQueryResult; keys: readonly string[]; layout: GridLayout; onChange: (layout: GridLayout) => void }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('')
  const anchor = useRef<HTMLButtonElement>(null), id = useId()
  const ordered = orderedGridFields(keys, layout), visible = displayedGridColumns(result, keys, layout)
  const needle = search.trim().toLocaleLowerCase()
  function fitAll() { const widths = { ...layout.widths }; for (const column of ordered) widths[keys[column]] = fitGridColumn(result, column, { density: layout.density, fontSize: layout.fontSize, formatter: layout.formatters[keys[column]], autoFit: true }); onChange({ ...layout, widths }) }
  return <>
    <button ref={anchor} type="button" className="fouc-action" aria-haspopup="dialog" aria-expanded={open} disabled={!keys.length} title="字段筛选" onClick={() => setOpen(value => !value)}><ListChecks size={16} />字段筛选</button>
    <TableQueryPopover id={id} label="字段筛选" open={open} anchor={anchor} onClose={() => setOpen(false)} width={300} className={styles.popover}>
      <header className={styles.head}><strong>字段筛选</strong><span>{visible.length}/{keys.length}</span></header>
      <label className={styles.search}><MagnifyingGlass size={16} /><input data-autofocus aria-label="搜索字段" placeholder="搜索字段..." value={search} onChange={event => setSearch(event.target.value)} /></label>
      <GridFieldList key={needle ? "filtered" : "ordered"} result={result} keys={keys} layout={layout} onChange={onChange} search={search} />
      <div className={styles.widthRow}><span>列宽</span><button type="button" className="fouc-action" onClick={fitAll}>自动适配列宽</button></div>
      <div className={styles.fieldFooter} role="group" aria-label="字段操作"><p>至少保留一列可见。拖动可调整字段顺序。</p><div>
        <button type="button" className="fouc-action" onClick={() => onChange(hideGridColumns({ ...layout, hidden: [], hideNullColumns: false }, keys, ordered.filter(column => !layout.hidden.includes(keys[column]))))}>反选</button>
        <button type="button" className="fouc-action" disabled={!layout.order.length} onClick={() => onChange({ ...layout, order: [] })}>重置顺序</button>
        <button type="button" className="fouc-action" disabled={!layout.hidden.length && !layout.hideNullColumns} onClick={() => onChange({ ...layout, hidden: [], hideNullColumns: false })}>显示全部</button>
      </div></div>
    </TableQueryPopover>
  </>
}

function GridFieldList({ result, keys, layout, onChange, search }: { result: DatabaseQueryResult; keys: readonly string[]; layout: GridLayout; onChange: (layout: GridLayout) => void; search: string }) {
  const ordered = orderedGridFields(keys, layout), visible = displayedGridColumns(result, keys, layout), needle = search.trim().toLocaleLowerCase()
  const { list: listRef, row: rowProps, handle: dragHandle } = useQueryRuleReorder(ordered.length, !!needle, (source, target) => onChange(reorderGridFields(layout, keys, source, target)))
  return (<section ref={listRef} data-query-rule-list className={styles.fieldList}>
        {ordered.map((column, position) => !needle || result.columns[column].toLocaleLowerCase().includes(needle) ? <div key={keys[column]} className={styles.fieldRow} {...rowProps(position)}>
          <button type="button" className={`fouc-action ${styles.grip}`} disabled={!!needle} aria-label={`移动字段 ${columnLabel(result.columns, column)}`} title="长按拖动 · 空格选择、上下键移动" {...dragHandle(position)}><DotsSixVertical size={14} /></button>
          <button type="button" className={`fouc-action ${styles.fieldChoice}`} role="checkbox" aria-checked={visible.includes(column)} disabled={visible.includes(column) && visible.length === 1} onClick={() => onChange(setGridColumnVisible({ ...layout, hideNullColumns: false }, keys, keys[column], !visible.includes(column)))}>
            <span className={styles.check} data-checked={visible.includes(column)}>{visible.includes(column) && <Check size={12} weight="bold" />}</span><span title={result.columns[column]}>{columnLabel(result.columns, column)}</span>
          </button>
        </div> : null)}
        {needle && !result.columns.some(name => name.toLocaleLowerCase().includes(needle)) && <p className={styles.empty}>没有匹配字段</p>}
      </section>)
}
