import { savedConnectionRoutes } from './saved-connection-routes';
import { DatabaseInputError } from '../database/input-error';
import { Hono } from 'hono';
import type { RelationalSessionManager } from '../database/relational-session';
import type { RelationalConnectionRepository } from '../database/relational-connections';

/** Mounted beneath device authentication; every operation includes workspace. */
export function relationalRoutes(
  sessions: RelationalSessionManager,
  connections?: RelationalConnectionRepository,
) {
  const app = new Hono();
  const base = '/api/database/workspaces/:workspaceId/relational/sessions';
  app.onError((error, c) =>
    c.json(
      {
        ok: false,
        error: {
          code: error instanceof DatabaseInputError ? 'invalid_input' : 'database_failed',
          message: error.message,
        },
      },
      error instanceof DatabaseInputError ? 400 : 502,
    ),
  );
  if (connections)
    app.route(
      '/',
      savedConnectionRoutes(
        '/api/database/workspaces/:workspaceId/relational/connections',
        connections,
        (workspace, input) => sessions.connect(workspace, input),
      ),
    );
  app.post(base, async (c) =>
    c.json(
      {
        ok: true,
        data: await sessions.connect(
          c.req.param('workspaceId')!,
          await c.req.json().catch(() => null),
        ),
      },
      201,
    ),
  );
  app.get(base + '/:id', (c) =>
    c.json({
      ok: true,
      data: sessions.details(c.req.param('workspaceId')!, c.req.param('id')!),
    }),
  );
  app.put(base + '/:id/write-access', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.enabled !== 'boolean') throw new DatabaseInputError('写入权限参数无效');
    return c.json({
      ok: true,
      data: sessions.setWriteAccess(c.req.param('workspaceId')!, c.req.param('id')!, body.enabled),
    });
  });
  app.post(base + '/:id/save-plans', async (c) =>
    c.json(
      {
        ok: true,
        data: await sessions.prepare(
          c.req.param('workspaceId')!,
          c.req.param('id')!,
          await c.req.json().catch(() => null),
        ),
      },
      201,
    ),
  );
  app.delete(base + '/:id/save-plans/:planId', (c) => {
    sessions.discard(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.post(base + '/:id/save-plans/:planId/commit', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body?.confirm !== true) throw new DatabaseInputError('请明确确认预览中的变更');
    return c.json({
      ok: true,
      data: await sessions.commit(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        c.req.param('planId')!,
      ),
    });
  });
  app.get(base + '/:id/schemas', async (c) =>
    c.json({
      ok: true,
      data: await sessions.schemas(c.req.param('workspaceId')!, c.req.param('id')!),
    }),
  );
  app.get(base + '/:id/schemas/:schema/tables', async (c) =>
    c.json({
      ok: true,
      data: await sessions.tables(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        c.req.param('schema')!,
      ),
    }),
  );
  app.get(base + '/:id/schemas/:schema/tables/:table/structure', async (c) =>
    c.json({
      ok: true,
      data: await sessions.structure(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        c.req.param('schema')!,
        c.req.param('table')!,
      ),
    }),
  );
  app.get(base + '/:id/schemas/:schema/tables/:table/rows', async (c) =>
    c.json({
      ok: true,
      data: await sessions.page(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        c.req.param('schema')!,
        c.req.param('table')!,
        Number(c.req.query('offset') ?? 0),
        Number(c.req.query('limit') ?? 100),
      ),
    }),
  );
  app.post(base + '/:id/schemas/:schema/tables/:table/rows', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new DatabaseInputError('表查询参数无效');
    return c.json({
      ok: true,
      data: await sessions.page(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        c.req.param('schema')!,
        c.req.param('table')!,
        body.offset ?? 0,
        body.limit ?? 100,
        body,
      ),
    });
  });
  app.post(base + '/:id/schemas/:schema/tables/:table/rows/preview', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new DatabaseInputError('表查询参数无效');
    return c.json({
      ok: true,
      data: await sessions.previewPage(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        c.req.param('schema')!,
        c.req.param('table')!,
        body.offset ?? 0,
        body.limit ?? 100,
        body,
      ),
    });
  });
  app.post(base + '/:id/query', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      typeof body.sql !== 'string' ||
      (body.schema !== null && typeof body.schema !== 'string')
    )
      throw new DatabaseInputError('查询参数无效');
    return c.json({
      ok: true,
      data: await sessions.query(
        c.req.param('workspaceId')!,
        c.req.param('id')!,
        body.sql,
        body.schema,
        body.maxRows,
      ),
    });
  });
  app.delete(base + '/:id', async (c) => {
    await sessions.disconnect(c.req.param('workspaceId')!, c.req.param('id')!);
    return c.json({ ok: true, data: { disconnected: true } });
  });
  return app;
}
