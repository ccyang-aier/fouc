import { Hono } from 'hono';
import { Readable } from 'node:stream';
import type { MongoConnectionConfig } from '@fouc/shared/mongo-connections';
import type { DeviceConnectionRepository } from '../database/connection-repository';
import type { MongoSessionManager } from '../database/mongo-session';
import { DatabaseInputError } from '../database/input-error';
import { savedConnectionRoutes } from './saved-connection-routes';

/** Device authentication wraps this router; every native request checks workspace ownership. */
export function mongoRoutes(sessions: MongoSessionManager, connections?: DeviceConnectionRepository<MongoConnectionConfig>) {
  const app = new Hono(), root = '/api/database/workspaces/:workspaceId/mongo', base = root + '/sessions';
  app.onError((error, c) => c.json({ ok: false, error: { code: error instanceof DatabaseInputError ? 'invalid_input' : 'mongo_failed', message: error.message } }, error instanceof DatabaseInputError ? 400 : 502));
  if (connections) app.route('/', savedConnectionRoutes(root + '/connections', connections, async (workspace, input, id) => {
    const session = await sessions.connect(workspace, input, id);
    try { connections.get(workspace, id); }
    catch (error) { await sessions.disconnect(workspace, session.id).catch(() => undefined); throw error; }
    return session;
  }, (workspace, id) => sessions.closeConnection(workspace, id)));
  app.post(base, async c => c.json({ ok: true, data: await sessions.connect(c.req.param('workspaceId')!, await c.req.json().catch(() => null), null, c.req.raw.signal) }, 201));
  app.get(base + '/:id/databases', async c => c.json({ ok: true, data: await sessions.databases(c.req.param('workspaceId')!, c.req.param('id')!, c.req.raw.signal) }));
  app.put(base + '/:id/write-access', async c => {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.enabled !== 'boolean') throw new DatabaseInputError('MongoDB 写入权限参数无效');
    return c.json({ ok: true, data: sessions.setWriteAccess(c.req.param('workspaceId')!, c.req.param('id')!, body.enabled) });
  });
  app.post(base + '/:id/mutation/plans', async c => c.json({ ok: true, data: await sessions.prepareMutation(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }, 201));
  app.delete(base + '/:id/mutation/plans/:planId', c => {
    sessions.discardMutation(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!);
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.post(base + '/:id/mutation/plans/:planId/commit', async c => {
    const body = await c.req.json().catch(() => null);
    if (body?.confirm !== true) throw new DatabaseInputError('请明确确认已预览的 MongoDB 变更');
    return c.json({ ok: true, data: await sessions.commitMutation(c.req.param('workspaceId')!, c.req.param('id')!, c.req.param('planId')!, c.req.raw.signal) });
  });
  for (const operation of ['collections', 'find', 'count', 'indexes', 'information', 'command'] as const) {
    app.post(base + '/:id/' + operation, async c => c.json({ ok: true, data: await sessions[operation](c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  }
  for (const [path, operation] of [['buckets', 'gridFsBuckets'], ['files', 'gridFsFiles'], ['summary', 'gridFsSummary']] as const) {
    app.post(base + '/:id/gridfs/' + path, async c => c.json({ ok: true, data: await sessions[operation](c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal) }));
  }
  app.post(base + '/:id/gridfs/download', async c => {
    const download = await sessions.gridFsDownload(c.req.param('workspaceId')!, c.req.param('id')!, await c.req.json().catch(() => null), c.req.raw.signal);
    const ascii = download.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(download.filename).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
    try {
      return new Response(Readable.toWeb(download.stream) as ReadableStream<Uint8Array>, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(download.bytes),
          'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch (error) { download.stream.destroy(); throw error; }
  });
  app.delete(base + '/:id', async c => {
    await sessions.disconnect(c.req.param('workspaceId')!, c.req.param('id')!);
    return c.json({ ok: true, data: { disconnected: true } });
  });
  return app;
}
