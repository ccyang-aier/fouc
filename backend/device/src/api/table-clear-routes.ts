import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { TABLE_CLEAR_LIMITS, type TableClearPrepared, type TableClearCommitResult } from '@fouc/shared/table-clear';
import { DatabaseInputError } from '../database/input-error';

export interface TableClearRouteService {
  prepareTableClear(workspaceId: string, id: string, value: unknown, signal?: AbortSignal): Promise<TableClearPrepared>;
  commitTableClear(workspaceId: string, id: string, planId: string, value: unknown, signal?: AbortSignal): Promise<TableClearCommitResult>;
  discardTableClear(workspaceId: string, id: string, planId: string): void;
}
export function tableClearRoutes(service: TableClearRouteService) {
  const app = new Hono();
  const base = '/api/database/workspaces/:workspaceId/relational/sessions/:id/table-clear';
  app.use(`${base}/*`, bodyLimit({ maxSize: TABLE_CLEAR_LIMITS.requestBytes, onError: () => { throw new DatabaseInputError('清空请求超过 4 KiB。'); } }));
  app.post(`${base}/plans`, async c => c.json({ ok: true, data: await service.prepareTableClear(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json(), c.req.raw.signal) }, 201));
  app.post(`${base}/plans/:planId/commit`, async c => c.json({ ok: true, data: await service.commitTableClear(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!, await c.req.json(), c.req.raw.signal) }));
  app.delete(`${base}/plans/:planId`, c => {
    service.discardTableClear(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: null });
  });
  return app;
}
