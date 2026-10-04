import { BSON } from 'mongodb';
import type { MongoImportFieldMapping } from '@fouc/shared/mongo-document-transfer';
import { mongoTabularDateMilliseconds, type MongoTabularType } from '@fouc/shared/mongo-tabular';
import { DatabaseInputError } from './input-error';
import { mongoEjson } from './mongo-input';

/** Native BSON conversion shared by document field conversion and explicit tabular mappings. */
export function convertMongoImportValue(value: unknown, type: MongoImportFieldMapping['type']): unknown {
  const text = typeof value === 'string' ? value : value instanceof BSON.Int32 || value instanceof BSON.Long || value instanceof BSON.Double || value instanceof BSON.Decimal128 ? value.toString() : null;
  switch (type) {
    case 'string':
      if (typeof value === 'string') return value;
      if (text !== null || typeof value === 'boolean') return text ?? String(value);
      break;
    case 'objectId':
      if (value instanceof BSON.ObjectId) return value;
      if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return new BSON.ObjectId(value);
      break;
    case 'int32':
    case 'int64': {
      if (text === null || !/^-?\d+$/.test(text) || text.length > 21) break;
      const integer = BigInt(text);
      const lower = type === 'int32' ? -2147483648n : -9223372036854775808n;
      const upper = type === 'int32' ? 2147483647n : 9223372036854775807n;
      if (integer < lower || integer > upper) break;
      return type === 'int32' ? new BSON.Int32(Number(integer)) : BSON.Long.fromString(text);
    }
    case 'decimal128':
      if (text !== null) return BSON.Decimal128.fromString(text);
      break;
    case 'double':
      if (text !== null && text.trim() && Number.isFinite(Number(text))) return new BSON.Double(Number(text));
      break;
    case 'date':
      if (value instanceof Date) return value;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
        const date = new Date(value);
        if (Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 19) === value.slice(0, 19)) return date;
      }
      break;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 'false') return value === 'true';
      break;
  }
  throw new DatabaseInputError(`无法无歧义转换为 ${type}；整数与 Decimal128 可使用精确的数字字符串`);
}

function safeJson(value: unknown, depth = 0): void {
  if (depth > 64) throw new DatabaseInputError('EJSON 单元格最多 64 层');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key) || key.includes('\0')) throw new DatabaseInputError('EJSON 单元格不能含原型字段或 NUL');
    safeJson(child, depth + 1);
  }
}

export function convertMongoTabularValue(text: string, type: MongoTabularType): unknown {
  if (type === 'ejson') {
    safeJson(JSON.parse(text));
    return mongoEjson('{"value":' + text + '}').value;
  }
  if (type === 'boolean' && /^(?:true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  if (type === 'double' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw new DatabaseInputError('Double 须为有效十进制浮点原文，不接受十六进制或非数值文本');
  if (type === 'date') {
    const milliseconds = mongoTabularDateMilliseconds(text);
    if (milliseconds !== null) return new Date(milliseconds);
    throw new DatabaseInputError('日期须为有效 YYYY-MM-DD 或 RFC3339（明确时区，最多毫秒），不自动修正非法日期');
  }
  return convertMongoImportValue(text, type);
}
