import { Hono } from 'hono';
import type { DatabaseActivityService } from '../database/activity';
import { DatabaseInputError } from '../database/input-error';

export function databaseActivityRoutes(activity: DatabaseActivityService) {
  const app = new Hono();
  app.get('/api/database/relational/sessions/:id/activity/snapshot', async c => {
    if (Object.keys(c.req.query()).length) throw new DatabaseInputError('监控接口不接受客户端 SQL 或其他查询参数。');
    return c.json({ ok: true, data: await activity.snapshot(c.req.param('id')!, c.req.raw.signal) });
  });
  return app;
}
