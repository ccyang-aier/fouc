"use client"

import { Eye, EyeSlash, Plus, X } from "@phosphor-icons/react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RELATIONAL_FILTER_OPERATORS, type DatabaseColumnInfo } from "@fouc/shared"
import { filterLabels, needsFilterValue, newCondition, newGroup, type FilterDraft } from "./table-filter-model"
import { QueryRuleActions, QueryRuleHandle } from "./table-query-row-actions"
import { TableQuerySelect } from "./table-query-select"
import { useQueryRuleReorder } from "./use-query-rule-reorder"
import styles from "./table-query.module.css"

function JoinToggle({ join, disabled, label, onChange }: { join: "and" | "or"; disabled: boolean; label: string; onChange: (join: "and" | "or") => void }) {
  const next = join === "and" ? "or" : "and"
  return <button type="button" className={`fouc-action ${styles.joinToggle}`} aria-label={label} title={`切换为 ${next.toUpperCase()}`} disabled={disabled} onClick={() => onChange(next)}>{join.toUpperCase()}</button>
}

type FilterBuilderProps = {
  node: FilterDraft
  columns: DatabaseColumnInfo[]
  disabled: boolean
  onChange: (node: FilterDraft) => void
  onRemove?: () => void
  onOnly: (id: string) => void
  depth?: number
}

function FilterGroupBuilder({ node, columns, disabled, onChange, onRemove, onOnly, depth = 0 }: FilterBuilderProps & { node: Extract<FilterDraft, { kind: "group" }> }) {
  const { list: listRef, row: rowProps, handle: dragHandle } = useQueryRuleReorder(node.children.length, disabled || !node.enabled, move)
  function move(index: number, target: number) {
    if (target < 0 || target >= node.children.length) return
    const children = [...node.children]
    const [item] = children.splice(index, 1)
    children.splice(target, 0, item!)
    onChange({ ...node, children })
  }
  return <section ref={listRef} data-query-rule-list className={depth ? styles.nestedGroup : styles.group} aria-label={depth ? "条件分组" : "筛选条件"}>
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
      <div {...rowProps(index)} className={styles.ruleWrap}>
        <QueryRuleHandle kind="filter" index={index} count={node.children.length} disabled={disabled || !node.enabled} onMove={target => move(index, target)} drag={dragHandle(index)} />
        <TableFilterBuilder node={child} columns={columns} disabled={disabled || !node.enabled} depth={depth + 1} onOnly={onOnly} onChange={updated => onChange({ ...node, children: node.children.map(item => item.id === child.id ? updated : item) })} onRemove={() => onChange({ ...node, children: node.children.filter(item => item.id !== child.id) })} />
      </div>
    </div>)}
  </section>
}

export function TableFilterBuilder(props: FilterBuilderProps) {
  const { node, columns, disabled, onChange, onRemove, onOnly } = props
  if (node.kind === "group") return <FilterGroupBuilder {...props} node={node} />
  const list = node.operator === "in" || node.operator === "not-in"
  const range = node.operator === "between" || node.operator === "not-between"
  const fieldsDisabled = disabled || !node.enabled
  return <div className={styles.rule} data-enabled={node.enabled}>
    <div className={styles.ruleFields}>
      <TableQuerySelect label="筛选字段" placeholder="字段" autoFocus disabled={fieldsDisabled} value={node.column} options={columns.map(column => ({ value: column.name, label: column.name }))} onChange={column => onChange({ ...node, column })} />
      <TableQuerySelect label="筛选操作符" disabled={fieldsDisabled} value={node.operator} options={RELATIONAL_FILTER_OPERATORS.map(operator => ({ value: operator, label: filterLabels[operator] }))} onChange={operator => onChange({ ...node, operator })} />
      {needsFilterValue(node.operator) ? list ? <input aria-label="筛选值列表" disabled={fieldsDisabled} value={node.values} placeholder={'JSON 数组：["a", "b", null]'} onChange={event => onChange({ ...node, values: event.target.value })} /> : <input aria-label="筛选值" disabled={fieldsDisabled} value={node.value} placeholder="值" onChange={event => onChange({ ...node, value: event.target.value })} /> : <span className={styles.noValue}>无需值</span>}
      {range && <input aria-label="区间结束值" disabled={fieldsDisabled} value={node.endValue} placeholder="区间结束" onChange={event => onChange({ ...node, endValue: event.target.value })} />}
    </div>
    <QueryRuleActions label="筛选条件" disabled={disabled} enabled={node.enabled} onOnly={() => onOnly(node.id)} onToggle={() => onChange({ ...node, enabled: !node.enabled })} onRemove={onRemove} />
  </div>
}
