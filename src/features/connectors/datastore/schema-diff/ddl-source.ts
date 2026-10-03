import { tokenizeSqlSemantic, type DatabaseColumnInfo, type RelationalProvider, type SqlSemanticToken } from '@fouc/shared'

export interface TableDdlParts {
  sql: string
  nameStart: number
  nameEnd: number
  bodyStart: number
  bodyEnd: number
  end: number
  columns: Map<string, string>
  clauses: string[]
  suffix: string
}
export function normalizeSchemaSql(sql: string | null | undefined, provider: RelationalProvider): string {
  if (!sql) return ''
  // Keep quoted identifiers and literal bytes intact; only syntax whitespace/case is normalized.
  return tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment')
    .map((token) => token.kind === 'word' ? token.text.toLowerCase() : token.text).join('\u0001')
}
function identifier(token: SqlSemanticToken | undefined): string | null {
  if (!token || token.kind !== 'word' && token.kind !== 'quoted_identifier') return null
  if (token.kind === 'word') return token.text
  const open = token.text[0], close = open === '[' ? ']' : open
  return token.text.slice(1, -1).replaceAll(close + close, close)
}

/** DBX's native CREATE header/body parsing, using Fouc's SQL quote/comment lexer. */
export function parseTableDdl(sql: string, provider: RelationalProvider): TableDdlParts | null {
  if (sql.length > 1_000_000) return null
  const tokens = tokenizeSqlSemantic(sql, provider).filter((token) => token.kind !== 'comment')
  if (tokens[0]?.text.toUpperCase() !== 'CREATE') return null
  const tableKeyword = tokens.findIndex((token, index) => index < 5 && token.kind === 'word' && token.text.toUpperCase() === 'TABLE')
  if (tableKeyword < 0) return null
  let nameIndex = tableKeyword + 1
  if (tokens[nameIndex]?.text.toUpperCase() === 'IF') nameIndex += 3
  if (identifier(tokens[nameIndex]) === null) return null
  const nameStart = tokens[nameIndex].span.start
  let nameEnd = tokens[nameIndex].span.end
  if (tokens[nameIndex + 1]?.text === '.') {
    if (identifier(tokens[nameIndex + 2]) === null) return null
    nameEnd = tokens[nameIndex + 2].span.end
    nameIndex += 2
  }
  const opening = nameIndex + 1
  if (tokens[opening]?.text !== '(') return null
  const columns = new Map<string, string>(), clauses: string[] = []
  let depth = 0, start = tokens[opening].span.end, close = -1, closeIndex = -1
  const addClause = (end: number) => {
    const clause = sql.slice(start, end).trim()
    if (!clause) return
    const first = tokenizeSqlSemantic(clause, provider).find((token) => token.kind !== 'comment')
    const name = identifier(first)
    if (name && (first?.kind === 'quoted_identifier' || !/^(?:CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|KEY|INDEX|FULLTEXT|SPATIAL)$/i.test(name))) columns.set(name, clause)
    else clauses.push(clause)
  }
  for (let index = opening; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.kind !== 'punctuation') continue
    if (token.text === '(') depth++
    else if (token.text === ')') {
      depth--
      if (depth === 0) { addClause(token.span.start); close = token.span.start; closeIndex = index; break }
    } else if (token.text === ',' && depth === 1) { addClause(token.span.start); start = token.span.end }
  }
  if (close < 0) return null
  const semicolon = tokens.slice(closeIndex + 1).find((token) => token.text === ';')
  const end = semicolon?.span.end ?? sql.length
  return { sql, nameStart, nameEnd, bodyStart: tokens[opening].span.end, bodyEnd: close,
    end, columns, clauses, suffix: sql.slice(tokens[closeIndex].span.end, semicolon?.span.start ?? sql.length).trim() }
}

export function generatedColumn(column: DatabaseColumnInfo, native: string | null): boolean {
  if (/generated/i.test(column.extra ?? '') && !/^default_generated$/i.test(column.extra ?? '')) return true
  if (!native) return false
  const tokens = tokenizeSqlSemantic(native)
  return tokens.some((token, index) => index > 0 && token.kind === 'word' && token.text.toUpperCase() === 'AS' && tokens[index + 1]?.text === '(')
}
export function generationSignature(column: DatabaseColumnInfo, native: string | null, provider: RelationalProvider): string {
  if (!generatedColumn(column, native)) return ''
  if (native) {
    const tokens = tokenizeSqlSemantic(native, provider)
    const marker = tokens.find((token) => token.kind === 'word' && /^(?:GENERATED|AS)$/i.test(token.text))
    if (marker) return normalizeSchemaSql(native.slice(marker.span.start), provider)
  }
  return normalizeSchemaSql(column.columnDefault, provider) + ':' + (column.extra ?? '')
}
