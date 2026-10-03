"use client"

import { Plus, Trash, ArrowUp, ArrowDown } from "@phosphor-icons/react"
import type { DatabaseColumnInfo, RelationalSort } from "@fouc/shared"
import styles from "./table-query.module.css"

export function TableSortBuilder({
  sort,
  columns,
  disabled,
  onChange
}: {
  sort: RelationalSort[]
  columns: DatabaseColumnInfo[]
  disabled: boolean
  onChange: (sort: RelationalSort[]) => void
}) {
  function update(index: number, value: Partial<RelationalSort>) {
    onChange(sort.map((item, position) => (position === index ? { ...item, ...value } : item)))
  }
  function move(index: number, direction: number) {
    const next = [...sort]
    const target = index + direction
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }
  return (
    <section className={styles.sorting} aria-label="数据库排序规则">
      <p>按优先级执行 ORDER BY。主键会作为最后的稳定分页依据自动补齐。</p>
      {sort.map((item, index) => (
        <div className={styles.sortRow} key={index}>
          <b>{index + 1}</b>
          <select
            aria-label={`排序字段 ${index + 1}`}
            disabled={disabled}
            value={item.column}
            onChange={(event) => update(index, { column: event.target.value })}
          >
            {columns
              .filter(
                (column) => column.name === item.column || !sort.some((rule) => rule.column === column.name)
              )
              .map((column) => (
                <option key={column.name}>{column.name}</option>
              ))}
          </select>
          <select
            aria-label={`排序方向 ${index + 1}`}
            disabled={disabled}
            value={item.direction}
            onChange={(event) =>
              update(index, { direction: event.target.value as RelationalSort["direction"] })
            }
          >
            <option value="asc">升序 ASC</option>
            <option value="desc">降序 DESC</option>
          </select>
          <select
            aria-label={`空值位置 ${index + 1}`}
            disabled={disabled}
            value={item.nulls}
            onChange={(event) => update(index, { nulls: event.target.value as RelationalSort["nulls"] })}
          >
            <option value="last">NULL 最后</option>
            <option value="first">NULL 最前</option>
          </select>
          <button
            type="button"
            disabled={disabled || index === 0}
            aria-label={`上移排序 ${index + 1}`}
            onClick={() => move(index, -1)}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            disabled={disabled || index === sort.length - 1}
            aria-label={`下移排序 ${index + 1}`}
            onClick={() => move(index, 1)}
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label={`移除排序 ${index + 1}`}
            onClick={() => onChange(sort.filter((_, position) => position !== index))}
          >
            <Trash size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addSort}
        disabled={disabled || sort.length >= 8 || sort.length >= columns.length}
        onClick={() =>
          onChange([
            ...sort,
            {
              column: columns.find((column) => !sort.some((rule) => rule.column === column.name))!.name,
              direction: "asc",
              nulls: "last"
            }
          ])
        }
      >
        <Plus size={13} />
        添加排序字段
      </button>
    </section>
  )
}
