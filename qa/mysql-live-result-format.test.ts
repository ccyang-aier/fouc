import { describe, expect, test } from "bun:test"
import type { DatabaseQueryResult } from "@fouc/shared"

import { chartableColumns, chartNumber, columnLabel, formatDelimited, formatJson } from "../src/features/connectors/mysql/workbench/mysql-live-result-format"

const result: DatabaseQueryResult = {
  columns: ["name", "amount", "name"], columnTypes: ["text", "int", "text"], columnSortables: [true, true, true],
  rows: [["a,\"b", 12, null], ["line\nbreak", "15", "x\ty"]], affectedRows: 0, executionTimeMs: 8,
  truncated: false, sessionId: null, hasMore: false, messages: [],
}

describe("DBX-compatible query result formatting", () => {
  test("CSV quotes headers and values, preserving null as an empty field", () => {
    expect(formatDelimited(result, ",")).toBe('"name","amount","name"\n"a,""b","12",\n"line\nbreak","15","x\ty"')
  })

  test("TSV quotes only values that need escaping", () => {
    expect(formatDelimited(result, "\t")).toBe('name\tamount\tname\n"a,""b"\t12\t\n"line\nbreak"\t15\t"x\ty"')
  })

  test("JSON preserves duplicate column names and native cell types", () => {
    expect(JSON.parse(formatJson(result))).toEqual({ columns: result.columns, rows: result.rows })
    expect(columnLabel(result.columns, 2)).toBe("name #3")
  })

  test("charts accept finite numeric strings and reject empty or nonfinite cells", () => {
    expect(chartableColumns(result)).toEqual([1])
    expect(chartNumber(" 15 ")).toBe(15)
    expect(chartNumber("Infinity")).toBeNull()
    expect(chartNumber("")).toBeNull()
  })
})
