import { Hono } from 'hono';
import type { RedisConnectionConfig } from '@fouc/shared';
import type { RedisSessionManager } from '../database/redis-session';
import type { DeviceConnectionRepository } from '../database/connection-repository';
import { DatabaseInputError } from '../database/input-error';
import { savedConnectionRoutes } from './saved-connection-routes';

export function redisRoutes(
  sessions: RedisSessionManager,
  connections?: DeviceConnectionRepository<RedisConnectionConfig>,
) {
  const app = new Hono();
  const root = '/api/database/workspaces/:workspaceId/redis';
  app.onError((error, c) =>
    c.json(
      {
        ok: false,
        error: {
          code: error instanceof DatabaseInputError ? 'invalid_input' : 'redis_failed',
          message: error.message,
        },
      },
      error instanceof DatabaseInputError ? 400 : 502,
    ),
  );
  if (connections)
    app.route(
      '/',
      savedConnectionRoutes(root + '/connections', connections, (workspace, input) =>
        sessions.connect(workspace, input),
      ),
    );
  const base = root + '/sessions';
  app.post(base, async (c) =>
    c.json(
      {
        ok: true,
        data: await sessions.connect(c.req.param('workspaceId')!, await c.req.json().catch(() => null)),
      },
      201,
    ),
  );
  app.post(base + '/:id/scan', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({
      ok: true,
      data: await sessions.scan(c.req.param('workspaceId')!, c.req.param('id')!, body?.cursor, body?.pattern),
    });
  });
  app.post(base + '/:id/value', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({
      ok: true,
      data: await sessions.value(c.req.param('workspaceId')!, c.req.param('id')!, body?.key, body?.cursor),
    });
  });
  app.post(base + '/:id/command', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({
      ok: true,
      data: await sessions.command(c.req.param('workspaceId')!, c.req.param('id')!, body?.command),
    });
  });
  app.post(base + '/:id/write-mode', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.setReadOnly(c.req.param('workspaceId')!, c.req.param('id')!, body?.readOnly) });
  });
  app.post(base + '/:id/edit-string', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.editString(c.req.param('workspaceId')!, c.req.param('id')!, body?.key) });
  });
  app.post(base + '/:id/mutations/preview', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.prepare(c.req.param('workspaceId')!, c.req.param('id')!, body?.mutation, body?.writeVersion) });
  });
  app.post(base + '/:id/mutations/commit', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.commit(c.req.param('workspaceId')!, c.req.param('id')!, body?.planId, body?.confirmed) });
  });
  app.delete(base + '/:id', (c) => {
    sessions.disconnect(c.req.param('workspaceId')!, c.req.param('id')!);
    return c.json({ ok: true, data: { disconnected: true } });
  });
  return app;
}
