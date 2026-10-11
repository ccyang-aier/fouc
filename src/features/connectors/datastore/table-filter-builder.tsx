"use client"

import { Eye, EyeSlash, Plus, X } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RELATIONAL_FILTER_OPERATORS, type DatabaseColumnInfo, type RelationalFilterOperator } from "@fouc/shared"
import { filterLabels, needsFilterValue, newCondition, newGroup, type FilterDraft } from "./table-filter-model"
import { QueryRuleActions, QueryRuleHandle } from "./table-query-row-actions"
import styles from "./table-query.module.css"

function JoinToggle({ join, disabled, label, onChange }: { join: "and" | "or"; disabled: boolean; label: string; onChange: (join: "and" | "or") => void }) {
  const next = join === "and" ? "or" : "and"
  return <button type="button" className={`fouc-action ${styles.joinToggle}`} aria-label={label} title={`切换为 ${next.toUpperCase()}`} disabled={disabled} onClick={() => onChange(next)}>{join.toUpperCase()}</button>
}

export function TableFilterBuilder({ node, columns, disabled, onChange, onRemove, onOnly, depth = 0 }: {
  node: FilterDraft
  columns: DatabaseColumnInfo[]
  disabled: boolean
  onChange: (node: FilterDraft) => void
  onRemove?: () => void
  onOnly: (id: string) => void
  depth?: number
}) {
  if (node.kind === "group") {
    function move(index: number, target: number) {
      if (node.kind !== "group" || target < 0 || target >= node.children.length) return
      const children = [...node.children]
      const [item] = children.splice(index, 1)
      children.splice(target, 0, item!)
      onChange({ ...node, children })
    }
    return <section className={depth ? styles.nestedGroup : styles.group} aria-label={depth ? "条件分组" : "筛选条件"}>
      {depth > 0 && <header className={styles.groupHeader}>
        <span>分组</span>
        <JoinToggle join={node.join} label="分组条件关系" disabled={disabled || !node.enabled} onChange={join => onChange({ ...node, join })} />
        <span className={styles.spacer} />
        <DropdownMenu><DropdownMenuTrigger asChild><button className="fouc-action" type="button" title="新增组内条件" aria-label="新增组内条件" disabled={disabled || !node.enabled}><Plus size={16} /></button></DropdownMenuTrigger><DropdownMenuContent className={styles.popoverMenu} data-table-query-menu="" density="compact" align="end">
          <DropdownMenuItem disabled={disabled || !node.enabled} onSelect={() => onChange({ ...node, children: [...node.children, newCondition("")] })}><Plus />新增条件</DropdownMenuItem>
          <DropdownMenuItem disabled={disabled || !node.enabled || depth >= 5} onSelect={() => onChange({ ...node, children: [...node.children, newGroup([newCondition("")])] })}><Plus />新增条件分组</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
        <button className="fouc-action" type="button" title={node.enabled ? "禁用分组" : "启用分组"} aria-label={node.enabled ? "禁用分组" : "启用分组"} aria-pressed={!node.enabled} disabled={disabled} onClick={() => onChange({ ...node, enabled: !node.enabled })}>{node.enabled ? <Eye size={16} weight="bold" /> : <EyeSlash size={16} weight="bold" />}</button>
        <button className="fouc-action" data-variant="destructive" type="button" title="删除分组" aria-label="删除分组" disabled={disabled} onClick={onRemove}><X size={16} /></button>
      </header>}
      {node.children.map((child, index) => <div key={child.id}>
        {index > 0 && <div className={styles.join}><JoinToggle join={node.join} label={`条件关系 ${index}`} disabled={disabled || !node.enabled} onChange={join => onChange({ ...node, join })} /></div>}
        <div className={styles.ruleWrap} onDragOver={event => { if (!disabled && event.dataTransfer.types.includes("text/x-fouc-filter-id")) event.preventDefault() }} onDrop={event => { const source = node.children.findIndex(item => item.id === event.dataTransfer.getData("text/x-fouc-filter-id")); if (!disabled && source >= 0) { event.preventDefault(); move(source, index) } }}>
          <QueryRuleHandle id={child.id} kind="filter" index={index} count={node.children.length} disabled={disabled || !node.enabled} onMove={target => move(index, target)} />
          <TableFilterBuilder node={child} columns={columns} disabled={disabled || !node.enabled} depth={depth + 1} onOnly={onOnly} onChange={updated => onChange({ ...node, children: node.children.map(item => item.id === child.id ? updated : item) })} onRemove={() => onChange({ ...node, children: node.children.filter(item => item.id !== child.id) })} />
        </div>
      </div>)}
    </section>
  }
  const list = node.operator === "in" || node.operator === "not-in"
  const range = node.operator === "between" || node.operator === "not-between"
  const fieldsDisabled = disabled || !node.enabled
  return <div className={styles.rule} data-enabled={node.enabled}>
    <div className={styles.ruleFields}>
      <select aria-label="筛选字段" disabled={fieldsDisabled} value={node.column} onChange={event => onChange({ ...node, column: event.target.value })}><option value="" disabled>字段</option>{columns.map(column => <option key={column.name} value={column.name}>{column.name}</option>)}</select>
      <select aria-label="筛选操作符" disabled={fieldsDisabled} value={node.operator} onChange={event => onChange({ ...node, operator: event.target.value as RelationalFilterOperator })}>{RELATIONAL_FILTER_OPERATORS.map(operator => <option key={operator} value={operator}>{filterLabels[operator]}</option>)}</select>
      {needsFilterValue(node.operator) ? list ? <input aria-label="筛选值列表" disabled={fieldsDisabled} value={node.values} placeholder={'JSON 数组：["a", "b", null]'} onChange={event => onChange({ ...node, values: event.target.value })} /> : <input aria-label="筛选值" disabled={fieldsDisabled} value={node.value} placeholder="值" onChange={event => onChange({ ...node, value: event.target.value })} /> : <span className={styles.noValue}>无需值</span>}
      {range && <input aria-label="区间结束值" disabled={fieldsDisabled} value={node.endValue} placeholder="区间结束" onChange={event => onChange({ ...node, endValue: event.target.value })} />}
    </div>
    <QueryRuleActions label="筛选条件" disabled={disabled} enabled={node.enabled} onOnly={() => onOnly(node.id)} onToggle={() => onChange({ ...node, enabled: !node.enabled })} onRemove={onRemove} />
  </div>
}
