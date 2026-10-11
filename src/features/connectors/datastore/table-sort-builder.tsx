"use client"

import { Check } from "@phosphor-icons/react"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import type { DatabaseColumnInfo } from "@fouc/shared"
import type { SortDraft } from "./table-sort-model"
import { QueryRuleActions, QueryRuleHandle } from "./table-query-row-actions"
import { TableQuerySelect } from "./table-query-select"
import { useQueryRuleReorder } from "./use-query-rule-reorder"
import styles from "./table-query.module.css"

export function TableSortBuilder({ sort, columns, disabled, onChange }: { sort: SortDraft[]; columns: DatabaseColumnInfo[]; disabled: boolean; onChange: (sort: SortDraft[]) => void }) {
  const { list: listRef, row: rowProps, handle: dragHandle } = useQueryRuleReorder(sort.length, disabled, move)
  function update(id: string, value: Partial<SortDraft>) { onChange(sort.map(item => item.id === id ? { ...item, ...value } : item)) }
  function move(index: number, target: number) {
    if (target < 0 || target >= sort.length) return
    const next = [...sort], [item] = next.splice(index, 1)
    next.splice(target, 0, item!)
    onChange(next)
  }
  return <section ref={listRef} data-query-rule-list className={styles.sorting} aria-label="数据库排序规则">
    {sort.map((item, index) => <div key={item.id} {...rowProps(index)} className={styles.sortRow} data-enabled={item.enabled}>
      <QueryRuleHandle kind="sort" index={index} count={sort.length} disabled={disabled} onMove={target => move(index, target)} drag={dragHandle(index)}>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={disabled} onSelect={() => update(item.id, { nulls: "first" })}><span className={styles.menuCheck}>{item.nulls === "first" && <Check size={16} />}</span>NULL 最前</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => update(item.id, { nulls: "last" })}><span className={styles.menuCheck}>{item.nulls === "last" && <Check size={16} />}</span>NULL 最后</DropdownMenuItem>
      </QueryRuleHandle>
      <div className={styles.sortFields}>
        <TableQuerySelect label={`排序字段 ${index + 1}`} placeholder="选择字段" autoFocus disabled={disabled || !item.enabled} value={item.column} options={columns.filter(column => column.name === item.column || !sort.some(rule => rule.column === column.name && rule.enabled)).map(column => ({ value: column.name, label: column.name }))} onChange={column => update(item.id, { column })} />
        <TableQuerySelect label={`排序方向 ${index + 1}`} disabled={disabled || !item.enabled} value={item.direction} options={[{ value: "asc", label: "ASC" }, { value: "desc", label: "DESC" }]} onChange={direction => update(item.id, { direction })} />
      </div>
      <QueryRuleActions label="排序" disabled={disabled} enabled={item.enabled} onOnly={() => onChange(sort.map(rule => ({ ...rule, enabled: rule.id === item.id })))} onToggle={() => update(item.id, { enabled: !item.enabled })} onRemove={() => onChange(sort.filter(rule => rule.id !== item.id))} />
    </div>)}
  </section>
}
