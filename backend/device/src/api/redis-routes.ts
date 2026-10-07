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
  const root = '/api/database/redis';
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
      savedConnectionRoutes(root + '/connections', connections, (input, connectionId) =>
        sessions.connect(input, connectionId), (connectionId) => sessions.removeConnection(connectionId),
      ),
    );
  const base = root + '/sessions';
  app.post(base, async (c) =>
    c.json(
      {
        ok: true,
        data: await sessions.connect(await c.req.json().catch(() => null)),
      },
      201,
    ),
  );
  app.post(base + '/:id/scan', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({
      ok: true,
      data: await sessions.scan(c.req.param('id')!, body?.cursor, body?.pattern),
    });
  });
  app.post(base + '/:id/value', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({
      ok: true,
      data: await sessions.value(c.req.param('id')!, body?.key, body?.cursor),
    });
  });
  app.post(base + '/:id/stream/groups', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.streamGroups(c.req.param('id')!, body?.key) });
  });
  app.post(base + '/:id/monitor', async (c) => {
    const stream = await sessions.monitor(c.req.param('id')!, c.req.raw.signal);
    return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
  });
  app.post(base + '/:id/pubsub', async (c) => {
    const stream = await sessions.pubsub(c.req.param('id')!, c.req.raw.signal);
    return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
  });
  app.get(base + '/:id/pubsub/:captureId/subscriptions', (c) => c.json({ ok: true,
    data: sessions.pubsubSubscriptions(c.req.param('id')!, c.req.param('captureId')!) }));
  app.get(base + '/:id/json-capability', async (c) => c.json({ ok: true,
    data: await sessions.jsonCapability(c.req.param('id')!) }));
  app.post(base + '/:id/pubsub/:captureId/subscriptions', async (c) => c.json({ ok: true,
    data: await sessions.pubsubChange(c.req.param('id')!, c.req.param('captureId')!, await c.req.json().catch(() => null)) }));
  app.post(base + '/:id/pubsub/publish', async (c) => c.json({ ok: true,
    data: await sessions.pubsubPublish(c.req.param('id')!, await c.req.json().catch(() => null)) }));
  app.post(base + '/:id/stream/consumers', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.streamConsumers(c.req.param('id')!, body?.key, body?.group) });
  });
  app.post(base + '/:id/stream/pending', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.streamPending(c.req.param('id')!, body?.key, body?.group, body?.cursor, body?.consumer) });
  });
  app.post(base + '/:id/command', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({
      ok: true,
      data: await sessions.command(c.req.param('id')!, body?.command),
    });
  });
  app.post(base + '/:id/write-mode', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.setReadOnly(c.req.param('id')!, body?.readOnly) });
  });
  app.get(base + '/:id/databases', async (c) => c.json({ ok: true,
    data: await sessions.databases(c.req.param('id')!, Number(c.req.query('offset') ?? 0)) }));
  app.post(base + '/:id/database', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.switchDatabase(c.req.param('id')!, body?.database) });
  });
  app.get(base + '/:id/history', (c) => c.json({ ok: true, data: sessions.history(c.req.param('id')!) }));
  app.get(base + '/:id/info', async (c) => c.json({ ok: true,
    data: await sessions.information(c.req.param('id')!) }));
  app.get(base + '/:id/slowlog', async (c) => c.json({ ok: true,
    data: await sessions.slowlog(c.req.param('id')!, Number(c.req.query('count') ?? 100)) }));
  app.delete(base + '/:id/history', (c) => {
    sessions.clearHistory(c.req.param('id')!);
    return c.json({ ok: true, data: { cleared: true } });
  });
  app.post(base + '/:id/edit-string', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.editString(c.req.param('id')!, body?.key) });
  });
  app.post(base + '/:id/mutations/preview', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.prepare(c.req.param('id')!, body?.mutation, body?.writeVersion) });
  });
  app.post(base + '/:id/mutations/commit', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.commit(c.req.param('id')!, body?.planId, body?.confirmed) });
  });
  app.post(base + '/:id/bulk/preview', async (c) => c.json({ ok: true,
    data: await sessions.prepareBulk(c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.post(base + '/:id/bulk/commit', async (c) => {
    const body = await c.req.json().catch(() => null);
    return c.json({ ok: true, data: await sessions.commitBulk(c.req.param('id')!, body?.planId, body?.confirmed, body?.dangerConfirmed, c.req.raw.signal) });
  });
  app.delete(base + '/:id/bulk/plans/:planId', (c) => {
    sessions.discardBulk(c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.delete(base + '/:id', (c) => {
    sessions.disconnect(c.req.param('id')!);
    return c.json({ ok: true, data: { disconnected: true } });
  });
  return app;
}
