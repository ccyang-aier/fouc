import { z } from 'zod';
import type { RelationalProvider } from './relational';
import { TABLE_CREATE_LIMITS, type TableCreateColumn, type TableCreateInput } from './table-create-types';
import { tableCreateDefaultFunctions, tableCreateTypes } from './table-create-model';
import { testDataTemporalBound } from './test-data-validation';

const parameter = z.number().int().min(0).max(10485760).nullable();
const defaultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(), z.object({ kind: z.literal('null') }).strict(),
  z.object({ kind: z.literal('literal'), value: z.string().max(TABLE_CREATE_LIMITS.defaultCharacters) }).strict(),
  z.object({ kind: z.literal('function'), value: z.string().max(64) }).strict(),
]);
export const tableCreateInputSchema = z.object({
  schema: z.string().min(1).max(255), table: z.string().min(1).max(255),
  columns: z.array(z.object({
    id: z.string().min(1).max(80), name: z.string().min(1).max(255), type: z.string().min(1).max(64),
    length: parameter, precision: parameter, scale: parameter,
    nullable: z.boolean(), primaryKey: z.boolean(), unique: z.boolean(),
    identity: z.enum(['none', 'auto', 'by-default', 'always']), default: defaultSchema,
  }).strict()).min(1).max(TABLE_CREATE_LIMITS.columns),
}).strict();

export function tableCreateIdentifierError(provider: RelationalProvider, name: string, kind: 'schema' | 'table' | 'column'): string | null {
  if (!name.trim() || name !== name.trim() || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(name)) return '名称不能为空、含首尾空白、控制字符或无效 Unicode。';
  if (provider === 'mysql') {
    if ([...name].length > 64 || /[\u{10000}-\u{10ffff}]/u.test(name)) return 'MySQL 名称最多 64 个 BMP 字符。';
    if (kind !== 'column' && /[.\/\\]/.test(name)) return 'MySQL 数据库 / 表名不能包含点或路径分隔符。';
    if (kind === 'schema' && ['mysql', 'sys', 'performance_schema', 'information_schema', 'ndbinfo'].includes(name.toLowerCase())) return '不能在 MySQL 系统数据库中创建表。';
  }
  if (provider === 'postgres') {
    if (new TextEncoder().encode(name).length > 63) return 'PostgreSQL 名称最多 63 个 UTF-8 字节。';
    if (kind === 'schema' && (/^pg_/i.test(name) || name.toLowerCase() === 'information_schema')) return '不能在 PostgreSQL 系统 Schema 中创建表。';
    if (kind === 'column' && ['ctid', 'xmin', 'xmax', 'cmin', 'cmax', 'tableoid'].includes(name.toLowerCase())) return '此名称属于 PostgreSQL 系统字段。';
  }
  if (provider === 'sqlite') {
    if (kind === 'schema' && name !== 'main') return 'SQLite 仅支持当前 main 数据库。';
    if (kind === 'table' && /^sqlite_/i.test(name)) return 'sqlite_ 是 SQLite 保留对象前缀。';
    if (new TextEncoder().encode(name).length > 255) return '当前设计器将 SQLite 名称限制为 255 个 UTF-8 字节。';
  }
  return null;
}

export function tableCreateTypeSql(column: TableCreateColumn): string {
  if (column.length !== null) return `${column.type}(${column.length})`;
  if (column.precision !== null) return `${column.type}(${column.precision},${column.scale ?? 0})`;
  return column.type;
}
function validateLiteral(provider: RelationalProvider, column: TableCreateColumn, value: string): void {
  const type = tableCreateTypes[provider].find(item => item.name === column.type)!;
  if (value.includes('\0') || /[\ud800-\udfff]/u.test(value)) throw new Error('默认值不能包含 NUL 或无效 Unicode。');
  if (type.family === 'integer') {
    if (!/^[+-]?\d{1,20}$/.test(value)) throw new Error('整数默认值必须是十进制整数字面量。');
    const bits = provider === 'sqlite' || column.type === 'BIGINT' ? 64 : column.type === 'TINYINT' ? 8 : column.type === 'SMALLINT' ? 16 : 32;
    const integer = BigInt(value), bound = 1n << BigInt(bits - 1);
    if (integer < -bound || integer >= bound) throw new Error('默认值超出原生有符号整数范围。');
  } else if (type.family === 'decimal') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || value.length > 1002) throw new Error('精确数值默认值必须是有界十进制字面量。');
    if (column.precision !== null) {
      const unsigned = value.replace(/^[+-]/, ''), [integer, fraction = ''] = unsigned.split('.');
      if (integer.replace(/^0+/, '').length > column.precision - (column.scale ?? 0) || fraction.length > (column.scale ?? 0)) throw new Error('默认值超出字段精度或小数位；不会静默舍入。');
    }
  } else if (type.family === 'float') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value))) throw new Error('浮点默认值必须是有限数字面量。');
  } else if (type.family === 'boolean') {
    if (!['true', 'false'].includes(value)) throw new Error('布尔默认值仅接受 true 或 false。');
  } else if (type.family === 'binary') {
    if (!/^(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error('二进制默认值使用偶数长度的十六进制字节。');
    if (provider === 'mysql') throw new Error('当前 MySQL 设计器不设置 BLOB 默认字面量。');
  } else if (type.family === 'json') {
    if (provider === 'mysql') throw new Error('当前 MySQL 设计器不设置 JSON 默认字面量。');
    try { JSON.parse(value); } catch { throw new Error('JSON 默认值不是合法 JSON。'); }
  } else if (type.family === 'uuid') {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) throw new Error('UUID 默认值格式无效。');
  } else if (type.family === 'text') {
    if (provider === 'mysql' && column.type === 'TEXT') throw new Error('当前 MySQL 设计器不设置 TEXT 默认字面量。');
    if (column.length !== null && [...value].length > column.length) throw new Error('默认文本超过字段长度。');
  } else {
    // Shared native generator validator verifies real calendar / UTC/time boundaries.
    testDataTemporalBound(value, type.family === 'date' ? 'date' : type.family === 'time' ? 'time' : 'datetime');
    if (type.family === 'datetime' && /^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('时间戳默认值须使用包含 Z 的完整 UTC 时间。');
    if (provider === 'mysql' && column.type === 'TIMESTAMP' && (Date.parse(value) < Date.parse('1970-01-01T00:00:01Z') || Date.parse(value) > Date.parse('2038-01-19T03:14:07Z'))) throw new Error('MySQL TIMESTAMP 默认值使用 1970–2038 的可移植范围。');
  }
}

export function validateTableCreateInput(provider: RelationalProvider, value: unknown): TableCreateInput {
  const parsed = tableCreateInputSchema.safeParse(value);
  if (!parsed.success) throw new Error('建表参数无效：名称、字段、类型参数或默认值不符合设计器契约。');
  const input = parsed.data;
  const ids = new Set<string>(), names = new Set<string>();
  for (const [kind, name] of [['schema', input.schema], ['table', input.table]] as const) {
    const error = tableCreateIdentifierError(provider, name, kind); if (error) throw new Error(error);
  }
  const primary = input.columns.filter(column => column.primaryKey);
  const generated = input.columns.filter(column => column.identity !== 'none');
  if (provider !== 'postgres' && generated.length > 1) throw new Error('MySQL / SQLite 仅支持一个自增字段。');
  for (const column of input.columns) {
    const key = provider === 'postgres' ? column.name : column.name.toLowerCase();
    if (ids.has(column.id) || names.has(key)) throw new Error('字段 ID 或名称重复。');
    ids.add(column.id); names.add(key);
    try {
      const error = tableCreateIdentifierError(provider, column.name, 'column'); if (error) throw new Error(error);
      const type = tableCreateTypes[provider].find(item => item.name === column.type);
      if (!type) throw new Error('类型不在当前驱动支持的建表范围内。');
      if (type.parameter === 'length') {
        if (column.length === null || column.length < 1 || column.length > type.maximumLength! || column.precision !== null || column.scale !== null) throw new Error('长度参数无效。');
      } else if (type.parameter === 'decimal' && provider !== 'sqlite') {
        if (column.length !== null || column.precision === null || column.precision < 1 || column.precision > (provider === 'mysql' ? 65 : 1000) || column.scale === null || column.scale > column.precision || provider === 'mysql' && column.scale > 30) throw new Error('数值精度 / 小数位无效。');
      } else if ([column.length, column.precision, column.scale].some(item => item !== null)) throw new Error('此类型不支持长度或精度参数。');
      if (column.primaryKey && column.nullable) throw new Error('主键字段必须为 NOT NULL。');
      if (column.identity !== 'none') {
        if (type.family !== 'integer' || column.nullable || column.default.kind !== 'none') throw new Error('自增 / Identity 必须为非空整数，不能另设默认值。');
        if (provider === 'postgres' && !['by-default', 'always'].includes(column.identity)) throw new Error('PostgreSQL 使用 BY DEFAULT / ALWAYS Identity。');
        if (provider !== 'postgres' && column.identity !== 'auto') throw new Error('此驱动只接受 AUTO 自增。');
        if (provider === 'mysql' && primary[0]?.id !== column.id) throw new Error('MySQL 自增字段必须是主键的第一个字段。');
        if (provider === 'sqlite' && (column.type !== 'INTEGER' || primary.length !== 1 || !column.primaryKey)) throw new Error('SQLite AUTOINCREMENT 只支持单一 INTEGER PRIMARY KEY。');
      }
      if (column.default.kind === 'null' && !column.nullable) throw new Error('非空字段不能默认 NULL。');
      if (column.default.kind === 'function' && !tableCreateDefaultFunctions(provider, column.type).includes(column.default.value)) throw new Error('此类型不接受所选默认函数；禁止任意 SQL 表达式。');
      if (column.default.kind === 'literal') validateLiteral(provider, column, column.default.value);
      if (provider === 'mysql' && (column.primaryKey || column.unique) && ['TEXT', 'BLOB', 'JSON'].includes(column.type)) throw new Error('MySQL TEXT / BLOB / JSON 不支持本设计器的完整列主键 / 唯一约束。');
    } catch (reason) { throw new Error(`${column.name || '未命名字段'}：${reason instanceof Error ? reason.message : String(reason)}`); }
  }
  if (new TextEncoder().encode(JSON.stringify(input)).length > TABLE_CREATE_LIMITS.requestBytes) throw new Error('建表设计超过 128 KiB 上限。');
  return input;
}
