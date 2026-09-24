import type { DatabaseCell, DatabaseQueryResult } from "@fouc/shared"

// Adapted from DBX chartData.ts, csvQuoteMode.ts and exportFormats.ts.
export function chartNumber(value: DatabaseCell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || value.trim() === "") return null
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function chartableColumns(result: DatabaseQueryResult): number[] {
  return result.columns.map((_, index) => index).filter((index) => result.rows.some((row) => chartNumber(row[index]) !== null))
}

export function columnLabel(columns: string[], index: number): string {
  const name = columns[index] ?? `#${index + 1}`
  return columns.filter((column) => column === name).length > 1 ? `${name} #${index + 1}` : name
}

function exportCell(value: DatabaseCell | undefined): string {
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

function quoted(value: string, separator: "," | "\t"): string {
  if (separator === "," || value.includes(separator) || /["\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function formatDelimited(result: DatabaseQueryResult, separator: "," | "\t"): string {
  const line = (cells: string[]) => cells.map((cell) => quoted(cell, separator)).join(separator)
  const dataLine = (row: DatabaseCell[]) => result.columns.map((_, index) => row[index] == null ? "" : quoted(exportCell(row[index]), separator)).join(separator)
  return [line(result.columns), ...result.rows.map(dataLine)].join("\n")
}

export function formatJson(result: DatabaseQueryResult): string {
  // Preserve duplicate column names and column order, which object-shaped rows cannot represent.
  return JSON.stringify({ columns: result.columns, rows: result.rows }, null, 2)
}
