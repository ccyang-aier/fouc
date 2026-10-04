import type { Document } from 'mongodb';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import {
  MONGO_TABULAR_TYPES, MONGO_TABULAR_LIMITS as LIMITS, parseMongoTabular, mongoTabularPath, validateMongoTabularFields,
  type MongoTabularConfig, type MongoTabularField,
} from '@fouc/shared/mongo-tabular';
import { DatabaseInputError } from './input-error';
import { mongoObject } from './mongo-input';
import { convertMongoTabularValue } from './mongo-tabular-value';

function configInput(value: unknown): MongoTabularConfig {
  const input = mongoObject(value);
  for (const flag of ['header', 'trimValues', 'emptyAsNull', 'recognizeObjectIdHex']) if (typeof input[flag] !== 'boolean') throw new DatabaseInputError(`CSV/TSV ${flag} 选项须为布尔值`);
  if (typeof input.delimiter !== 'string' || Array.from(input.delimiter).length !== 1 || /["\r\n\0]/.test(input.delimiter)) throw new DatabaseInputError('分隔符须为单个字符，不能为引号、换行或 NUL');
  if (typeof input.nullToken !== 'string' || input.nullToken.length > 64) throw new DatabaseInputError('NULL 标记最多 64 个字符');
  if (!Array.isArray(input.fields) || input.fields.length > LIMITS.columns) throw new DatabaseInputError('CSV/TSV 最多 256 个源列映射');
  const fields = input.fields.map((value): MongoTabularField => {
    const field = mongoObject(value);
    if (typeof field.sourceIndex !== 'number' || (field.target !== null && typeof field.target !== 'string') || !MONGO_TABULAR_TYPES.includes(field.type as MongoTabularField['type'])) throw new DatabaseInputError('源列、JSON Pointer 或类型无效');
    return { sourceIndex: field.sourceIndex, target: field.target as string | null, type: field.type as MongoTabularField['type'] };
  });
  return { delimiter: input.delimiter, header: input.header as boolean, trimValues: input.trimValues as boolean,
    emptyAsNull: input.emptyAsNull as boolean, nullToken: input.nullToken, recognizeObjectIdHex: input.recognizeObjectIdHex as boolean, fields };
}

function assign(document: Document, parts: string[], value: unknown): void {
  let parent: Record<string, unknown> | unknown[] = document;
  for (let index = 0; index < parts.length; index++) {
    const key = parts[index];
    if (index === parts.length - 1) { (parent as Record<string, unknown>)[key] = value; return; }
    if (!Object.hasOwn(parent, key)) (parent as Record<string, unknown>)[key] = /^(?:0|[1-9]\d*)$/.test(parts[index + 1]) ? [] : Object.create(null);
    parent = (parent as Record<string, unknown>)[key] as Record<string, unknown> | unknown[];
  }
}

function assertDense(value: unknown): void {
  if (!value || typeof value !== 'object' || '_bsontype' in value || value instanceof Date) return;
  if (Array.isArray(value)) for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) throw new DatabaseInputError('当前源行缺少数组前置元素，不能创建稀疏数组；请映射连续索引或明确 NULL');
  }
  for (const child of Object.values(value)) assertDense(child);
}

export async function parseMongoTabularDocuments(text: string, format: 'csv' | 'tsv', value: unknown, idPolicy: 'generate' | 'preserve', signal?: AbortSignal) {
  const config = configInput(value);
  const parsed = parseMongoTabular(text, format, config, signal);
  if (parsed.errors.length) {
    const error = parsed.errors[0];
    throw new DatabaseInputError(`源物理行 ${error.line ?? 1}${error.column ? `，列 ${error.column}` : ''}：${error.message}`);
  }
  try { validateMongoTabularFields(config.fields, parsed.columns.length); }
  catch (error) { throw new DatabaseInputError(error instanceof Error ? error.message : String(error)); }
  if (idPolicy === 'generate' && config.fields.some(field => field.target === '/_id' || field.target?.startsWith('/_id/'))) throw new DatabaseInputError('生成新 _id 时请明确跳过原 _id 源列');
  const mappings = config.fields.filter(field => field.target !== null).map(field => ({ ...field, parts: mongoTabularPath(field.target!) }));
  const documents: Document[] = [];
  for (let row = 0; row < parsed.rows.length; row++) {
    signal?.throwIfAborted();
    const document: Document = Object.create(null);
    for (const field of mappings) {
      const cell = parsed.rows[row][field.sourceIndex];
      if (!cell || cell.kind === 'missing') continue;
      try {
        assign(document, field.parts, cell.kind === 'null' ? null : convertMongoTabularValue(cell.value, field.type));
      } catch (error) {
        throw new DatabaseInputError(`源物理行 ${parsed.sourceLines[row]}，记录 ${parsed.rowNumbers[row]}，字段 ${parsed.columns[field.sourceIndex]} → ${field.target}：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    try { assertDense(document); }
    catch (error) { throw new DatabaseInputError(`源物理行 ${parsed.sourceLines[row]}：${error instanceof Error ? error.message : String(error)}`); }
    documents.push(document);
    if (row % 50 === 49) await yieldTurn();
  }
  return { documents, config, sourceLines: parsed.sourceLines, rowNumbers: parsed.rowNumbers };
}
