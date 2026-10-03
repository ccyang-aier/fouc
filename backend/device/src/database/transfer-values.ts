import type { DatabaseCell, DatabaseColumnInfo } from '@fouc/shared';
import { tableTransferTypeFamily, type TableTransferPlan } from '@fouc/shared/table-transfer';
import type { SqlParameter } from './drivers/relational-driver';

/** Raw decimals and int64s remain strings/bigints through every native parameter binding. */
export function transferCellValue(value: DatabaseCell, column: TableTransferPlan['columns'][number], plan: TableTransferPlan): SqlParameter {
  const provider = plan.target.provider, family = tableTransferTypeFamily(column.target.dataType, provider);
  if (value === null) { if (!column.target.isNullable) throw new Error('源 NULL 不能写入非空目标字段'); return null; }
  if (typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error('源数字已超出 JavaScript 安全整数范围，无法证明精度');
  if (isBinary(value)) {
    const bytes = Buffer.from(value.base64, 'base64');
    if (column.mapping.conversion === 'binary-hex') return `0x${bytes.toString('hex')}`;
    if (column.mapping.conversion === 'binary-base64') return bytes.toString('base64');
    if (family === 'binary') return bytes;
    throw new Error('二进制字段没有明确的目标编码');
  }
  if (typeof value === 'object') throw new Error('原生复杂值必须通过类型匹配或文本投影传输，不能隐式 JSON 序列化');
  const text = typeof value === 'boolean' ? value ? 'true' : 'false' : String(value);
  if (column.mapping.conversion === 'text' || family === 'text') {
    const limit = column.target.characterMaximumLength ?? /^(?:var)?char\((\d+)\)/i.exec(column.target.dataType)?.[1];
    if (limit && [...text].length > Number(limit)) throw new Error('文本长度超过目标字段限制');
    if (provider === 'postgres' && text.includes('\0')) throw new Error('PostgreSQL 文本不能包含 NUL');
    if (column.target.enumValues?.length && !column.target.enumValues.includes(text)) throw new Error('文本不在目标 ENUM 成员中');
    return text;
  }
  if (family === 'boolean') {
    const bool = typeof value === 'boolean' ? value : /^(?:true|1)$/i.test(text) ? true : /^(?:false|0)$/i.test(text) ? false : null;
    if (bool === null) throw new Error('布尔目标只接受 TRUE / FALSE / 1 / 0');
    return provider === 'sqlite' ? Number(bool) : bool;
  }
  if (family === 'integer') {
    const raw = typeof value === 'boolean' ? value ? '1' : '0' : text;
    if (!/^[+-]?\d+$/.test(raw)) throw new Error('整数目标不能舍入小数');
    const integer = BigInt(raw), [min, max] = integerBounds(column.target, provider);
    if (integer < min || integer > max) throw new Error('整数超出目标原生范围');
    return provider === 'sqlite' ? integer : raw;
  }
  if (family === 'decimal') {
    const raw = typeof value === 'boolean' ? value ? '1' : '0' : text;
    validateDecimal(raw, column.target);
    if (provider === 'sqlite') {
      if (!/^[+-]?\d+$/.test(raw)) throw new Error('SQLite NUMERIC 不能保证十进制精度');
      const integer = BigInt(raw); if (integer < -9223372036854775808n || integer > 9223372036854775807n) throw new Error('SQLite NUMERIC 整数超出 int64'); return integer;
    }
    return raw;
  }
  if (family === 'float') {
    if (tableTransferTypeFamily(column.source.dataType, plan.source.provider) === 'decimal') throw new Error('十进制到浮点不提供无损转换；请使用 DECIMAL / TEXT');
    const number = typeof value === 'boolean' ? Number(value) : Number(text);
    if (!text.trim() || !Number.isFinite(number) || Number.isInteger(number) && !Number.isSafeInteger(number)) throw new Error('浮点目标无法可靠表示此值');
    return number;
  }
  if (family === 'json') {
    try { JSON.parse(text); } catch { throw new Error('目标 JSON 需要合法 JSON 文本'); }
    if (provider === 'mysql') validateMysqlJsonNumbers(text);
    return text;
  }
  if (family === 'array' && plan.source.provider === 'postgres' && provider === 'postgres') return text;
  if (['date', 'time', 'timestamp', 'instant'].includes(family)) {
    if (!validTemporal(text, family)) throw new Error('日期 / 时间表示与目标原生类型不匹配');
    return text;
  }
  throw new Error('目标原生类型未提供准确的值绑定');
}
function isBinary(value: DatabaseCell): value is { type: 'binary'; base64: string } { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'type' in value && value.type === 'binary' && 'base64' in value && typeof value.base64 === 'string'); }
function integerBounds(column: DatabaseColumnInfo, provider: TableTransferPlan['target']['provider']): [bigint, bigint] {
  let bits = 64;
  if (provider !== 'sqlite') bits = /^(?:tinyint)/i.test(column.dataType) ? 8 : /^(?:smallint|int2)/i.test(column.dataType) ? 16 : /^mediumint/i.test(column.dataType) ? 24 : /^(?:bigint|int8)/i.test(column.dataType) ? 64 : 32;
  const unsigned = provider === 'mysql' && /\bunsigned\b/i.test(column.dataType);
  return unsigned ? [0n, (1n << BigInt(bits)) - 1n] : [-(1n << BigInt(bits - 1)), (1n << BigInt(bits - 1)) - 1n];
}
function validateDecimal(value: string, column: DatabaseColumnInfo): void {
  const match = /^[+-]?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value);
  if (!match || !`${match[1]}${match[2] ?? ''}` || value.length > 4096) throw new Error('十进制数字格式不合法');
  const exponent = Number(match[3] ?? 0); if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10000) throw new Error('十进制指数超出传输范围');
  const params = /\((\d+)\s*,\s*(\d+)\)/.exec(column.dataType), precision = column.numericPrecision ?? (params ? Number(params[1]) : null), scale = column.numericScale ?? (params ? Number(params[2]) : null);
  if (precision === null || scale === null) return;
  const whole = match[1], fraction = match[2] ?? '', digits = `${whole}${fraction}`, decimalPoint = whole.length + exponent;
  const first = digits.search(/[1-9]/), last = Math.max(0, digits.replace(/0+$/, '').length);
  const integerDigits = first < 0 ? 0 : Math.max(0, decimalPoint - first), fractionDigits = first < 0 ? 0 : Math.max(0, last - decimalPoint);
  if (integerDigits > precision - scale || fractionDigits > scale) throw new Error('十进制超过目标精度 / 小数位；不会静默舍入');
}
function validTemporal(text: string, family: string): boolean {
  if (family === 'date') return /^\d{4,}-\d{2}-\d{2}$/.test(text);
  if (family === 'time') return /^-?\d{2,3}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(text);
  const timestamp = /^\d{4,}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?/.exec(text);
  if (!timestamp) return false;
  return family === 'instant' ? /^(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(text.slice(timestamp[0].length)) : timestamp[0].length === text.length;
}
function decimalIdentity(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value)!;
  const digits = `${match[2]}${match[3] ?? ''}`.replace(/^0+/, '').replace(/0+$/, '');
  if (!digits) return '0';
  const trailing = `${match[2]}${match[3] ?? ''}`.match(/0+$/)?.[0].length ?? 0;
  return `${match[1]}${digits}e${Number(match[4] ?? 0) - (match[3]?.length ?? 0) + trailing}`;
}
/** MySQL JSON stores integer/double numbers; reject tokens its native representation cannot round-trip. */
function validateMysqlJsonNumbers(json: string): void {
  const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  for (let index = 0; index < json.length; index++) {
    if (json[index] === '"') { while (++index < json.length) { if (json[index] === '\\') index++; else if (json[index] === '"') break; } continue; }
    if (!/[-\d]/.test(json[index])) continue;
    number.lastIndex = index; const token = number.exec(json)?.[0]; if (!token) continue;
    if (/^-?\d+$/.test(token)) {
      const integer = BigInt(token); if (integer < -9223372036854775808n || integer > 18446744073709551615n) throw new Error('JSON 整数超出 MySQL 原生 int64 / uint64；请映射 TEXT 保留精度');
    } else {
      const float = Number(token); if (!Number.isFinite(float) || decimalIdentity(token) !== decimalIdentity(String(float))) throw new Error('JSON 数字超出 MySQL 原生浮点表示精度；请映射 TEXT');
    }
    index += token.length - 1;
  }
}
