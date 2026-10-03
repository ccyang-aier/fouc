import type { RelationalProvider } from './relational';
import { extractSqlParameterDescriptors, renderSqlParameters, type SqlParameterDescriptor, type SqlParameterInput } from './sql-parameters';
import { expandSqlVariables } from './sql-variables';
import type { MappedSql } from './sql-source-map';

export interface SqlTemplateInput { parameters?: Record<string, SqlParameterInput>; declarationSql?: string }
export interface SqlTemplateInspection { source: MappedSql; descriptors: SqlParameterDescriptor[] }
export function inspectSqlTemplate(sql: string, provider: RelationalProvider, declarationSql?: string): SqlTemplateInspection {
  if (sql.length > 1_000_000 || (declarationSql?.length ?? 0) > 1_000_000 || new TextEncoder().encode(sql).length > 1_000_000 || declarationSql && new TextEncoder().encode(declarationSql).length > 1_000_000) throw new Error('SQL 超过 1 MB');
  const source = expandSqlVariables(sql, { databaseType: provider, declarationSql });
  return { source, descriptors: extractSqlParameterDescriptors(source.sql, { databaseType: provider }) };
}
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const boolean = /^(?:true|false|t|f|yes|no|y|n|1|0)$/i;
export function sqlParameterInputIssue(descriptor: SqlParameterDescriptor, input: SqlParameterInput): string | null {
  if (descriptor.collection) {
    const value = input.value.trim();
    if (value.startsWith('[')) {
      try {
        const items: unknown = JSON.parse(value);
        if (!Array.isArray(items) || items.some((item) => item !== null && !['string', 'number', 'boolean'].includes(typeof item))) return '集合须为字符串、数字、布尔值或 NULL 的 JSON 数组';
        if (items.some((item) => typeof item === 'number' && (!Number.isFinite(item) || Number.isInteger(item) && !Number.isSafeInteger(item)))) return '精确大整数请使用字符串数组并选择数字类型';
        if (input.kind === 'number' && items.some((item) => item !== null && !numeric.test(String(item).trim()))) return '集合中含有无效数字';
        if (input.kind === 'boolean' && items.some((item) => item !== null && !boolean.test(String(item).trim()))) return '集合中含有无效布尔值';
      } catch { return 'JSON 数组格式无效'; }
    } else if (value && (input.kind === 'number' || input.kind === 'boolean')) {
      const valid = input.kind === 'number' ? numeric : boolean;
      if (value.split(',').some((item) => !valid.test(item.trim().replace(/^(['"])(.*)\1$/, '$2')))) return '集合须以逗号分隔有效的同类型值';
    }
    return null;
  }
  if (input.kind === 'number' && input.value.trim() && !numeric.test(input.value.trim())) return '请输入有效数字；大整数会保留原始精度';
  if (input.kind === 'boolean' && !boolean.test(input.value.trim())) return '布尔值支持 true / false、yes / no 或 1 / 0';
  return null;
}
/** Both preview and execution compile source SQL; the device never trusts client-rendered SQL. */
export function compileSqlTemplate(sql: string, provider: RelationalProvider, options: SqlTemplateInput = {}): MappedSql {
  if (options.declarationSql !== undefined && typeof options.declarationSql !== 'string') throw new Error('SQL 变量上下文无效');
  const { source, descriptors } = inspectSqlTemplate(sql, provider, options.declarationSql);
  const values: Record<string, SqlParameterInput> = Object.create(null);
  for (const descriptor of descriptors) {
    const input = options.parameters && Object.hasOwn(options.parameters, descriptor.key) ? options.parameters[descriptor.key] : null;
    if (!input || !['string', 'number', 'boolean', 'null', 'raw'].includes(input.kind) || typeof input.value !== 'string') throw new Error(`请填写参数 ${descriptor.name}`);
    if (input.value.length > 1_000_000) throw new Error(`参数 ${descriptor.name} 超过 1 MB`);
    const issue = sqlParameterInputIssue(descriptor, input);
    if (issue) throw new Error(`${descriptor.name}：${issue}`);
    values[descriptor.key] = { kind: input.kind, value: input.value };
  }
  const result = renderSqlParameters(source, values, { databaseType: provider });
  if (new TextEncoder().encode(result.sql).length > 1_000_000) throw new Error('展开后的 SQL 超过 1 MB');
  return result;
}
