import { SQL_FILE_MAX_BYTES, sqlFileName, type SqlHistorySearch } from '@fouc/shared';
import { DatabaseInputError } from './input-error';

export function sqlObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('SQL 资料参数无效');
  return value as Record<string, unknown>;
}
export function sqlText(value: unknown, label: string, maximum = 256, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > maximum || value.includes('\0')) throw new DatabaseInputError(`${label}无效`);
  return value;
}
export function sqlNullable(value: unknown, label: string): string | null { return value === null ? null : sqlText(value, label); }
export function sqlName(value: unknown, file = false): string {
  const name = sqlText(value, file ? 'SQL 文件名' : '文件夹名称', 200).trim();
  if (/[\\/\x00-\x1f]/.test(name) || name === '.' || name === '..') throw new DatabaseInputError('名称不能包含路径分隔符或控制字符');
  const normalized = file ? sqlFileName(name) : name;
  if (normalized.length > 200) throw new DatabaseInputError('SQL 文件名含扩展名最多 200 个字符');
  return normalized;
}
export function sqlDocument(value: unknown): string {
  if (typeof value !== 'string' || Buffer.byteLength(value) > SQL_FILE_MAX_BYTES || Buffer.from(value).toString('utf8') !== value) throw new DatabaseInputError('SQL 文档需为有效 UTF-8，最多 64 MiB');
  return value;
}
export function historySearch(value: unknown): SqlHistorySearch {
  const input = sqlObject(value), ids = input.connectionIds ?? [], databases = input.databases ?? [], cursor = input.cursor ?? null;
  if (!Array.isArray(ids) || ids.length > 100 || !Array.isArray(databases) || databases.length > 100) throw new DatabaseInputError('历史目标筛选无效');
  const time = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new DatabaseInputError('历史时间筛选无效');
    return value;
  };
  const startedAt = time(input.startedAt), endedAt = time(input.endedAt);
  if (startedAt !== null && endedAt !== null && startedAt > endedAt) throw new DatabaseInputError('开始时间不能晚于结束时间');
  const success = input.success ?? null, limit = input.limit ?? 100;
  if ((success !== null && typeof success !== 'boolean') || !Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 200) throw new DatabaseInputError('历史分页或状态筛选无效');
  let after: SqlHistorySearch['cursor'] = null;
  if (cursor !== null) { const data = sqlObject(cursor); const executedAt = time(data.executedAt); if (executedAt === null) throw new DatabaseInputError('历史游标无效'); after = { executedAt, id: sqlText(data.id, '历史游标 ID', 128) }; }
  return { search: sqlText(input.search ?? '', '历史搜索', 1000, true).trim(), connectionIds: ids.map((id) => sqlText(id, '连接 ID', 128)),
    databases: databases.map((item) => { const data = sqlObject(item); return { connectionId: sqlText(data.connectionId, '连接 ID', 128), database: sqlText(data.database, '数据库', 1024, true) }; }),
    schema: input.schema === undefined ? null : sqlNullable(input.schema, 'Schema'), success, startedAt, endedAt, cursor: after, limit: Number(limit) };
}
