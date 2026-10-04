import type { RelationalProvider } from './relational';
import type { SchemaCreateInput } from './schema-create-types';

/** Preserve quoted identifier spelling; never silently trim or truncate a target. */
export function schemaCreateNameError(provider: RelationalProvider, name: string): string | null {
  if (provider === 'sqlite') return 'SQLite 不支持在当前连接中创建数据库或 Schema。';
  if (!name || !name.trim()) return '请输入资源名称。';
  if (name !== name.trim()) return '名称首尾不能包含空白。';
  if (/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(name)) return '名称不能包含控制字符或无效 Unicode。';
  if (provider === 'mysql') {
    if ([...name].length > 64) return 'MySQL 数据库名称最多 64 个字符。';
    if (/[.\/\\]/u.test(name) || /[\u{10000}-\u{10ffff}]/u.test(name)) return 'MySQL 数据库名称不能包含点、路径分隔符或非 BMP 字符。';
    if (new Set(['mysql', 'sys', 'information_schema', 'performance_schema', 'ndbinfo']).has(name.toLowerCase())) return '不能使用 MySQL 系统数据库名称。';
  } else {
    if (new TextEncoder().encode(name).length > 63) return 'PostgreSQL 名称最多 63 个 UTF-8 字节，避免服务器截断名称。';
    if (/^pg_/i.test(name) || name.toLowerCase() === 'information_schema') return '不能使用 PostgreSQL 系统 Schema 名称。';
  }
  return null;
}

export function parseSchemaCreateInput(provider: RelationalProvider, value: unknown): SchemaCreateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('创建参数必须是对象。');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['name', 'charset', 'collation'].includes(key))) throw new Error('创建参数包含未支持的字段。');
  if (typeof input.name !== 'string') throw new Error('资源名称必须是文本。');
  const error = schemaCreateNameError(provider, input.name);
  if (error) throw new Error(error);
  for (const key of ['charset', 'collation'] as const) {
    const option = input[key];
    if (option !== undefined && option !== null && (typeof option !== 'string' || !/^[a-zA-Z0-9_]{1,128}$/.test(option))) throw new Error('字符集或校对规则名称无效。');
    if (provider !== 'mysql' && option != null) throw new Error('仅 MySQL 支持字符集与校对规则。');
  }
  if (input.collation != null && input.charset == null) throw new Error('指定校对规则时必须选择字符集。');
  return { name: input.name, charset: input.charset as string | null | undefined, collation: input.collation as string | null | undefined };
}
