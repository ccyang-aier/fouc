import { formatJsonSource, type DatabaseColumnInfo, type RelationalProvider } from '@fouc/shared';
import type { TableImportCell, TableImportFormat } from '@fouc/shared/table-import';
import type { SqlParameter } from './drivers/relational-driver';

/** DBX typed literal normalization, adapted to bound parameters instead of concatenated SQL. */
export function normalizeTableImportDecimal(raw: string): string {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw.trim());
  if (!match || (!match[2] && !match[3])) throw new Error('须为有效十进制数。');
  const exponent = Number(match[4] ?? 0), digits = (match[2] || '0') + (match[3] ?? ''), point = (match[2] || '0').length + exponent;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000 || digits.length > 1000) throw new Error('数值超出当前导入支持的 1000 位范围。');
  const number = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return (match[1] === '-' ? '-' : '') + number.replace(/^0+(?=\d)/, '');
}
function integerValue(text: string, column: DatabaseColumnInfo, provider: RelationalProvider): SqlParameter {
  const normalized = normalizeTableImportDecimal(text), fraction = normalized.split('.')[1];
  if (fraction && /[1-9]/.test(fraction)) throw new Error('整数目标字段不能接收小数。');
  const value = BigInt(normalized.split('.')[0]);
  const type = column.dataType.toLowerCase();
  const bits = provider === 'sqlite' || /bigint|bigserial|int8/.test(type) ? 64 : /tinyint/.test(type) ? 8 : /smallint|smallserial|int2/.test(type) ? 16 : /mediumint/.test(type) ? 24 : 32;
  const unsigned = /unsigned/i.test(type), width = BigInt(bits), min = unsigned ? 0n : -(1n << (width - 1n)), max = (1n << (unsigned ? width : width - 1n)) - 1n;
  if (value < min || value > max) throw new Error(`超出 ${column.dataType} 的整数范围。`);
  return provider === 'sqlite' ? value : value.toString();
}
export function tableImportParameter(cell: Exclude<TableImportCell, { kind: 'missing' }>, column: DatabaseColumnInfo, provider: RelationalProvider, sourceFormat?: TableImportFormat): SqlParameter {
  if (cell.kind === 'null') { if (!column.isNullable) throw new Error('目标字段不允许 NULL。'); return null; }
  const type = column.dataType.trim(), raw = cell.value;
  if (provider === 'postgres' && raw.includes('\0')) throw new Error('PostgreSQL 文本字段不支持 NUL 字符。');
  if (/\bjsonb?\b/i.test(type)) {
    if (cell.kind === 'text' && (sourceFormat === 'json' || sourceFormat === 'ndjson')) return JSON.stringify(raw);
    return formatJsonSource(raw);
  }
  if (/^(?:bool(?:ean)?|tinyint\(1\))(?=\s|$)/i.test(type)) {
    const value = raw.trim().toLowerCase();
    if (['true', 'yes', '1', 't'].includes(value)) return provider === 'postgres' ? true : 1;
    if (['false', 'no', '0', 'f'].includes(value)) return provider === 'postgres' ? false : 0;
    throw new Error('布尔字段只接受 true/false、yes/no 或 1/0。');
  }
  if (/^(?:tinyint|smallint|mediumint|bigint|integer|int\d*|serial|bigserial|smallserial)(?:\b|\()/i.test(type)) {
    if (cell.kind === 'boolean') return integerValue(raw === 'true' ? '1' : '0', column, provider);
    return integerValue(raw, column, provider);
  }
  if (/^(?:numeric|decimal|number)(?:\b|\()/i.test(type)) {
    const value = normalizeTableImportDecimal(raw), parameters = /\((\d+)\s*,\s*(\d+)\)/.exec(type);
    const precision = column.numericPrecision ?? (parameters ? Number(parameters[1]) : null), scale = column.numericScale ?? (parameters ? Number(parameters[2]) : null);
    const unsigned = value.replace(/^-/, ''), [whole, fraction = ''] = unsigned.split('.');
    if (scale !== null && fraction.replace(/0+$/, '').length > scale) throw new Error(`小数位超出目标精度 ${scale}，导入不会自动舍入。`);
    if (precision !== null && scale !== null && whole.replace(/^0+/, '').length > precision - scale) throw new Error('整数部分超出目标数值精度。');
    return value;
  }
  if (/^(?:real|double|float)(?:\b|\()/i.test(type)) {
    const value = normalizeTableImportDecimal(raw);
    if (!Number.isFinite(Number(value))) throw new Error('浮点值超出目标字段范围。');
    return value;
  }
  if (/^(?:bytea|blob|binary|varbinary)(?:\b|\()/i.test(type)) throw new Error('当前文本导入不写入二进制字段，请跳过该字段。');
  if (column.characterMaximumLength !== null && Array.from(raw).length > column.characterMaximumLength) throw new Error(`文本长度超出 ${column.characterMaximumLength} 个字符。`);
  if (column.enumValues?.length && !column.enumValues.includes(raw)) throw new Error('值不属于目标枚举字段的允许范围。');
  return raw;
}
