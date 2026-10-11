import type { DatabaseColumnInfo, RelationalSort } from "@fouc/shared"

export type SortDraft = RelationalSort & { id: string; enabled: boolean }
export const newSort = (column = ""): SortDraft => ({ id: crypto.randomUUID(), enabled: true, column, direction: "asc", nulls: "last" })
export const draftSort = (sort: RelationalSort[]): SortDraft[] => sort.map(item => ({ ...item, id: crypto.randomUUID(), enabled: true }))
export function buildSort(sort: SortDraft[], columns: DatabaseColumnInfo[]): RelationalSort[] {
  const enabled = sort.filter(item => item.enabled)
  if (enabled.length > 8) throw new Error("最多添加 8 个排序字段")
  const selected = new Set<string>()
  return enabled.map(({ column, direction, nulls }) => {
    if (!columns.some(item => item.name === column)) throw new Error("请选择有效排序字段")
    if (selected.has(column)) throw new Error(`${column} 已用于排序`)
    selected.add(column)
    return { column, direction, nulls }
  })
}
