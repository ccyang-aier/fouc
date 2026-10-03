import { Hono } from 'hono';
import type { RelationalSessionManager } from '../database/relational-session';
import type { RelationalConnectionRepository } from '../database/relational-connections';
import { DatabaseInputError } from '../database/input-error';

/** Workspace ownership is checked for library resources even without a live DB session. */
export function sqlLibraryRoutes(sessions: RelationalSessionManager, connections?: RelationalConnectionRepository) {
  const app = new Hono(), root = '/api/database/workspaces/:workspaceId/relational', store = sessions.sqlRepository;
  const session = root + '/sessions/:sessionId/history';
  app.post(session + '/search', async (c) => c.json({ ok: true, data: sessions.historySearch(c.req.param('workspaceId')!, c.req.param('sessionId')!, await c.req.json().catch(() => null)) }));
  app.get(session + '/:id', (c) => c.json({ ok: true, data: sessions.historyEntry(c.req.param('workspaceId')!, c.req.param('sessionId')!, c.req.param('id')!) }));
  app.delete(session + '/:id', (c) => { sessions.deleteHistory(c.req.param('workspaceId')!, c.req.param('sessionId')!, c.req.param('id')!); return c.json({ ok: true, data: { deleted: true } }); });
  app.delete(session, async (c) => { if ((await c.req.json().catch(() => null))?.confirmed !== true) throw new DatabaseInputError('请确认清空当前连接查询历史'); sessions.clearHistory(c.req.param('workspaceId')!, c.req.param('sessionId')!); return c.json({ ok: true, data: { cleared: true } }); });
  if (!connections) return app;
  app.post(root + '/history/search', async (c) => c.json({ ok: true, data: store.search(c.req.param('workspaceId')!, await c.req.json().catch(() => null)) }));
  app.get(root + '/history/:id', (c) => c.json({ ok: true, data: store.history(c.req.param('workspaceId')!, c.req.param('id')!) }));
  app.delete(root + '/history/:id', (c) => { store.deleteHistory(c.req.param('workspaceId')!, c.req.param('id')!); return c.json({ ok: true, data: { deleted: true } }); });
  const library = root + '/connections/:connectionId/sql-library';
  app.use(library + '/*', async (c, next) => { connections.get(c.req.param('workspaceId')!, c.req.param('connectionId')!); await next(); });
  app.get(library, (c) => { connections.get(c.req.param('workspaceId')!, c.req.param('connectionId')!); return c.json({ ok: true, data: store.library(c.req.param('workspaceId')!, c.req.param('connectionId')!) }); });
  app.get(library + '/drafts', (c) => c.json({ ok: true, data: store.drafts(c.req.param('workspaceId')!, c.req.param('connectionId')!) }));
  app.put(library + '/drafts', async (c) => {
    const body = await c.req.json().catch(() => null);
    connections.get(c.req.param('workspaceId')!, c.req.param('connectionId')!);
    return c.json({ ok: true, data: store.saveDrafts(c.req.param('workspaceId')!, c.req.param('connectionId')!, body) });
  });
  app.post(library + '/folders', async (c) => c.json({ ok: true, data: store.saveFolder(c.req.param('workspaceId')!, c.req.param('connectionId')!, await c.req.json().catch(() => null)) }, 201));
  app.put(library + '/folders/:id', async (c) => c.json({ ok: true, data: store.saveFolder(c.req.param('workspaceId')!, c.req.param('connectionId')!, await c.req.json().catch(() => null), c.req.param('id')!) }));
  app.delete(library + '/folders/:id', async (c) => { if ((await c.req.json().catch(() => null))?.confirmed !== true) throw new DatabaseInputError('请确认删除 SQL 文件夹及其所有内容'); store.deleteFolder(c.req.param('workspaceId')!, c.req.param('connectionId')!, c.req.param('id')!); return c.json({ ok: true, data: { deleted: true } }); });
  app.post(library + '/files', async (c) => c.json({ ok: true, data: store.saveFile(c.req.param('workspaceId')!, c.req.param('connectionId')!, await c.req.json().catch(() => null)) }, 201));
  app.get(library + '/files/:id', (c) => c.json({ ok: true, data: store.file(c.req.param('workspaceId')!, c.req.param('connectionId')!, c.req.param('id')!) }));
  app.post(library + '/files/:id/open', (c) => c.json({ ok: true, data: store.file(c.req.param('workspaceId')!, c.req.param('connectionId')!, c.req.param('id')!, true) }));
  app.put(library + '/files/:id', async (c) => c.json({ ok: true, data: store.saveFile(c.req.param('workspaceId')!, c.req.param('connectionId')!, await c.req.json().catch(() => null), c.req.param('id')!) }));
  app.delete(library + '/files/:id', async (c) => { const body = await c.req.json().catch(() => null); if (body?.confirmed !== true) throw new DatabaseInputError('请确认删除 SQL 文件'); store.deleteFile(c.req.param('workspaceId')!, c.req.param('connectionId')!, c.req.param('id')!, body.version); return c.json({ ok: true, data: { deleted: true } }); });
  app.put(library + '/order', async (c) => { store.reorder(c.req.param('workspaceId')!, c.req.param('connectionId')!, await c.req.json().catch(() => null)); return c.json({ ok: true, data: { saved: true } }); });
  return app;
}
