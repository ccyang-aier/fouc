/** Native DBX cell coercion subset, keeping exact numeric text and explicit NULL/empty values. */
import { formatJsonSource, type DatabaseCell, type DatabaseColumnInfo, type RelationalProvider } from '@fouc/shared'

const numeric = /\b(?:int|integer|smallint|bigint|tinyint|mediumint|int2|int4|int8|serial|bigserial|smallserial|decimal|numeric|dec|real|float|double|money|smallmoney)\b/i
export function gridGeneratedColumn(column: DatabaseColumnInfo): boolean { return /\b(?:generated|identity)\b/i.test(column.extra ?? '') }
export function gridCellEditorText(value: DatabaseCell, column?: DatabaseColumnInfo): string { return value === null ? '' : /\bjsonb?\b/i.test(column?.dataType ?? '') ? JSON.stringify(value, null, 2) : typeof value === 'object' ? !Array.isArray(value) && value.type === 'binary' ? String(value.base64) : JSON.stringify(value, null, 2) : String(value) }
/** Refuse values the current save contract cannot represent; never round JSON or smuggle array text. */
function preciseJson(text: string): DatabaseCell {
  function decimalToken(token: string): string {
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)!, fraction = match[3] ?? '', exponent = Number(match[4] ?? 0)
    if (Math.abs(exponent) > 8192) throw new Error('JSON 数字超出当前保存协议的精度范围')
    let digits = (match[2] + fraction).replace(/^0+/, ''), scale = fraction.length - exponent
    if (!digits) return match[1] ? '-0' : '0'
    while (digits.endsWith('0')) { digits = digits.slice(0, -1); scale-- }
    return `${match[1]}${digits}:${scale}`
  }
  const source = formatJsonSource(text)
  if (source === 'null') throw new Error('当前保存协议无法区分 JSON null 与 SQL NULL；请使用原始 SQL 审查编辑，SQL NULL 则选择空值模式')
  let index = 0
  while (index < source.length) {
    if (source[index] === '"') { index++; while (index < source.length) { if (source[index] === '\\') index += 2; else if (source[index++] === '"') break } }
    else if (source[index] === '-' || /\d/.test(source[index])) {
      const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index))![0], number = Number(token)
      if (!Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number) || decimalToken(token) !== decimalToken(String(number))) throw new Error('JSON 含超出可靠精度的数字，当前保存协议无法无损表达；请使用原始 SQL 审查编辑')
      index += token.length
    } else index++
  }
  return JSON.parse(source) as DatabaseCell
}
export function coerceGridEditValue(text: string, column: DatabaseColumnInfo, original: DatabaseCell, provider: RelationalProvider): DatabaseCell {
  if (text === gridCellEditorText(original, column) && original !== null) return original
  if (/\bjsonb?\b/i.test(column.dataType)) return preciseJson(text)
  if (/\b(?:bytea|blob|binary|varbinary)\b/i.test(column.dataType) || original !== null && typeof original === 'object' && !Array.isArray(original) && original.type === 'binary') {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error(`${column.name} 的二进制值须为有效 Base64`)
    return { type: 'binary', base64: text }
  }
  if (Array.isArray(original) || provider === 'postgres' && (column.dataType.trim().endsWith('[]') || /^array$/i.test(column.dataType))) throw new Error(`${column.name} 是数组，当前保存协议不支持数组赋值；请使用原始 SQL 审查编辑`)
  if (/\bbool(?:ean)?\b/i.test(column.dataType) || typeof original === 'boolean') {
    const normalized = text.trim().toLowerCase()
    if (['true', '1'].includes(normalized)) return true
    if (['false', '0'].includes(normalized)) return false
    throw new Error(`${column.name} 请填写 true / false 或 1 / 0`)
  }
  if (provider === 'mysql' && /^tinyint\s*\(1\)/i.test(column.dataType.trim()) && /^(true|false)$/i.test(text.trim())) return text.trim().toLowerCase() === 'true' ? 1 : 0
  if (numeric.test(column.dataType)) {
    const value = text.trim()
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`${column.name} 须为十进制数字；空字符串与 NULL 请明确选择`)
    if (/\b(?:int|integer|smallint|bigint|tinyint|mediumint|int2|int4|int8|serial|bigserial|smallserial)\b/i.test(column.dataType) && !/^[+-]?\d+$/.test(value)) throw new Error(`${column.name} 须为整数`)
    return value
  }
  if (column.characterMaximumLength !== null && Array.from(text).length > column.characterMaximumLength) throw new Error(`${column.name} 最多 ${column.characterMaximumLength} 个字符`)
  return text
}
export function sameGridEditValue(left: DatabaseCell, right: DatabaseCell): boolean { return typeof left === typeof right && (typeof left === 'object' ? JSON.stringify(left) === JSON.stringify(right) : Object.is(left, right)) }
export function validateGridOriginalValue(value: DatabaseCell, depth = 0): void {
  if (depth > 20) throw new Error('原始值嵌套超过当前保存协议的 20 层限制')
  if (typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error('原始行含驱动返回的不安全数字；请先重新读取精确原始值')
  if (value && typeof value === 'object') for (const cell of Object.values(value)) validateGridOriginalValue(cell, depth + 1)
}
