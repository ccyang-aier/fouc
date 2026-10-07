import { Hono } from 'hono';
import { DatabaseInputError } from '../database/input-error';
import type { DatabaseSecurityService } from '../database/security/service';

export function databaseSecurityRoutes(service: DatabaseSecurityService) {
  const app = new Hono();
  const base = '/api/database/relational/sessions/:id/security';
  app.get(`${base}/directory`, async c => {
    if (Object.keys(c.req.query()).length) throw new DatabaseInputError('账户目录不接受客户端 SQL。');
    return c.json({ ok: true, data: await service.directory(c.req.param('id')!, c.req.raw.signal) });
  });
  app.get(`${base}/detail`, async c => c.json({ ok: true, data: await service.detail(c.req.param('id')!, c.req.query(), c.req.raw.signal) }));
  return app;
}
