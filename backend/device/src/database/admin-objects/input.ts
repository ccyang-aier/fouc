import { z } from 'zod';
import { DATABASE_ADMIN_OBJECT_LIMITS } from '@fouc/shared/database-admin-objects';
import type { RelationalProvider } from '@fouc/shared';
import { DatabaseInputError } from '../input-error';

const identifier = z.string().min(1).max(255).refine(value => !/[\u0000\ud800-\udfff]/u.test(value), '对象名称包含无效字符');
const page = {
  search: z.string().max(256).default(''), offset: z.number().int().min(0).max(DATABASE_ADMIN_OBJECT_LIMITS.maximumOffset).default(0),
  limit: z.number().int().min(1).max(DATABASE_ADMIN_OBJECT_LIMITS.maximumPage).default(DATABASE_ADMIN_OBJECT_LIMITS.page),
};
const listSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('event'), schema: identifier, ...page }).strict(),
  z.object({ kind: z.literal('extension'), filter: z.enum(['all', 'installed', 'available']).default('all'), ...page }).strict(),
]);
const detailSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('event'), schema: identifier, name: identifier }).strict(),
  z.object({ kind: z.literal('extension'), name: identifier }).strict(),
]);
function checkProvider(provider: RelationalProvider, kind: 'event' | 'extension') {
  if (provider !== (kind === 'event' ? 'mysql' : 'postgres')) throw new DatabaseInputError('此对象目录不属于当前原生数据库类型。');
}
export function adminObjectListInput(provider: RelationalProvider, value: unknown) {
  const result = listSchema.safeParse(value);
  if (!result.success) throw new DatabaseInputError('专属对象目录请求无效，不能提交客户端 SQL。');
  checkProvider(provider, result.data.kind);
  return result.data;
}
export function adminObjectDetailsInput(provider: RelationalProvider, value: unknown) {
  const result = detailSchema.safeParse(value);
  if (!result.success) throw new DatabaseInputError('专属对象详情名称或范围无效。');
  checkProvider(provider, result.data.kind);
  return result.data;
}
export const adminObjectSearch = (value: string) => '%' + value.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_') + '%';
