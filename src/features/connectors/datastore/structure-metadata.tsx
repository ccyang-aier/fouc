"use client"

import type { ReactNode } from "react"
import type { RelationalTableStructure } from "@fouc/shared"
import { ArrowSquareOut, Key } from "@phosphor-icons/react"
import styles from "./table-structure.module.css"

export type StructureTab =
  | "columns"
  | "indexes"
  | "foreignKeys"
  | "constraints"
  | "triggers"
  | "ddl"
const state = (value: boolean | null) => (value === null ? "未知" : value ? "YES" : "NO")
const kinds = {
  primary: "主键",
  unique: "唯一",
  foreign: "外键",
  check: "检查",
  exclusion: "排斥",
  "not-null": "非空"
}
const has = (search: string, ...values: unknown[]) =>
  !search ||
  values.some((value) =>
    JSON.stringify(value)?.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  )

function MetadataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className={styles.grid}>
      <table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
function Definition({ text }: { text: string | null }) {
  return text ? (
    <details className={styles.definition}>
      <summary>查看定义</summary>
      <pre>{text}</pre>
    </details>
  ) : (
    <span className={styles.muted}>见对象 DDL</span>
  )
}
function Empty({ search }: { search: string }) {
  return (
    <p className={styles.empty}>{search ? "没有匹配的结构记录。" : "当前对象没有此类结构记录。"}</p>
  )
}
export function StructureMetadata({
  structure,
  tab,
  search,
  pending,
  onOpenTable
}: {
  structure: RelationalTableStructure
  tab: Exclude<StructureTab, "ddl">
  search: string
  pending: boolean
  onOpenTable: (schema: string, table: string) => void
}) {
  if (tab === "columns") {
    const columns = structure.columns.filter((column) =>
      has(search, column.name, column.dataType, column.comment)
    )
    return (
      <>
        <MetadataTable
          headings={[
            "字段",
            "类型",
            "可为空",
            "主键",
            "唯一",
            "默认值 / 表达式",
            "生成方式",
            "注释"
          ]}
        >
          {columns.map((column) => (
            <tr key={column.name}>
              <td className={styles.name}>
                {column.isPrimaryKey && <Key size={12} />} {column.name}
              </td>
              <td>{column.dataType}</td>
              <td>{state(column.isNullable)}</td>
              <td>{column.isPrimaryKey ? "PK" : "—"}</td>
              <td>{state(column.isUnique)}</td>
              <td>
                <code>{column.columnDefault ?? "—"}</code>
              </td>
              <td>{column.extra || "—"}</td>
              <td>{column.comment || "—"}</td>
            </tr>
          ))}
        </MetadataTable>
        {!columns.length && <Empty search={search} />}
      </>
    )
  }
  if (tab === "indexes") {
    const indexes = structure.indexes.filter((index) =>
      has(search, index.name, index.parts, index.predicate, index.comment)
    )
    return (
      <>
        <MetadataTable
          headings={["索引", "键 / 包含列", "方法", "唯一", "主键", "有效", "可见", "条件 / 定义"]}
        >
          {indexes.map((index) => (
            <tr key={index.name}>
              <td className={styles.name}>
                {index.name}
                <small>{index.comment}</small>
              </td>
              <td>
                {index.parts.map((part) => (
                  <div key={part.position} className={styles.part}>
                    <code>
                      {part.column ??
                        part.expression ??
                        (part.role === "auxiliary" ? "rowid / 辅助键" : "表达式（见 DDL）")}
                    </code>
                    <small>
                      {part.role === "include"
                        ? "INCLUDE"
                        : part.role === "auxiliary"
                          ? "辅助"
                          : part.descending === null
                            ? ""
                            : part.descending
                              ? "DESC"
                              : "ASC"}
                      {part.nulls ? ` · NULLS ${part.nulls.toUpperCase()}` : ""}
                      {part.prefixLength !== null ? ` · 前缀 ${part.prefixLength}` : ""}
                      {part.collation ? ` · ${part.collation}` : ""}
                    </small>
                  </div>
                ))}
              </td>
              <td>{index.method}</td>
              <td>{state(index.unique)}</td>
              <td>{state(index.primary)}</td>
              <td>{state(index.valid)}</td>
              <td>{state(index.visible)}</td>
              <td>
                {index.predicate && <code>{index.predicate}</code>}
                <Definition text={index.definition} />
              </td>
            </tr>
          ))}
        </MetadataTable>
        {!indexes.length && <Empty search={search} />}
      </>
    )
  }
  if (tab === "foreignKeys") {
    const keys = structure.foreignKeys.filter((key) =>
      has(search, key.name, key.columns, key.referencedTable, key.referencedColumns)
    )
    return (
      <>
        <MetadataTable
          headings={[
            "外键",
            "字段映射",
            "引用对象",
            "ON UPDATE",
            "ON DELETE",
            "匹配",
            "延期 / 验证",
            "定义"
          ]}
        >
          {keys.map((key) => (
            <tr key={key.name}>
              <td className={styles.name}>
                {key.name}
                {key.nameSource === "synthetic" && <small>PRAGMA 编号；声明名见 DDL</small>}
              </td>
              <td>
                {key.columns.map((column, index) => (
                  <div className={styles.part} key={column}>
                    {column} <span className={styles.muted}>→</span> {key.referencedColumns[index]}
                  </div>
                ))}
              </td>
              <td>
                <button
                  type="button"
                  className={styles.reference}
                  disabled={pending}
                  aria-label={`打开引用表 ${key.referencedSchema}.${key.referencedTable}`}
                  title={pending ? "先提交或放弃表格变更" : "打开引用表"}
                  onClick={() => onOpenTable(key.referencedSchema, key.referencedTable)}
                >
                  {key.referencedSchema}.{key.referencedTable}
                  <ArrowSquareOut size={12} />
                </button>
              </td>
              <td>{key.onUpdate}</td>
              <td>{key.onDelete}</td>
              <td>{key.match}</td>
              <td>
                可延期 {state(key.deferrable)}
                <small>初始延期 {state(key.initiallyDeferred)}</small>
                <small>已验证 {state(key.validated)}</small>
              </td>
              <td>
                <Definition text={key.definition} />
              </td>
            </tr>
          ))}
        </MetadataTable>
        {!keys.length && <Empty search={search} />}
      </>
    )
  }
  if (tab === "constraints") {
    const constraints = structure.constraints.filter((constraint) =>
      has(search, constraint.name, constraint.columns, constraint.definition)
    )
    return (
      <>
        <MetadataTable headings={["约束", "类型", "字段", "已验证", "可延期", "初始延期", "定义"]}>
          {constraints.map((constraint) => (
            <tr key={constraint.name}>
              <td className={styles.name}>{constraint.name}</td>
              <td>{kinds[constraint.kind]}</td>
              <td>{constraint.columns.join(", ") || "—"}</td>
              <td>{state(constraint.validated)}</td>
              <td>{state(constraint.deferrable)}</td>
              <td>{state(constraint.initiallyDeferred)}</td>
              <td>
                <Definition text={constraint.definition} />
              </td>
            </tr>
          ))}
        </MetadataTable>
        {!constraints.length && <Empty search={search} />}
      </>
    )
  }
  const triggers = structure.triggers.filter((trigger) =>
    has(search, trigger.name, trigger.events, trigger.definition)
  )
  return (
    <>
      <MetadataTable headings={["触发器", "时机", "事件", "粒度", "状态", "定义"]}>
        {triggers.map((trigger) => (
          <tr key={trigger.name}>
            <td className={styles.name}>{trigger.name}</td>
            <td>{trigger.timing}</td>
            <td>{trigger.events.join(" / ") || "见原始 DDL"}</td>
            <td>{trigger.orientation}</td>
            <td>{trigger.enabled ?? "未知"}</td>
            <td>
              <Definition text={trigger.definition} />
            </td>
          </tr>
        ))}
      </MetadataTable>
      {!triggers.length && <Empty search={search} />}
    </>
  )
}
