import { SCHEMA_OBJECT_KINDS, type RelationalProvider, type SchemaObjectIdentity, type SchemaObjectKind, type SchemaObjectListInput } from '@fouc/shared';
import { DatabaseInputError } from './input-error';
export function schemaObjectIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 1024 || value.includes('\0')) throw new DatabaseInputError('对象 / Schema 名称无效');
  return value;
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseInputError('对象目录参数无效'); return value as Record<string, unknown>; }
export function schemaObjectsListInput(provider: RelationalProvider, value: unknown): Required<SchemaObjectListInput> {
  const input = object(value), schema = schemaObjectIdentifier(input.schema), supported = SCHEMA_OBJECT_KINDS[provider];
  if (input.kinds !== undefined && (!Array.isArray(input.kinds) || input.kinds.some(kind => !supported.includes(kind)))) throw new DatabaseInputError('当前原生驱动不支持请求的对象类型');
  const kinds = input.kinds === undefined ? [...supported] : [...new Set(input.kinds as SchemaObjectKind[])];
  const search = input.search === undefined ? '' : input.search;
  if (typeof search !== 'string' || search.length > 256 || search.includes('\0')) throw new DatabaseInputError('对象搜索最多 256 个字符');
  const integer = (value: unknown, fallback: number, max: number) => { if (value === undefined) return fallback; if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new DatabaseInputError('对象目录分页无效'); return value; };
  const limit = integer(input.limit, 200, 1000); if (!limit) throw new DatabaseInputError('对象目录每页至少 1 项');
  return { schema, kinds, search, offset: integer(input.offset, 0, 100_000), limit };
}
export function schemaObjectDetailsInput(provider: RelationalProvider, value: unknown): SchemaObjectIdentity {
  const input = object(value), schema = schemaObjectIdentifier(input.schema), name = schemaObjectIdentifier(input.name);
  if (!SCHEMA_OBJECT_KINDS[provider].includes(input.kind as SchemaObjectKind)) throw new DatabaseInputError('当前原生驱动不支持该对象类型');
  const kind = input.kind as SchemaObjectKind;
  const optional = (key: string) => input[key] == null ? null : schemaObjectIdentifier(input[key]);
  let catalogId = optional('catalogId');
  if (provider === 'postgres') {
    if (catalogId === null || !/^\d{1,10}$/.test(catalogId) || BigInt(catalogId) > 4294967295n) throw new DatabaseInputError('PostgreSQL 对象需要有效的目录 OID，请刷新对象列表');
  } else catalogId = null;
  const signature = input.signature == null ? null : typeof input.signature === 'string' && input.signature.length <= 8192 && !input.signature.includes('\0') ? input.signature : (() => { throw new DatabaseInputError('例程签名无效'); })();
  return { schema, name, kind, catalogId, signature, parentSchema: optional('parentSchema'), parentName: optional('parentName') };
}
export function quoteSchemaObject(provider: RelationalProvider, name: string): string {
  const quote = provider === 'mysql' ? '`' : '"'; return quote + schemaObjectIdentifier(name).replaceAll(quote, quote + quote) + quote;
}
export function schemaObjectLike(search: string): string { return `%${search.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_')}%`; }
