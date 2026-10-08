import { Hono } from 'hono';
import type { DeviceConnectionRepository } from '../database/connection-repository';

/** Shared nonsecret CRUD; provider session creation owns connection validation. */
export function savedConnectionRoutes<Config, Session>(
  base: string,
  connections: DeviceConnectionRepository<Config>,
  connect: (input: unknown, connectionId: string) => Promise<Session>,
  beforeRemove?: (connectionId: string) => void | Promise<void>,
) {
  const app = new Hono();
  // Reopening uses only secrets validated for this saved target in the current device process.
  const verified = new Map<string, { config: string; password: string; connectionOptions?: unknown }>();
  app.get(base, (c) => c.json({ ok: true, data: connections.list() }));
  app.post(base, async (c) =>
    c.json(
      { ok: true, data: connections.save(await c.req.json().catch(() => null)) },
      201,
    ),
  );
  app.put(base + '/:id', async (c) => {
    connections.get(c.req.param('id')!);
    const entry = connections.save(await c.req.json().catch(() => null), c.req.param('id')!);
    if (verified.get(entry.id)?.config !== JSON.stringify(entry.config)) verified.delete(entry.id);
    return c.json({ ok: true, data: entry });
  });
  app.patch(base + '/:id/directory', async (c) => c.json({
    ok: true,
    data: connections.updateDirectory(
      c.req.param('id')!, await c.req.json().catch(() => null),
    ),
  }));
  app.delete(base + '/:id', async (c) => {
    connections.get(c.req.param('id')!);
    await beforeRemove?.(c.req.param('id')!);
    connections.remove(c.req.param('id')!);
    verified.delete(c.req.param('id')!);
    return c.json({ ok: true, data: { deleted: true } });
  });
  app.post(base + '/:id/connect', async (c) => {
    const entry = connections.get(c.req.param('id')!);
    const body = await c.req.json().catch(() => null);
    const config = JSON.stringify(entry.config);
    const previous = verified.get(entry.id);
    const cached = previous?.config === config ? previous : undefined;
    const sqlite = (entry.config as { provider?: unknown }).provider === 'sqlite';
    const supplied = body !== null && typeof body === 'object' && Object.hasOwn(body, 'password');
    if (!sqlite && !supplied && !cached) return c.json({ ok: false, error: {
      code: 'connection_credentials_required', message: '当前没有可用的连接凭证，请填写密码或证书并重新测试。',
    } }, 409);
    const password = supplied ? body.password : cached?.password;
    const connectionOptions = body?.connectionOptions !== undefined ? body.connectionOptions : !supplied ? cached?.connectionOptions : undefined;
    try {
      const session = await connect({ ...entry.config, password, ...(connectionOptions !== undefined ? { connectionOptions } : {}) }, entry.id);
      const current = connections.list().find(connection => connection.id === entry.id);
      if (!sqlite && typeof password === 'string' && current && JSON.stringify(current.config) === config)
        verified.set(entry.id, { config, password, connectionOptions });
      connections.recordStatus(entry.id, entry.config, 'passed');
      return c.json({ ok: true, data: session }, 201);
    } catch (error) {
      if (verified.get(entry.id)?.config === config) verified.delete(entry.id);
      connections.recordStatus(entry.id, entry.config, 'failed');
      throw error;
    }
  });
  return app;
}
