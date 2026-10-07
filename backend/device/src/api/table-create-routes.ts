import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { TABLE_CREATE_LIMITS, type TableCreateCommitResult, type TableCreateOptions, type TableCreatePrepared } from '@fouc/shared/table-create';
import { DatabaseInputError } from '../database/input-error';

export interface TableCreateRouteService {
  tableCreateOptions(id: string, signal?: AbortSignal): Promise<TableCreateOptions>;
  prepareTableCreate(id: string, value: unknown, signal?: AbortSignal): Promise<TableCreatePrepared>;
  commitTableCreate(id: string, planId: string, signal?: AbortSignal): Promise<TableCreateCommitResult>;
  discardTableCreate(id: string, planId: string): void;
}
export function tableCreateRoutes(service: TableCreateRouteService) {
  const app = new Hono();
  const base = '/api/database/relational/sessions/:id/table-create';
  app.use(`${base}/*`, bodyLimit({ maxSize: TABLE_CREATE_LIMITS.requestBytes, onError: () => { throw new DatabaseInputError('建表请求超过 128 KiB 上限。'); } }));
  app.get(`${base}/options`, async c => {
    if (Object.keys(c.req.query()).length) throw new DatabaseInputError('建表选项不接受客户端 SQL。');
    return c.json({ ok: true, data: await service.tableCreateOptions(c.req.param('id')!, c.req.raw.signal) });
  });
  app.post(`${base}/plans`, async c => {
    return c.json({ ok: true, data: await service.prepareTableCreate(c.req.param('id')!, await c.req.json(), c.req.raw.signal) });
  });
  app.post(`${base}/plans/:planId/commit`, async c => {
    const value: unknown = await c.req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || (value as Record<string, unknown>).confirm !== true) throw new DatabaseInputError('请显式确认已审查的建表 DDL。');
    return c.json({ ok: true, data: await service.commitTableCreate(c.req.param('id')!, c.req.param('planId')!, c.req.raw.signal) });
  });
  app.delete(`${base}/plans/:planId`, c => {
    service.discardTableCreate(c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: null });
  });
  return app;
}
