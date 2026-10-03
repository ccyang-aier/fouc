import type { DatabaseCell, DatabaseColumnInfo, RelationalProvider } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import type { SqlParameter } from './drivers/relational-driver';

export function canonicalCell(value: DatabaseCell): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalCell).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonicalCell(value[key]!))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function validateCell(value: unknown, depth = 0): asserts value is DatabaseCell {
  if (depth > 20) throw new DatabaseInputError('字段值嵌套超过 20 层');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
  )
    return;
  if (Array.isArray(value)) {
    value.forEach((item) => validateCell(item, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => validateCell(item, depth + 1));
    return;
  }
  throw new DatabaseInputError('字段值无效；大整数须使用十进制字符串');
}
export function relationalParameter(
  value: DatabaseCell,
  column: DatabaseColumnInfo,
  provider: RelationalProvider,
): SqlParameter {
  if (value === null) return null;
  if (/\bjsonb?\b/i.test(column.dataType)) return JSON.stringify(value);
  if (value && typeof value === 'object') {
    if (
      !Array.isArray(value) &&
      value.type === 'binary' &&
      typeof value.base64 === 'string' &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)
    )
      return Buffer.from(value.base64, 'base64');
    throw new DatabaseInputError(`${column.name} 仅接受标量或二进制值，复杂类型请使用相应编辑器`);
  }
  if (
    provider === 'sqlite' &&
    /INT/i.test(column.dataType) &&
    typeof value === 'string' &&
    /^-?\d+$/.test(value)
  )
    return BigInt(value);
  return value;
}
