/**
 * The MySQL read-query subset of DBX's sqlStatementRanges scanner. Offsets refer
 * to the original document so editor selection and cursor execution agree.
 * The server independently validates every extracted statement before execution.
 */
export type MysqlQueryRange = { from: number; to: number; sql: string }

export function mysqlQueryRanges(source: string): MysqlQueryRange[] {
  const ranges: MysqlQueryRange[] = []
  let start = 0
  let hasCode = false
  let state: "normal" | "single" | "double" | "backtick" | "line" | "block" = "normal"

  function flush(end: number) {
    if (hasCode) {
      let from = start
      while (from < end && /\s/.test(source[from]!)) from++
      let to = end
      while (to > from && /\s/.test(source[to - 1]!)) to--
      ranges.push({ from, to, sql: source.slice(from, to) })
    }
    start = end + 1
    hasCode = false
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    const next = source[index + 1]
    if (state === "line") {
      if (char === "\n") state = "normal"
      continue
    }
    if (state === "block") {
      if (char === "*" && next === "/") { index++; state = "normal" }
      continue
    }
    if (state === "single" || state === "double" || state === "backtick") {
      if (char === "\\" && next) { index++; continue }
      const quote = state === "single" ? "'" : state === "double" ? '"' : "`"
      if (char === quote) {
        if (next === quote) index++
        else state = "normal"
      }
      continue
    }
    if (char === "-" && next === "-") { index++; state = "line"; continue }
    if (char === "#") { state = "line"; continue }
    if (char === "/" && next === "*") { index++; state = "block"; continue }
    if (char === "'") { state = "single"; hasCode = true; continue }
    if (char === '"') { state = "double"; hasCode = true; continue }
    if (char === "`") { state = "backtick"; hasCode = true; continue }
    if (char === ";") { flush(index); continue }
    if (!/\s/.test(char)) hasCode = true
  }
  flush(source.length)
  return ranges
}

export function mysqlQueryAtCursor(source: string, cursor: number): MysqlQueryRange | null {
  const ranges = mysqlQueryRanges(source)
  if (!ranges.length) return null
  return ranges.find((range) => cursor >= range.from && cursor <= range.to)
    ?? ranges.find((range) => cursor < range.from)
    ?? ranges.at(-1)!
}
