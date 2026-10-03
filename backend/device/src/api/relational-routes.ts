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
        data: await sessions.connect(c.req.param('workspaceId')!, await c.req.json().catch(() => null)),
      },
      201,
    ),
  );
  app.get(base + '/:id/schemas', async (c) =>
    c.json({ ok: true, data: await sessions.schemas(c.req.param('workspaceId')!, c.req.param('id')!) }),
  );
  app.get(base + '/:id/schemas/:schema/tables', async (c) =>
    c.json({
      ok: true,
      data: await sessions.tables(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('schema')!),
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
  app.post(base + '/:id/query', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.sql !== 'string' || (body.schema !== null && typeof body.schema !== 'string'))
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
