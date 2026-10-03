import { DATABASE_EXPORT_MAX_TABLES, DEFAULT_DATABASE_EXPORT_INPUT, type DatabaseExportInput } from './database-export';

function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('数据库导出参数必须是对象');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(field => !fields.includes(field))) throw new Error('数据库导出包含未知参数');
  return input;
}
export function databaseExportName(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 1024 || value.includes('\0')) throw new Error('导出对象名称无效');
  return value;
}
export function validateDatabaseExportInput(value: unknown): DatabaseExportInput {
  const input = object(value, Object.keys(DEFAULT_DATABASE_EXPORT_INPUT));
  const request = { ...DEFAULT_DATABASE_EXPORT_INPUT, ...input };
  if (!Array.isArray(request.schemas) || !request.schemas.length || request.schemas.length > 64) throw new Error('请选择 1–64 个 Schema');
  const schemas = [...new Set(request.schemas.map(databaseExportName))];
  if (!Array.isArray(request.tables) || request.tables.length > DATABASE_EXPORT_MAX_TABLES) throw new Error('最多选择 1000 张表 / 视图');
  const seen = new Set<string>();
  const tables = request.tables.map(value => {
    const row = object(value, ['schema', 'table']);
    const schema = databaseExportName(row.schema), table = databaseExportName(row.table), key = JSON.stringify([schema, table]);
    if (!schemas.includes(schema) || seen.has(key)) throw new Error('表范围无效或重复');
    seen.add(key); return { schema, table };
  });
  if (!['sql', 'csv', 'ndjson', 'json'].includes(String(request.format))) throw new Error('请选择真实支持的导出格式');
  if (typeof request.includeStructure !== 'boolean' || typeof request.includeData !== 'boolean' || (!request.includeStructure && !request.includeData)) throw new Error('请选择结构或数据');
  if (request.format !== 'sql' && request.includeStructure) throw new Error('原生结构脚本仅支持 SQL 格式；CSV / JSON 格式可导出完整数据');
  if (!['file', 'zip'].includes(String(request.packaging))) throw new Error('导出打包方式无效');
  if (request.partMiB !== null && (typeof request.partMiB !== 'number' || !Number.isInteger(request.partMiB) || request.partMiB < 1 || request.partMiB > 256)) throw new Error('每个分包须为 1–256 MiB');
  if (request.packaging === 'file' && request.partMiB !== null) throw new Error('分包需要 ZIP 容器');
  if (typeof request.pageSize !== 'number' || !Number.isInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > 1000) throw new Error('每页读取须为 1–1000 行');
  if (request.rowLimit !== null && (typeof request.rowLimit !== 'number' || !Number.isSafeInteger(request.rowLimit) || request.rowLimit < 1 || request.rowLimit > 100_000_000)) throw new Error('显式每表行数范围须为 1–100000000');
  return { schemas, tables, format: request.format as DatabaseExportInput['format'], includeStructure: request.includeStructure, includeData: request.includeData, rowLimit: request.rowLimit as number | null, packaging: request.packaging as DatabaseExportInput['packaging'], partMiB: request.partMiB as number | null, pageSize: request.pageSize };
}
