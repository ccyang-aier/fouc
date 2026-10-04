import { Hono } from 'hono';
import type { DeviceConnectionRepository } from '../database/connection-repository';

/** Shared nonsecret CRUD; provider session creation owns connection validation. */
export function savedConnectionRoutes<Config, Session>(
  base: string,
  connections: DeviceConnectionRepository<Config>,
  connect: (workspaceId: string, input: unknown, connectionId: string) => Promise<Session>,
  beforeRemove?: (workspaceId: string, connectionId: string) => void | Promise<void>,
) {
  const app = new Hono();
  app.get(base, (c) => c.json({ ok: true, data: connections.list(c.req.param('workspaceId')!) }));
  app.post(base, async (c) =>
    c.json(
      { ok: true, data: connections.save(c.req.param('workspaceId')!, await c.req.json().catch(() => null)) },
      201,
    ),
  );
  app.put(base + '/:id', async (c) => {
    connections.get(c.req.param('workspaceId')!, c.req.param('id')!);
    return c.json({
      ok: true,
      data: connections.save(
        c.req.param('workspaceId')!,
        await c.req.json().catch(() => null),
        c.req.param('id')!,
      ),
    });
  });
  app.patch(base + '/:id/directory', async (c) => c.json({
    ok: true,
    data: connections.updateDirectory(
      c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null),
    ),
  }));
  app.delete(base + '/:id', async (c) => {
    connections.get(c.req.param('workspaceId')!, c.req.param('id')!);
    await beforeRemove?.(c.req.param('workspaceId')!, c.req.param('id')!);
    connections.remove(c.req.param('workspaceId')!, c.req.param('id')!);
    return c.json({ ok: true, data: { deleted: true } });
  });
  app.post(base + '/:id/connect', async (c) => {
    const entry = connections.get(c.req.param('workspaceId')!, c.req.param('id')!);
    const body = await c.req.json().catch(() => null);
    try {
      const session = await connect(entry.workspaceId, { ...entry.config, password: body?.password, ...(body?.connectionOptions !== undefined ? { connectionOptions: body.connectionOptions } : {}) }, entry.id);
      connections.recordStatus(entry.workspaceId, entry.id, entry.config, 'passed');
      return c.json({ ok: true, data: session }, 201);
    } catch (error) {
      connections.recordStatus(entry.workspaceId, entry.id, entry.config, 'failed');
      throw error;
    }
  });
  return app;
}
