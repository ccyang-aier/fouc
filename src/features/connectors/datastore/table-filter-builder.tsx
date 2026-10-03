"use client"

import { Plus, Trash, ArrowsDownUp } from "@phosphor-icons/react"
import {
  RELATIONAL_FILTER_OPERATORS,
  type DatabaseColumnInfo,
  type RelationalFilterOperator
} from "@fouc/shared"
import {
  filterLabels,
  needsFilterValue,
  newCondition,
  newGroup,
  type FilterDraft
} from "./table-filter-model"
import styles from "./table-query.module.css"

export function TableFilterBuilder({
  node,
  columns,
  disabled,
  onChange,
  onRemove,
  depth = 0
}: {
  node: FilterDraft
  columns: DatabaseColumnInfo[]
  disabled: boolean
  onChange: (node: FilterDraft) => void
  onRemove?: () => void
  depth?: number
}) {
  if (node.kind === "group") {
    function move(index: number, direction: number) {
      if (node.kind !== "group") return
      const children = [...node.children]
      const next = index + direction
      ;[children[index], children[next]] = [children[next]!, children[index]!]
      onChange({ ...node, children })
    }
    return (
      <section className={styles.group} aria-label={depth ? "条件分组" : "筛选条件"}>
        <header>
          <select
            aria-label="条件关系"
            value={node.join}
            disabled={disabled}
            onChange={(event) => onChange({ ...node, join: event.target.value as "and" | "or" })}
          >
            <option value="and">全部满足 · AND</option>
            <option value="or">任一满足 · OR</option>
          </select>
          <span />
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({ ...node, children: [...node.children, newCondition(columns[0]?.name ?? "")] })
            }
          >
            <Plus size={13} />
            添加条件
          </button>
          <button
            type="button"
            disabled={disabled || depth >= 5}
            onClick={() =>
              onChange({
                ...node,
                children: [...node.children, newGroup([newCondition(columns[0]?.name ?? "")])]
              })
            }
          >
            <Plus size={13} />
            添加分组
          </button>
          {onRemove && (
            <button type="button" disabled={disabled} aria-label="移除条件分组" onClick={onRemove}>
              <Trash size={13} />
            </button>
          )}
        </header>
        {!node.children.length && <p>暂无筛选条件，显示整个表的分页结果。</p>}
        {node.children.map((child, index) => (
          <div className={styles.ruleWrap} key={child.id}>
            <TableFilterBuilder
              node={child}
              columns={columns}
              disabled={disabled}
              depth={depth + 1}
              onChange={(updated) =>
                onChange({
                  ...node,
                  children: node.children.map((item) => (item.id === child.id ? updated : item))
                })
              }
              onRemove={() =>
                onChange({ ...node, children: node.children.filter((item) => item.id !== child.id) })
              }
            />
            <div className={styles.move}>
              <button
                type="button"
                aria-label={`上移条件 ${index + 1}`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowsDownUp size={11} />↑
              </button>
              <button
                type="button"
                aria-label={`下移条件 ${index + 1}`}
                disabled={disabled || index === node.children.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </section>
    )
  }
  const list = node.operator === "in" || node.operator === "not-in"
  const range = node.operator === "between" || node.operator === "not-between"
  return (
    <div className={styles.rule}>
      <select
        aria-label="筛选字段"
        disabled={disabled}
        value={node.column}
        onChange={(event) => onChange({ ...node, column: event.target.value })}
      >
        {columns.map((column) => (
          <option key={column.name} value={column.name}>
            {column.name}
          </option>
        ))}
      </select>
      <select
        aria-label="筛选操作符"
        disabled={disabled}
        value={node.operator}
        onChange={(event) => onChange({ ...node, operator: event.target.value as RelationalFilterOperator })}
      >
        {RELATIONAL_FILTER_OPERATORS.map((operator) => (
          <option key={operator} value={operator}>
            {filterLabels[operator]}
          </option>
        ))}
      </select>
      {needsFilterValue(node.operator) &&
        (list ? (
          <textarea
            aria-label="筛选值列表"
            disabled={disabled}
            rows={2}
            value={node.values}
            placeholder={'JSON 数组： ["a", "b", null]'}
            onChange={(event) => onChange({ ...node, values: event.target.value })}
          />
        ) : (
          <input
            aria-label="筛选值"
            disabled={disabled}
            value={node.value}
            placeholder="值"
            onChange={(event) => onChange({ ...node, value: event.target.value })}
          />
        ))}
      {range && (
        <input
          aria-label="区间结束值"
          disabled={disabled}
          value={node.endValue}
          placeholder="区间结束"
          onChange={(event) => onChange({ ...node, endValue: event.target.value })}
        />
      )}
      <button type="button" disabled={disabled} aria-label="移除筛选条件" onClick={onRemove}>
        <Trash size={14} />
      </button>
    </div>
  )
}
