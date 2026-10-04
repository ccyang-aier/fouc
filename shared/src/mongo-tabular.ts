import { parseTableImport, TABLE_IMPORT_LIMITS, type TableImportParsed } from './table-import';
import type { MongoImportFieldType } from './mongo-document-transfer';

export const MONGO_TABULAR_LIMITS = {
  inputBytes: TABLE_IMPORT_LIMITS.bytes,
  columns: TABLE_IMPORT_LIMITS.columns,
  cells: TABLE_IMPORT_LIMITS.cells,
  documents: TABLE_IMPORT_LIMITS.rows,
  sampleRows: 100,
  arrayItems: 256,
} as const;

export type MongoTabularType = MongoImportFieldType | 'ejson';
export type MongoTabularField = { sourceIndex: number; target: string | null; type: MongoTabularType };
export type MongoTabularOptions = {
  delimiter: string;
  header: boolean;
  trimValues: boolean;
  emptyAsNull: boolean;
  /** Only unquoted exact matches become null. Empty token disables this option. */
  nullToken: string;
  /** Enables ObjectId suggestions; selected field types remain explicit. */
  recognizeObjectIdHex: boolean;
};
export type MongoTabularConfig = MongoTabularOptions & { fields: MongoTabularField[] };
export type MongoTabularSuggestion = { type: MongoTabularType; samples: string[]; nonNull: number; objectIdCandidate: boolean };
export type MongoTabularSource = TableImportParsed & { sourceLines: number[]; suggestions: MongoTabularSuggestion[]; sampledRows: number };

export const MONGO_TABULAR_TYPES: readonly MongoTabularType[] = ['string', 'objectId', 'int32', 'int64', 'decimal128', 'double', 'date', 'boolean', 'ejson'];

export function mongoTabularPath(value: string): string[] {
  if (!value.startsWith('/') || value.length > 1024 || /~(?![01])/.test(value)) throw new Error('目标路径须为 JSON Pointer，例如 /items/0/price；~1 表示 /，~0 表示 ~');
  const parts = value.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.length > 32 || parts.some(part => !part || part.includes('\0') || ['__proto__', 'prototype', 'constructor'].includes(part))) throw new Error('目标路径最多 32 层，不能含空字段、NUL 或原型字段');
  return parts;
}

export function mongoTabularDefaultPath(column: string): string {
  return '/' + column.replace(/~/g, '~0').replace(/\//g, '~1');
}

type PathNode = { terminal: boolean; container: 'object' | 'array' | null; children: Map<string, PathNode> };
const node = (): PathNode => ({ terminal: false, container: null, children: new Map() });

/** Validate the complete shape before creating any document, including dense bounded array indices. */
export function validateMongoTabularFields(fields: MongoTabularField[], columns: number): void {
  if (!Array.isArray(fields) || !fields.length || fields.length > MONGO_TABULAR_LIMITS.columns) throw new Error('请配置 1–256 个源列映射');
  const source = new Set<number>(), root = node();
  root.container = 'object';
  let mapped = 0;
  for (const field of fields) {
    if (!field || !Number.isInteger(field.sourceIndex) || field.sourceIndex < 0 || field.sourceIndex >= columns || source.has(field.sourceIndex) || !MONGO_TABULAR_TYPES.includes(field.type)) throw new Error('源列索引或类型无效，同一个源列只能映射一次');
    source.add(field.sourceIndex);
    if (field.target === null) continue;
    if (typeof field.target !== 'string') throw new Error('目标路径须为 JSON Pointer；跳过列请明确设置 null');
    const parts = mongoTabularPath(field.target);
    let current = root;
    for (let depth = 0; depth < parts.length; depth++) {
      if (current.terminal) throw new Error(`目标路径与标量祖先冲突：${field.target}`);
      const key = parts[depth], numeric = /^(?:0|[1-9]\d*)$/.test(key);
      const container = depth > 0 && numeric ? 'array' : 'object';
      if (current.container && current.container !== container) throw new Error(`目标路径混用数组与对象：${field.target}`);
      current.container = container;
      if (container === 'array' && (!Number.isSafeInteger(Number(key)) || Number(key) >= MONGO_TABULAR_LIMITS.arrayItems)) throw new Error('数组索引须为 0–255，禁止巨数组');
      const child = current.children.get(key) ?? node();
      current.children.set(key, child);
      current = child;
    }
    if (current.terminal || current.children.size) throw new Error(`目标路径重复或与后代冲突：${field.target}`);
    current.terminal = true;
    mapped++;
  }
  if (!mapped) throw new Error('至少映射一个源列');
  const dense = (current: PathNode) => {
    if (current.container === 'array') {
      const indices = [...current.children.keys()].map(Number).sort((a, b) => a - b);
      if (indices.some((index, position) => index !== position)) throw new Error('数组映射须从索引 0 连续开始，禁止稀疏数组');
    }
    for (const child of current.children.values()) dense(child);
  };
  dense(root);
}

function candidate(text: string): MongoTabularType {
  if (/^(?:true|false)$/i.test(text)) return 'boolean';
  if (/^-?(?:0|[1-9]\d*)$/.test(text) && text.length <= 21) {
    const value = BigInt(text);
    if (value >= -2147483648n && value <= 2147483647n) return 'int32';
    if (value >= -9223372036854775808n && value <= 9223372036854775807n) return 'int64';
    return 'decimal128';
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) && text.replace(/[^\d]/g, '').length <= 34) return 'decimal128';
  if (mongoTabularDateMilliseconds(text) !== null) return 'date';
  if (/^(?:\{[\s\S]*\}|\[[\s\S]*\])$/.test(text.trim())) {
    try { JSON.parse(text); return 'ejson'; } catch { /* Invalid JSON remains an ordinary string suggestion. */ }
  }
  return 'string';
}

/** Date-only means UTC midnight; timestamps require an explicit offset and cannot roll invalid dates forward. */
export function mongoTabularDateMilliseconds(text: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/.exec(text);
  if (!match) return null;
  const clock = match[1] + 'T' + (match[2] ?? '00:00:00');
  const local = new Date(clock + (match[3] ?? '') + 'Z'), result = new Date(text).getTime();
  return Number.isFinite(local.getTime()) && local.toISOString().slice(0, 19) === clock && Number.isFinite(result) ? result : null;
}

function merge(left: MongoTabularType | null, right: MongoTabularType): MongoTabularType {
  if (!left || left === right) return right;
  if ([left, right].every(type => ['int32', 'int64', 'decimal128'].includes(type))) return left === 'decimal128' || right === 'decimal128' ? 'decimal128' : 'int64';
  return 'string';
}

/** Coordinates only: parsing and quote validation belong to the shared table-import lexer. */
function recordLines(text: string): number[] {
  const lines: number[] = [];
  let line = 1, start = 1, quoted = false, content = false;
  for (let index = text.startsWith('\uFEFF') ? 1 : 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      content = true;
      if (quoted && text[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      line++;
      if (!quoted) { if (content) lines.push(start); start = line; content = false; }
    } else content = true;
  }
  if (content) lines.push(start);
  return lines;
}

/** Raw cells stay strings. Sampling suggests types and never changes an import's selected types. */
export function parseMongoTabular(text: string, format: 'csv' | 'tsv', options: MongoTabularOptions, signal?: AbortSignal): MongoTabularSource {
  const parsed = parseTableImport(text, {
    format: 'delimited', delimiter: options.delimiter,
    titleRow: options.header ? 1 : 0, dataStartRow: options.header ? 2 : 1,
    trimValues: options.trimValues, emptyStringAsNull: options.emptyAsNull,
    ...(options.nullToken ? { nullToken: options.nullToken } : {}),
  }, signal);
  if (format !== 'csv' && format !== 'tsv') throw new Error('表格文件仅支持 CSV 或 TSV');
  if (parsed.errors.length) return { ...parsed, sourceLines: [], suggestions: [], sampledRows: 0 };
  const lines = recordLines(text), sampledRows = Math.min(parsed.rows.length, MONGO_TABULAR_LIMITS.sampleRows);
  const suggestions = parsed.columns.map((_, column): MongoTabularSuggestion => {
    let type: MongoTabularType | null = null, nonNull = 0, allObjectId = true;
    const samples: string[] = [];
    for (const row of parsed.rows.slice(0, sampledRows)) {
      const cell = row[column];
      if (!cell || cell.kind === 'missing' || cell.kind === 'null') continue;
      nonNull++;
      const value = cell.value;
      if (samples.length < 3 && !samples.includes(value)) samples.push(value);
      allObjectId &&= /^[\da-f]{24}$/i.test(value);
      type = merge(type, candidate(value));
    }
    const objectIdCandidate = nonNull > 0 && allObjectId;
    return { type: objectIdCandidate ? options.recognizeObjectIdHex ? 'objectId' : 'string' : type ?? 'string', samples, nonNull, objectIdCandidate };
  });
  return { ...parsed, sourceLines: parsed.rowNumbers.map(record => lines[record - 1]), suggestions, sampledRows };
}
