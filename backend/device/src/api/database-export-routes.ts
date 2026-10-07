import { Hono } from 'hono';
import { Readable } from 'node:stream';
import type { RelationalExportService } from '../database/relational-export-service';

export function databaseExportRoutes(exports: RelationalExportService) {
  const app = new Hono();
  const base = '/api/database/relational/sessions/:id/database-export/jobs';
  const scope = (sessionId: string) => ({ sessionId });
  app.post(base, async c => c.json({
    ok: true,
    data: exports.start(scope(c.req.param('id')!), await c.req.json().catch(() => null)),
  }, 201));
  app.get(base, c => c.json({
    ok: true, data: exports.list(scope(c.req.param('id')!)),
  }));
  app.get(base + '/:jobId', c => c.json({
    ok: true, data: exports.status(scope(c.req.param('id')!), c.req.param('jobId')!),
  }));
  app.post(base + '/:jobId/cancel', c => c.json({
    ok: true, data: exports.cancel(scope(c.req.param('id')!), c.req.param('jobId')!),
  }));
  app.delete(base + '/:jobId', async c => {
    await exports.discard(scope(c.req.param('id')!), c.req.param('jobId')!);
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.get(base + '/:jobId/artifact', c => {
    const file = exports.download(scope(c.req.param('id')!), c.req.param('jobId')!, c.req.raw.signal);
    return new Response(Readable.toWeb(file.stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.bytes),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
  return app;
}
