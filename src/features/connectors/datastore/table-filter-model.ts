import type {
  DatabaseCell,
  DatabaseColumnInfo,
  RelationalFilter,
  RelationalFilterOperator
} from "@fouc/shared"

export const filterLabels: Record<RelationalFilterOperator, string> = {
  equals: "等于",
  "not-equals": "不等于",
  "is-null": "为空",
  "is-not-null": "非空",
  "is-blank": "空白或 NULL",
  "is-not-blank": "非空白",
  like: "包含 (LIKE)",
  "not-like": "不包含 (NOT LIKE)",
  "begins-with": "开头为",
  "ends-with": "结尾为",
  "less-than": "小于",
  "less-than-or-equal": "小于等于",
  "greater-than": "大于",
  "greater-than-or-equal": "大于等于",
  in: "在列表中",
  "not-in": "不在列表中",
  between: "在区间内",
  "not-between": "不在区间内"
}
export type FilterDraft =
  | {
      id: string
      enabled: boolean
      kind: "condition"
      column: string
      operator: RelationalFilterOperator
      value: string
      values: string
      endValue: string
    }
  | { id: string; enabled: boolean; kind: "group"; join: "and" | "or"; children: FilterDraft[] }
export const newCondition = (column: string): FilterDraft => ({
  id: crypto.randomUUID(),
  enabled: true,
  kind: "condition",
  column,
  operator: "equals",
  value: "",
  values: "[]",
  endValue: ""
})
export const newGroup = (children: FilterDraft[] = []): Extract<FilterDraft, { kind: "group" }> => ({
  id: crypto.randomUUID(),
  enabled: true,
  kind: "group",
  join: "and",
  children
})
export const needsFilterValue = (operator: RelationalFilterOperator) =>
  !["is-null", "is-not-null", "is-blank", "is-not-blank"].includes(operator)
const binaryType = /\b(bytea|blob|binary|varbinary)\b/i
const textOperators = ["like", "not-like", "begins-with", "ends-with"]
function displayValue(
  value: DatabaseCell | undefined,
  column: DatabaseColumnInfo | undefined,
  operator: RelationalFilterOperator
): string {
  if (value === undefined) return ""
  if (column && /\bjsonb?\b/i.test(column.dataType) && !textOperators.includes(operator))
    return JSON.stringify(value)
  if (value === null) return ""
  if (typeof value === "object") {
    if (column && binaryType.test(column.dataType) && !Array.isArray(value) && value.type === "binary")
      return String(value.base64 ?? "")
    return JSON.stringify(value)
  }
  return String(value)
}
export function draftFilter(
  filter: RelationalFilter | null,
  columns: DatabaseColumnInfo[]
): Extract<FilterDraft, { kind: "group" }> {
  function draft(node: RelationalFilter): FilterDraft {
    if (node.kind === "group") return { ...newGroup(node.children.map(draft)), join: node.join }
    const column = columns.find((column) => column.name === node.column)
    return {
      id: crypto.randomUUID(),
      enabled: true,
      kind: "condition",
      column: node.column,
      operator:
        node.value === null && (node.operator === "equals" || node.operator === "not-equals")
          ? node.operator === "equals" ? "is-null" : "is-not-null"
          : node.operator,
      value: displayValue(node.value, column, node.operator),
      values: JSON.stringify(node.values ?? []),
      endValue: displayValue(node.endValue, column, node.operator)
    }
  }
  if (!filter) return newGroup()
  const result = draft(filter)
  return result.kind === "group" ? result : newGroup([result])
}
function scalarValue(text: string, column: DatabaseColumnInfo): DatabaseCell {
  if (/\bjsonb?\b/i.test(column.dataType)) {
    try {
      return JSON.parse(text) as DatabaseCell
    } catch {
      throw new Error(`${column.name} 需要有效 JSON`)
    }
  }
  if (binaryType.test(column.dataType)) return { type: "binary", base64: text }
  if (/\bbool(ean)?\b/i.test(column.dataType)) {
    if (text === "true") return true
    if (text === "false") return false
    throw new Error(`${column.name} 请输入 true 或 false`)
  }
  // Preserve integer/decimal text; the driver binds it according to field type.
  return text
}
export function buildFilter(root: FilterDraft, columns: DatabaseColumnInfo[]): RelationalFilter | null {
  function build(node: FilterDraft, depth: number): RelationalFilter | null {
    if (!node.enabled) return null
    if (depth > 6) throw new Error("条件分组最多 6 层")
    if (node.kind === "group") {
      if (!node.children.length) throw new Error("请为分组添加条件，或移除空分组")
      const children = node.children.map((child) => build(child, depth + 1)).filter((child): child is RelationalFilter => child !== null)
      if (!children.length) return null
      return {
        kind: "group",
        join: node.join,
        children
      }
    }
    const column = columns.find((column) => column.name === node.column)
    if (!column) throw new Error("请选择有效字段")
    const result: Extract<RelationalFilter, { kind: "condition" }> = {
      kind: "condition",
      column: node.column,
      operator: node.operator
    }
    if (node.operator === "in" || node.operator === "not-in") {
      let values: unknown
      try {
        values = JSON.parse(node.values)
      } catch {
        throw new Error(`${column.name} 的列表需要 JSON 数组`)
      }
      if (!Array.isArray(values) || !values.length) throw new Error("列表至少需要一个值")
      result.values = values as DatabaseCell[]
    } else if (needsFilterValue(node.operator)) {
      result.value = textOperators.includes(node.operator) ? node.value : scalarValue(node.value, column)
      if (node.operator === "between" || node.operator === "not-between")
        result.endValue = scalarValue(node.endValue, column)
    }
    return result
  }
  return root.kind === "group" && !root.children.length ? null : build(root, 0)
}

export function isolateFilter(root: FilterDraft, id: string): FilterDraft {
  if (root.kind === "condition") return { ...root, enabled: root.id === id }
  const children = root.children.map(child => isolateFilter(child, id))
  return { ...root, enabled: root.id === id || children.some(child => child.enabled), children: root.id === id ? root.children : children }
}
