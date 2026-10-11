"use client"

import { Check } from "@phosphor-icons/react"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { DatabaseColumnInfo, RelationalSort } from "@fouc/shared"
import type { SortDraft } from "./table-sort-model"
import { QueryRuleActions, QueryRuleHandle } from "./table-query-row-actions"
import styles from "./table-query.module.css"

export function TableSortBuilder({ sort, columns, disabled, onChange }: { sort: SortDraft[]; columns: DatabaseColumnInfo[]; disabled: boolean; onChange: (sort: SortDraft[]) => void }) {
  function update(id: string, value: Partial<SortDraft>) { onChange(sort.map(item => item.id === id ? { ...item, ...value } : item)) }
  function move(index: number, target: number) {
    if (target < 0 || target >= sort.length) return
    const next = [...sort], [item] = next.splice(index, 1)
    next.splice(target, 0, item!)
    onChange(next)
  }
  return <section className={styles.sorting} aria-label="数据库排序规则">
    {sort.map((item, index) => <div className={styles.sortRow} data-enabled={item.enabled} key={item.id} onDragOver={event => { if (!disabled && event.dataTransfer.types.includes("text/x-fouc-sort-id")) event.preventDefault() }} onDrop={event => { const source = sort.findIndex(rule => rule.id === event.dataTransfer.getData("text/x-fouc-sort-id")); if (!disabled && source >= 0) { event.preventDefault(); move(source, index) } }}>
      <QueryRuleHandle id={item.id} kind="sort" index={index} count={sort.length} disabled={disabled} onMove={target => move(index, target)}>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled} onSelect={() => update(item.id, { nulls: "first" })}><span className={styles.menuCheck}>{item.nulls === "first" && <Check size={16} />}</span>NULL 最前</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => update(item.id, { nulls: "last" })}><span className={styles.menuCheck}>{item.nulls === "last" && <Check size={16} />}</span>NULL 最后</DropdownMenuItem>
      </QueryRuleHandle>
      <div className={styles.sortFields}><select aria-label={`排序字段 ${index + 1}`} disabled={disabled || !item.enabled} value={item.column} onChange={event => update(item.id, { column: event.target.value })}><option value="" disabled>选择字段</option>{columns.filter(column => column.name === item.column || !sort.some(rule => rule.column === column.name && rule.enabled)).map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select><select aria-label={`排序方向 ${index + 1}`} disabled={disabled || !item.enabled} value={item.direction} onChange={event => update(item.id, { direction: event.target.value as RelationalSort["direction"] })}><option value="asc">ASC</option><option value="desc">DESC</option></select></div>
      <QueryRuleActions label="排序" disabled={disabled} enabled={item.enabled} onOnly={() => onChange(sort.map(rule => ({ ...rule, enabled: rule.id === item.id })))} onToggle={() => update(item.id, { enabled: !item.enabled })} onRemove={() => onChange(sort.filter(rule => rule.id !== item.id))} />
    </div>)}
  </section>
}
