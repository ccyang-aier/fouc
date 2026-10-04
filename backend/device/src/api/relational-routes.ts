import { savedConnectionRoutes } from './saved-connection-routes';
import { DatabaseInputError } from '../database/input-error';
import { Hono } from 'hono';
import type { RelationalSessionManager } from '../database/relational-session';
import type { RelationalConnectionRepository } from '../database/relational-connections';
import { sqlLibraryRoutes } from './sql-library-routes';
import { sqlMutationRoutes } from './sql-mutation-routes';
import { databaseExportRoutes } from './database-export-routes';
import { databaseActivityRoutes } from './database-activity-routes';
import { schemaCreateRoutes } from './schema-create-routes';
import { tableCreateRoutes } from './table-create-routes';
import { sqliteBackupRoutes } from './sqlite-backup-routes';
import { indexEditRoutes } from './index-edit-routes';
import { databaseSecurityRoutes } from './database-security-routes';
import { foreignKeyEditRoutes } from './foreign-key-edit-routes';
import { tableClearRoutes } from './table-clear-routes';
import { databaseAdminObjectRoutes } from './database-admin-object-routes';

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
        async (workspace, input, connectionId) => {
          const session = await sessions.connect(workspace, input, { id: connectionId, name: connections.get(workspace, connectionId).name });
          try { connections.get(workspace, connectionId); }
          catch (error) { await sessions.disconnect(workspace, session.id).catch(() => undefined); throw error; }
          return session;
        },
        (workspace, connectionId) => sessions.removeConnection(workspace, connectionId),
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
  app.route('/', sqlLibraryRoutes(sessions, connections));
  app.route('/', sqlMutationRoutes(sessions));
  app.route('/', databaseExportRoutes(sessions.exports));
  app.route('/', databaseActivityRoutes(sessions.activity));
  app.route('/', schemaCreateRoutes(sessions));
  app.route('/', tableCreateRoutes(sessions));
  app.route('/', indexEditRoutes(sessions));
  app.route('/', databaseSecurityRoutes(sessions.security));
  app.route('/', foreignKeyEditRoutes(sessions));
  app.route('/', tableClearRoutes(sessions));
  app.route('/', databaseAdminObjectRoutes(sessions.adminObjects));
  app.route('/', sqliteBackupRoutes(sessions.sqliteBackups));
  app.post(base + '/:id/transfer/plans', async c => c.json({ ok: true, data: await sessions.prepareTransfer(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }, 201));
  app.delete(base + '/:id/transfer/plans/:planId', c => { sessions.discardTransfer(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!); return c.json({ ok: true, data: { discarded: true } }); });
  app.post(base + '/:id/transfer/plans/:planId/start', async c => { const body = await c.req.json().catch(() => null); if (body?.confirm !== true) throw new DatabaseInputError('请明确确认传输计划'); return c.json({ ok: true, data: sessions.startTransfer(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!) }, 201); });
  app.get(base + '/:id/transfer/tasks/:taskId', c => c.json({ ok: true, data: sessions.transferTask(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('taskId')!) }));
  app.delete(base + '/:id/transfer/tasks/:taskId', c => c.json({ ok: true, data: sessions.cancelTransfer(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('taskId')!) }));
  app.post(base + '/:id/schema-objects/list', async c => c.json({ ok: true, data: await sessions.metadata.objects(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.post(base + '/:id/schema-objects/details', async c => c.json({ ok: true, data: await sessions.metadata.details(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.post(base + '/:id/schema-search', async c => c.json({ ok: true, data: await sessions.metadata.search(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.post(base + '/:id/diagram', async c => c.json({ ok: true, data: await sessions.metadata.diagram(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.post(base + '/:id/database-docs/snapshot', async c => c.json({ ok: true, data: await sessions.metadata.snapshot(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.get(base + '/:id/database-docs/annotations', c => c.json({ ok: true, data: sessions.metadata.annotations(c.req.param('workspaceId')!, c.req.param('id')!) }));
  app.put(base + '/:id/database-docs/annotations', async c => c.json({ ok: true, data: sessions.metadata.saveAnnotations(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null)) }));
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
  app.post(base + '/:id/table-import/plans', async (c) => c.json({ ok: true,
    data: await sessions.prepareImport(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }, 201));
  app.post(base + '/:id/structure-edit/plans', async c => c.json({ ok: true, data: await sessions.prepareStructureEdit(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }, 201));
  app.delete(base + '/:id/structure-edit/plans/:planId', c => {
    sessions.discardStructureEdit(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.post(base + '/:id/structure-edit/plans/:planId/commit', async c => {
    const body = await c.req.json().catch(() => null);
    if (body?.confirm !== true) throw new DatabaseInputError('请明确确认已审查的表结构变化');
    return c.json({ ok: true, data: await sessions.commitStructureEdit(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!, c.req.raw.signal) });
  });
  app.delete(base + '/:id/table-import/plans/:planId', (c) => {
    sessions.discardImport(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.post(base + '/:id/table-import/plans/:planId/commit', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body?.confirm !== true) throw new DatabaseInputError('请明确确认本次追加导入。');
    return c.json({ ok: true, data: await sessions.commitImport(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!, c.req.raw.signal) });
  });
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
  app.get(base + '/:id/schemas/:schema/tables/:table/columns', async (c) =>
    c.json({ ok: true, data: await sessions.columns(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('schema')!, c.req.param('table')!) }),
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
  app.post(base + '/:id/executions', async (c) => c.json({ ok: true,
    data: sessions.startExecution(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null)) }, 201));
  app.post(base + '/:id/explain', async (c) => c.json({ ok: true,
    data: await sessions.explain(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  app.get(base + '/:id/executions/:executionId', (c) => {
    const revision = Number(c.req.query('revision') ?? 0);
    if (!Number.isInteger(revision) || revision < 0) throw new DatabaseInputError('执行版本参数无效');
    return c.json({ ok: true, data: sessions.execution(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('executionId')!, revision) });
  });
  app.post(base + '/:id/executions/:executionId/cancel', (c) => c.json({ ok: true,
    data: sessions.cancelExecution(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('executionId')!) }));
  app.delete(base + '/:id', async (c) => {
    await sessions.disconnect(c.req.param('workspaceId')!, c.req.param('id')!);
    return c.json({ ok: true, data: { disconnected: true } });
  });
  return app;
}
