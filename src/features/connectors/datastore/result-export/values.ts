import type { DatabaseCell, RelationalProvider } from '@fouc/shared'
import { textPieces } from './writer'

// Native driver metadata, not numeric coercion of arbitrary text cells.
const postgresNumeric = new Set([20, 21, 23, 26, 700, 701, 1700])
const mysqlNumeric = new Set([0, 1, 2, 3, 4, 5, 8, 9, 13, 246])
const numericNames = /^(?:tinyint|smallint|mediumint|int|integer|bigint|int2|int4|int8|serial|bigserial|smallserial|decimal|numeric|dec|fixed|number|float|float4|float8|double|real|newdecimal|longlong|long|short|tiny|int24|year|oid)(?:\b|\()/i
const numericLiteral = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
const jsonNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

export function numericExportType(provider: RelationalProvider, type = ''): boolean {
  if (provider === 'postgres' && /^oid:\d+$/.test(type)) return postgresNumeric.has(Number(type.slice(4)))
  if (provider === 'mysql' && /^\d+$/.test(type)) return mysqlNumeric.has(Number(type))
  return numericNames.test(type.trim()) && !/\[\]$/.test(type)
}

export function isBinaryCell(cell: DatabaseCell): cell is { type: 'binary'; base64: string } {
  return cell !== null && typeof cell === 'object' && !Array.isArray(cell) && cell.type === 'binary' && typeof cell.base64 === 'string'
}

function* binaryHex(base64: string): Generator<string> {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('二进制单元格的 Base64 数据无效。')
  for (let index = 0; index < base64.length; index += 16_384) {
    const raw = atob(base64.slice(index, index + 16_384))
    let hex = ''
    for (let byte = 0; byte < raw.length; byte++) hex += raw.charCodeAt(byte).toString(16).padStart(2, '0')
    yield hex
  }
}

function checkedNumber(value: number) {
  if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('结果包含无法精确表示的 JavaScript 数值；请让驱动返回原始数字文本。')
  return String(value)
}

export function* jsonString(value: string): Generator<string> {
  yield '"'
  for (const piece of textPieces(value)) yield JSON.stringify(piece).slice(1, -1)
  yield '"'
}

/** Numbers already delivered as decimal text stay decimal text, never pass Number(). */
export function* jsonCell(value: DatabaseCell, provider: RelationalProvider, type = '', depth = 0): Generator<string> {
  if (depth > 20) throw new Error('单元格嵌套超过 20 层。')
  if (value === null) yield 'null'
  else if (typeof value === 'number') yield checkedNumber(value)
  else if (typeof value === 'boolean') yield value ? 'true' : 'false'
  else if (typeof value === 'string') {
    if (numericExportType(provider, type) && jsonNumber.test(value)) yield* textPieces(value)
    else yield* jsonString(value)
  } else if (Array.isArray(value)) {
    yield '['
    for (let index = 0; index < value.length; index++) {
      if (index) yield ','
      yield* jsonCell(value[index], provider, '', depth + 1)
    }
    yield ']'
  } else {
    yield '{'
    let first = true
    for (const [key, entry] of Object.entries(value)) {
      if (!first) yield ','
      first = false
      yield* jsonString(key)
      yield ':'
      yield* jsonCell(entry, provider, '', depth + 1)
    }
    yield '}'
  }
}

export function* textCell(value: DatabaseCell, provider: RelationalProvider, binaryFormat: 'hex' | 'base64'): Generator<string> {
  if (value === null) return
  if (typeof value === 'string') yield* textPieces(value)
  else if (typeof value === 'number') yield checkedNumber(value)
  else if (typeof value === 'boolean') yield value ? 'true' : 'false'
  else if (isBinaryCell(value)) {
    if (binaryFormat === 'base64') { yield 'base64:'; yield* textPieces(value.base64) }
    else { yield '0x'; yield* binaryHex(value.base64) }
  } else yield* jsonCell(value, provider)
}

export function quoteExportIdentifier(value: string, provider: RelationalProvider): string {
  if (!value || value.includes('\0')) throw new Error('SQL 标识符不能是空值或含空字符。')
  const quote = provider === 'mysql' ? '`' : '"'
  return quote + value.replaceAll(quote, quote + quote) + quote
}

function* utf8Hex(value: string): Generator<string> {
  const encoder = new TextEncoder()
  for (const piece of textPieces(value)) {
    let hex = ''
    for (const byte of encoder.encode(piece)) hex += byte.toString(16).padStart(2, '0')
    yield hex
  }
}

function* sqlString(value: string, provider: RelationalProvider): Generator<string> {
  if (provider === 'postgres' && value.includes('\0')) throw new Error('PostgreSQL text 不支持空字符；请导出二进制列或使用其他格式。')
  // MySQL binary-to-text avoids dependence on NO_BACKSLASH_ESCAPES.
  // SQLite's SQL parser cannot carry NUL inside a quoted literal.
  if (provider === 'mysql' && /[\\\u0000-\u001f]/.test(value) || provider === 'sqlite' && value.includes('\0')) {
    yield provider === 'mysql' ? "CONVERT(X'" : "CAST(X'"
    yield* utf8Hex(value)
    yield provider === 'mysql' ? "' USING utf8mb4)" : "' AS TEXT)"
    return
  }
  yield provider === 'postgres' ? "E'" : "'"
  for (const piece of textPieces(value)) yield provider === 'postgres' ? piece.replaceAll('\\', '\\\\').replaceAll("'", "''") : piece.replaceAll("'", "''")
  yield "'"
}

const postgresArrays = new Map<number, [string, string]>([
  [1000, ['bool', 'bool']], [1001, ['bytea', 'bytea']], [1005, ['int2', 'int2']], [1007, ['int4', 'int4']],
  [1009, ['text', 'text']], [1014, ['bpchar', 'bpchar']], [1015, ['varchar', 'varchar']], [1016, ['int8', 'int8']],
  [1021, ['float4', 'float4']], [1022, ['float8', 'float8']], [1028, ['oid', 'oid']], [1115, ['timestamp', 'timestamp']],
  [1182, ['date', 'date']], [1185, ['timestamptz', 'timestamptz']], [1231, ['numeric', 'numeric']], [2951, ['uuid', 'uuid']],
])

function postgresArrayType(type: string): [string, string] | undefined {
  if (/^oid:\d+$/.test(type)) return postgresArrays.get(Number(type.slice(4)))
  const scalar = type.trim().replace(/\[\]$/, '')
  if (!/\[\]$/.test(type)) return undefined
  const safe = new Set(['bool', 'boolean', 'bytea', 'int2', 'int4', 'int8', 'integer', 'bigint', 'smallint', 'float4', 'float8', 'real', 'numeric', 'decimal', 'text', 'varchar', 'bpchar', 'date', 'timestamp', 'timestamptz', 'uuid'])
  return safe.has(scalar) ? [scalar, scalar] : undefined
}

function postgresJsonCast(type: string): string {
  return type === 'oid:3802' || type.toLowerCase() === 'jsonb' ? '::jsonb' : type === 'oid:114' || type.toLowerCase() === 'json' ? '::json' : ''
}

function* sqlArray(values: DatabaseCell[], scalarType: string, depth: number): Generator<string> {
  if (depth > 20) throw new Error('数组单元格嵌套超过 20 层。')
  yield '['
  for (let index = 0; index < values.length; index++) {
    if (index) yield ', '
    if (Array.isArray(values[index])) yield* sqlArray(values[index] as DatabaseCell[], scalarType, depth + 1)
    else yield* sqlCell(values[index], 'postgres', scalarType, depth + 1)
  }
  yield ']'
}

/** Native DBX INSERT literals adapted to Fouc's public cells and actual driver type codes. */
export function* sqlCell(value: DatabaseCell, provider: RelationalProvider, type = '', depth = 0): Generator<string> {
  if (value === null) yield 'NULL'
  else if (typeof value === 'number') yield checkedNumber(value)
  else if (typeof value === 'boolean') yield value ? 'TRUE' : 'FALSE'
  else if (isBinaryCell(value)) {
    yield provider === 'postgres' ? "pg_catalog.decode('" : "X'"
    yield* binaryHex(value.base64)
    yield provider === 'postgres' ? "', 'hex')" : "'"
  } else if (typeof value === 'string') {
    if (numericExportType(provider, type) && numericLiteral.test(value)) yield* textPieces(value)
    else { yield* sqlString(value, provider); if (provider === 'postgres') yield postgresJsonCast(type) }
  } else if (Array.isArray(value) && provider === 'postgres' && postgresArrayType(type)) {
    const [scalar, cast] = postgresArrayType(type)!
    yield 'ARRAY'
    yield* sqlArray(value, scalar, depth + 1)
    yield `::${cast}[]`
  } else {
    // JSON native cells are quoted as unknown/string literals for assignment to JSON columns.
    if (provider === 'mysql') {
      yield "CONVERT(X'"
      for (const piece of jsonCell(value, provider, '', depth)) yield* utf8Hex(piece)
      yield "' USING utf8mb4)"
      return
    }
    yield provider === 'postgres' ? "E'" : "'"
    for (const piece of jsonCell(value, provider, '', depth)) {
      yield provider === 'sqlite' ? piece.replaceAll("'", "''") : piece.replaceAll('\\', '\\\\').replaceAll("'", "''")
    }
    yield "'"
    if (provider === 'postgres') yield postgresJsonCast(type)
  }
}
