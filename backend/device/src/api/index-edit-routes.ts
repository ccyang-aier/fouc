import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { INDEX_EDIT_LIMITS, type IndexEditOptions, type IndexEditPrepared, type IndexEditCommitResult } from '@fouc/shared/index-edit';
import { DatabaseInputError } from '../database/input-error';

export interface IndexEditRouteService {
  indexEditOptions(id: string, schema: string, table: string, signal?: AbortSignal): Promise<IndexEditOptions>;
  prepareIndexEdit(id: string, value: unknown, signal?: AbortSignal): Promise<IndexEditPrepared>;
  commitIndexEdit(id: string, planId: string, signal?: AbortSignal): Promise<IndexEditCommitResult>;
  discardIndexEdit(id: string, planId: string): void;
}
export function indexEditRoutes(service: IndexEditRouteService) {
  const app = new Hono();
  const base = '/api/database/relational/sessions/:id/index-edit';
  app.use(`${base}/*`, bodyLimit({ maxSize: INDEX_EDIT_LIMITS.requestBytes, onError: () => { throw new DatabaseInputError('索引请求超过 32 KiB 上限。'); } }));
  app.get(`${base}/options`, async c => {
    const query = c.req.query();
    if (Object.keys(query).some(key => !['schema', 'table'].includes(key)) || !query.schema || !query.table) throw new DatabaseInputError('请提供当前目录与数据表，索引选项不接受客户端 SQL。');
    return c.json({ ok: true, data: await service.indexEditOptions(c.req.param('id')!, query.schema, query.table, c.req.raw.signal) });
  });
  app.post(`${base}/plans`, async c => c.json({ ok: true, data: await service.prepareIndexEdit(c.req.param('id')!, await c.req.json(), c.req.raw.signal) }));
  app.post(`${base}/plans/:planId/commit`, async c => {
    const value: unknown = await c.req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || (value as Record<string, unknown>).confirm !== true) throw new DatabaseInputError('请显式确认已审查的索引创建或危险删除 DDL。');
    return c.json({ ok: true, data: await service.commitIndexEdit(c.req.param('id')!, c.req.param('planId')!, c.req.raw.signal) });
  });
  app.delete(`${base}/plans/:planId`, c => {
    service.discardIndexEdit(c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: null });
  });
  return app;
}
