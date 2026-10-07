import { Hono } from "hono";
import { Readable } from "node:stream";
import type { SqliteBackupService } from "../database/sqlite-backup/service";

/** Mounted under device authentication; every artifact belongs to one live native session. */
export function sqliteBackupRoutes(backups: SqliteBackupService) {
  const app = new Hono();
  const base =
    "/api/database/relational/sessions/:id/sqlite-backups";
  app.get(base, (c) =>
    c.json({
      ok: true,
      data: backups.list({
        sessionId: c.req.param("id")!,
      }),
    }),
  );
  app.post(base, async (c) =>
    c.json(
      {
        ok: true,
        data: backups.start(
          {
            sessionId: c.req.param("id")!,
          },
          await c.req.json().catch(() => null),
        ),
      },
      201,
    ),
  );
  app.get(base + "/:jobId", (c) =>
    c.json({
      ok: true,
      data: backups.status(
        {
          sessionId: c.req.param("id")!,
        },
        c.req.param("jobId")!,
      ),
    }),
  );
  app.post(base + "/:jobId/cancel", (c) =>
    c.json({
      ok: true,
      data: backups.cancel(
        {
          sessionId: c.req.param("id")!,
        },
        c.req.param("jobId")!,
      ),
    }),
  );
  app.delete(base + "/:jobId", async (c) => {
    await backups.discard(
      {
        sessionId: c.req.param("id")!,
      },
      c.req.param("jobId")!,
    );
    return c.json({ ok: true, data: { discarded: true } });
  });
  app.get(base + "/:jobId/artifact", (c) => {
    const artifact = backups.download(
      {
        sessionId: c.req.param("id")!,
      },
      c.req.param("jobId")!,
      c.req.raw.signal,
    );
    return new Response(
      // Node and Bun/DOM declare different BYOB overloads for the same Web stream API.
      Readable.toWeb(artifact.stream) as unknown as ReadableStream<Uint8Array>,
      {
        headers: {
          "Content-Type": artifact.mimeType,
          "Content-Length": String(artifact.bytes),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(artifact.filename)}`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  });
  return app;
}
