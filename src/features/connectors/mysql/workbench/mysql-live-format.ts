import type { DatabaseCell } from "@fouc/shared"

export function databaseCellText(value: DatabaseCell): string {
  if (value === null) return "NULL"
  if (typeof value === "object") return !Array.isArray(value) && value.type === "binary" ? "[二进制数据]" : JSON.stringify(value)
  return String(value)
}
