import { BSON, type Document } from 'mongodb';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import {
  MONGO_DOCUMENT_TRANSFER_LIMITS as LIMITS,
  type MongoDocumentImportInput,
  type MongoImportFieldMapping,
} from '@fouc/shared/mongo-document-transfer';
import { DatabaseInputError } from './input-error';
import { mongoEjson, mongoNamespace, mongoObject } from './mongo-input';
import { convertMongoImportValue } from './mongo-tabular-value';
import { parseMongoTabularDocuments } from './mongo-tabular-input';

const FIELD_TYPES = new Set(['string', 'objectId', 'int32', 'int64', 'decimal128', 'double', 'date', 'boolean']);

export function mongoImportPath(path: unknown): string[] {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 1024 || /~(?![01])/.test(path)) {
    throw new DatabaseInputError('字段路径须为 JSON Pointer，例如 /items/0/price；~1 表示 /，~0 表示 ~');
  }
  const parts = path.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.length > 32 || parts.some(part => !part || part.includes('\0') || ['__proto__', 'constructor', 'prototype'].includes(part))) {
    throw new DatabaseInputError('字段路径无效，最多 32 层且不能包含原型字段');
  }
  return parts;
}

function mappings(value: unknown): MongoImportFieldMapping[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new DatabaseInputError('最多指定 50 个字段转换');
  const seen = new Set<string>();
  return value.map(item => {
    const input = mongoObject(item);
    mongoImportPath(input.path);
    if (!FIELD_TYPES.has(String(input.type)) || seen.has(String(input.path))) throw new DatabaseInputError('字段类型无效或路径重复');
    seen.add(String(input.path));
    return { path: input.path as string, type: input.type as MongoImportFieldMapping['type'] };
  });
}


function applyMapping(document: Document, mapping: MongoImportFieldMapping): void {
  const parts = mongoImportPath(mapping.path);
  let parent: Record<string, unknown> | unknown[] = document;
  for (let index = 0; index < parts.length; index++) {
    const key = parts[index];
    if (Array.isArray(parent) && !/^(?:0|[1-9]\d*)$/.test(key)) throw new DatabaseInputError('数组路径须使用明确的非负索引');
    if (!Object.hasOwn(parent, key)) return; // Missing fields stay absent; defaults are never invented.
    const value = (parent as Record<string, unknown>)[key];
    if (index === parts.length - 1) {
      if (value !== null) (parent as Record<string, unknown>)[key] = convertMongoImportValue(value, mapping.type);
      return;
    }
    if (!value || typeof value !== 'object' || '_bsontype' in value || value instanceof Date) throw new DatabaseInputError('字段路径穿过标量值');
    parent = value as Record<string, unknown>;
  }
}

/** Keep raw top-level document slices so JSON.parse never rounds integer tokens before EJSON validation. */
function jsonDocuments(text: string): string[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) return [text];
  const documents: string[] = [];
  let start = text.indexOf('[') + 1, depth = 0, quoted = false, escaped = false;
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if ('[{'.includes(character)) depth++;
    else if (character === ']' && depth === 0) {
      if (text.slice(start, index).trim()) documents.push(text.slice(start, index));
      break;
    } else if (']}'.includes(character)) depth--;
    else if (character === ',' && depth === 0) {
      documents.push(text.slice(start, index));
      start = index + 1;
    }
    if (documents.length > LIMITS.documents) throw new DatabaseInputError('一次导入最多 5000 个文档');
  }
  return documents;
}

export type ParsedMongoImport = {
  input: Omit<MongoDocumentImportInput, 'text'>;
  documents: Document[];
  bytes: number;
  generatedIds: number;
};

export async function parseMongoDocumentImport(value: unknown, signal?: AbortSignal): Promise<ParsedMongoImport> {
  const raw = mongoObject(value), namespace = mongoNamespace(raw);
  if (typeof raw.text !== 'string' || !raw.text.trim() || Buffer.byteLength(raw.text) > LIMITS.inputBytes) throw new DatabaseInputError('UTF-8 导入文件须非空且不超过 32 MiB');
  if (!['json', 'ndjson', 'csv', 'tsv'].includes(String(raw.format))) throw new DatabaseInputError('请选择 JSON、NDJSON、CSV 或 TSV 格式');
  const format = raw.format as MongoDocumentImportInput['format'];
  if (raw.idPolicy !== 'preserve' && raw.idPolicy !== 'generate') throw new DatabaseInputError('请明确选择保留或重新生成 _id');
  const fields = mappings(raw.fields);
  if ((format === 'csv' || format === 'tsv') && fields.length) throw new DatabaseInputError('CSV/TSV 请使用源列映射与明确类型，不同时应用文档字段转换');
  if (raw.idPolicy === 'generate' && fields.some(field => field.path === '/_id' || field.path.startsWith('/_id/'))) throw new DatabaseInputError('生成新 _id 时不能同时转换原 _id');
  const text = raw.text.replace(/^\uFEFF/, '');
  let sources: Array<string | Document>, tabular: MongoDocumentImportInput['tabular'], sourceLines: number[] | null = null;
  try {
    if (format === 'csv' || format === 'tsv') {
      const parsed = await parseMongoTabularDocuments(text, format, raw.tabular, raw.idPolicy, signal);
      sources = parsed.documents;
      tabular = parsed.config;
      sourceLines = parsed.sourceLines;
    } else sources = format === 'json' ? jsonDocuments(text) : text.split(/\r?\n/).filter(line => line.trim());
  }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new DatabaseInputError(`${format.toUpperCase()} 文件无效：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!sources.length || sources.length > LIMITS.documents) throw new DatabaseInputError('一次导入须包含 1–5000 个文档');
  const documents: Document[] = [];
  let bytes = 0, generatedIds = 0;
  for (let index = 0; index < sources.length; index++) {
    signal?.throwIfAborted();
    try {
      const source = sources[index];
      const document = typeof source === 'string' ? mongoEjson(source) : source;
      for (const mapping of fields) applyMapping(document, mapping);
      if (raw.idPolicy === 'generate' || !Object.hasOwn(document, '_id')) {
        document._id = new BSON.ObjectId();
        generatedIds++;
      }
      if (Array.isArray(document._id) || document._id instanceof BSON.BSONRegExp || document._id instanceof RegExp) throw new DatabaseInputError('_id 不能是数组或正则表达式');
      const canonical = BSON.EJSON.stringify(document, { relaxed: false });
      if (Buffer.byteLength(canonical) > LIMITS.documentBytes) throw new DatabaseInputError('转换后的单文档超过 256 KiB');
      BSON.serialize(document); // All rows must be BSON-serializable before a plan can be created.
      bytes += Buffer.byteLength(canonical);
      if (bytes > LIMITS.inputBytes) throw new DatabaseInputError('转换后的全部文档超过 32 MiB');
      documents.push(document);
    } catch (error) {
      throw new DatabaseInputError(`${sourceLines ? `源物理行 ${sourceLines[index]}，` : ''}第 ${index + 1} 个文档：${error instanceof Error ? error.message : String(error)}`);
    }
    if (index % 50 === 49) await yieldTurn();
  }
  return { input: { ...namespace, format, idPolicy: raw.idPolicy, fields, ...(tabular ? { tabular } : {}) }, documents, bytes, generatedIds };
}
