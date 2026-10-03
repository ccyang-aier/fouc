import type { DatabaseCell, RelationalProvider } from '@fouc/shared'
import { isBinaryCell, numericExportType } from '../result-export/values'
import type { DataCompareCell } from './model'

const decimalPattern = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/
export type CompareValueBudget = { characters: number }
export function compareJsonType(type: string, provider?: RelationalProvider): boolean {
  return /^jsonb?$/i.test(type.trim()) || /^oid:(?:114|3802)$/.test(type) || provider === 'mysql' && type === '245'
}
export function compareBinaryValue(value: DataCompareCell, type = '', provider?: RelationalProvider): boolean {
  return value !== undefined && isBinaryCell(value) && !compareJsonType(type, provider)
}
export function compareCellText(value: DataCompareCell, pretty = false): string {
  if (value === undefined) return '[缺失]'
  if (value === null) return 'NULL'
  if (value === '') return '""'
  return typeof value === 'object' ? JSON.stringify(value, null, pretty ? 2 : undefined) : String(value)
}
function exactDecimal(text: string): string | null {
  const match = decimalPattern.exec(text.trim())
  if (!match) return null
  const fraction = match[3] ?? match[4] ?? '', exponent = Number(match[5] ?? 0)
  if (Math.abs(exponent) > 8192 || !Number.isInteger(exponent) || (match[2] ?? '').length + fraction.length > 8192) throw new Error('十进制值超过 8,192 位精度范围。')
  let digits = ((match[2] ?? '') + fraction).replace(/^0+/, ''), scale = fraction.length - exponent
  if (!digits) return '0:0'
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); scale-- }
  return `${match[1] === '-' ? '-' : ''}${digits}:${scale}`
}

/** Typed, length-delimited tokens: text, exact decimals and JS numbers never coerce into one another. */
export function compareValueToken(value: DataCompareCell, type = '', provider?: RelationalProvider, budget: CompareValueBudget = { characters: 0 }, depth = 0): string {
  if (depth > 32) throw new Error('单元格嵌套超过 32 层，无法可靠比较。')
  let token: string
  if (value === undefined) token = 'missing'
  else if (value === null) token = 'null'
  else if (typeof value === 'boolean') token = value ? 'boolean:1' : 'boolean:0'
  else if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('驱动返回了非有限数值或不安全整数；需要原始数字文本。')
    token = `number:${Object.is(value, -0) ? '-0' : String(value)}`
  } else if (typeof value === 'string') {
    const decimal = numericExportType(provider ?? 'postgres', type) ? exactDecimal(value) : null
    token = decimal === null ? `text:${value.length}:${value}` : `decimal:${decimal}`
  } else if (isBinaryCell(value) && compareBinaryValue(value, type, provider)) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)) throw new Error('二进制值的 Base64 内容无效。')
    const binary: Record<string, DatabaseCell> = value
    token = `binary:${JSON.stringify(Object.keys(binary).sort().map((key) => [key, compareValueToken(binary[key], '', provider, budget, depth + 1)]))}`
  } else if (Array.isArray(value)) token = `array:${JSON.stringify(value.map((cell) => compareValueToken(cell, '', provider, budget, depth + 1)))}`
  else {
    const object: Record<string, DatabaseCell> = value
    token = `json:${JSON.stringify(Object.keys(object).sort().map((key) => [key, compareValueToken(object[key], '', provider, budget, depth + 1)]))}`
  }
  if (token.length > 1_000_000) throw new Error('单个值超过 1,000,000 字符的比较范围。')
  budget.characters += token.length
  if (budget.characters > 32_000_000) throw new Error('规范化比较内容超过 32,000,000 字符的处理范围。请缩小结果。')
  return token
}

export function compareCellKind(value: DataCompareCell, type = '', provider?: RelationalProvider): string {
  return value === undefined ? '缺失' : value === null ? 'NULL' : typeof value === 'object' ? compareBinaryValue(value, type, provider) ? '二进制' : Array.isArray(value) ? '数组' : 'JSON' : typeof value === 'number' ? '数值' : typeof value === 'boolean' ? '布尔值' : numericExportType(provider ?? 'postgres', type) && decimalPattern.test(value.trim()) ? '原始十进制' : '文本'
}
