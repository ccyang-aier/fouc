import { SCHEMA_SEARCH_KINDS, type SchemaSearchInput, type SchemaSearchKind } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
import { schemaObjectIdentifier } from './schema-objects-input';

export type NativeSchemaSearchInput = Required<Omit<SchemaSearchInput, 'schemas'>> & { schemas: string[] | null };
export function schemaSearchInput(value: unknown): NativeSchemaSearchInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('Schema 搜索参数无效');
  const input = value as Record<string, unknown>;
  if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 256 || input.query.includes('\0')) throw new DatabaseInputError('请输入 1–256 个字符的搜索名称');
  if (input.schemas !== undefined && (!Array.isArray(input.schemas) || !input.schemas.length || input.schemas.length > 32)) throw new DatabaseInputError('请选择 1–32 个当前连接中的 Schema');
  const schemas = input.schemas === undefined ? null : [...new Set((input.schemas as unknown[]).map(schemaObjectIdentifier))];
  if (input.kinds !== undefined && (!Array.isArray(input.kinds) || !input.kinds.length || input.kinds.some((kind) => !SCHEMA_SEARCH_KINDS.includes(kind as SchemaSearchKind)))) throw new DatabaseInputError('对象搜索类别无效');
  for (const key of ['includeColumns', 'caseSensitive']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new DatabaseInputError('对象搜索选项无效');
  const includeColumns = input.includeColumns === true || Array.isArray(input.kinds) && input.kinds.includes('column'), kinds = input.kinds === undefined ? SCHEMA_SEARCH_KINDS.filter((kind) => kind !== 'column' || includeColumns) : [...new Set(input.kinds as SchemaSearchKind[])];
  const limit = input.limit ?? 200;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 500) throw new DatabaseInputError('搜索结果上限为 1–500 项');
  return { query: input.query.trim(), schemas, kinds: [...kinds], includeColumns, caseSensitive: input.caseSensitive === true, limit };
}
