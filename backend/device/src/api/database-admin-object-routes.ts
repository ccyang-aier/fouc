import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { DATABASE_ADMIN_OBJECT_LIMITS } from '@fouc/shared/database-admin-objects';
import type { DatabaseAdminObjectService } from '../database/admin-objects/service';
import { DatabaseInputError } from '../database/input-error';

export function databaseAdminObjectRoutes(service: Pick<DatabaseAdminObjectService, 'list' | 'details'>) {
  const app = new Hono();
  const base = '/api/database/workspaces/:workspaceId/relational/sessions/:id/admin-objects';
  app.use(`${base}/*`, bodyLimit({ maxSize: DATABASE_ADMIN_OBJECT_LIMITS.requestBytes, onError: () => { throw new DatabaseInputError('专属对象目录请求超过 16 KiB 上限。'); } }));
  app.post(`${base}/list`, async c => c.json({ ok: true, data: await service.list(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json(), c.req.raw.signal) }));
  app.post(`${base}/details`, async c => c.json({ ok: true, data: await service.details(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json(), c.req.raw.signal) }));
  return app;
}
