import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Database } from 'bun:sqlite';
import * as Y from 'yjs';
import { connectCollaborationClient } from './collaboration-test-client';
import { createDesktopPageCollaboration } from './page-collaboration-desktop';
import { pageDocumentName } from './page-documents';
import { createSqlitePageDocumentReplica } from '../../store/knowledge-documents';

/** The sidecar's SQLite replica: offline edits, restarts and cloud merges all converge. */
describe('desktop sqlite page document replica', () => {
  let directory: string;
  let database: Database;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'fouc-desktop-replica-'));
    database = openDatabase();
  });
  afterAll(async () => {
    await host?.close();
    host = undefined;
    database.close();
    // Windows releases SQLite file handles asynchronously; best-effort retry.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        rmSync(directory, { recursive: true, force: true });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  });

  function openDatabase() {
    const db = new Database(path.join(directory, 'replica.sqlite'));
    db.exec(`CREATE TABLE IF NOT EXISTS knowledge_page_document (
      workspace_id TEXT NOT NULL, page_id TEXT NOT NULL, state BLOB NOT NULL, state_vector BLOB NOT NULL,
      updated_at INTEGER NOT NULL, PRIMARY KEY (workspace_id, page_id));`);
    return db;
  }

  let host: { port: number; close(): Promise<void> } | undefined;
  function startHost() {
    const hocuspocus = createDesktopPageCollaboration(createSqlitePageDocumentReplica(database), { debounceMs: 100, maxDebounceMs: 300 });
    // A minimal loopback listener in the desktop assembly shape.
    const connections = new Map<unknown, { handleMessage(data: Uint8Array): void; handleClose(): void }>();
    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      idleTimeout: 255,
      fetch(request, srv) {
        if (request.headers.get('upgrade')?.toLowerCase() === 'websocket' && srv.upgrade(request)) return undefined as never;
        return new Response('Not found.', { status: 404 });
      },
      websocket: {
        open(ws: unknown) {
          connections.set(ws, hocuspocus.handleConnection(ws as never, new Request('http://127.0.0.1/')));
        },
        message(ws: unknown, message: unknown) {
          const bytes = typeof message === 'string' ? new TextEncoder().encode(message) : new Uint8Array((message as Buffer).buffer, (message as Buffer).byteOffset, (message as Buffer).byteLength);
          connections.get(ws)?.handleMessage(bytes);
        },
        close(ws: unknown) {
          connections.get(ws)?.handleClose();
          connections.delete(ws);
        },
      },
    });
    return {
      port: server.port as number,
      async close() {
        hocuspocus.closeConnections();
        server.stop(true);
      },
    };
  }

  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const pageId = '22222222-2222-4222-8222-222222222222';
  const name = pageDocumentName({ workspaceId, pageId });

  test('offline edits persist across a full host and database restart', async () => {
    host = startHost();
    const writer = connectCollaborationClient({ port: host!.port, origin: 'http://127.0.0.1', name });
    const handshake = Date.now() + 4_000;
    while ((writer.scope() !== 'read-write' || !writer.synced()) && Date.now() < handshake) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(writer.scope()).toBe('read-write');
    writer.document.getText('body').insert(0, 'offline draft');

    const replica = createSqlitePageDocumentReplica(database);
    const deadline = Date.now() + 5_000;
    while (!replica.load({ workspaceId, pageId }) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 40));
    const persisted = replica.load({ workspaceId, pageId })!;
    expect(persisted.state.length).toBeGreaterThan(0);
    await writer.destroy();
    await host!.close();

    // Full restart: fresh process state, database reopened from disk.
    database.close();
    database = openDatabase();
    host = startHost();
    const reopened = connectCollaborationClient({ port: host!.port, origin: 'http://127.0.0.1', name });
    while (!reopened.synced() || reopened.document.getText('body').toString() !== 'offline draft') {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (Date.now() > deadline) throw new Error('Restarted replica never converged.');
    }
    await reopened.destroy();
  });

  test('cloud-authoritative states merge with local offline edits instead of overwriting', async () => {
    host = startHost();
    const local = connectCollaborationClient({ port: host!.port, origin: 'http://127.0.0.1', name });
    while (!local.synced()) await new Promise((resolve) => setTimeout(resolve, 20));
    // The offline buffer already carries 'offline draft'; the cloud version adds its own edit.
    const cloud = new Y.Doc();
    const replica = createSqlitePageDocumentReplica(database);
    const persisted = replica.load({ workspaceId, pageId })!;
    Y.applyUpdate(cloud, persisted.state);
    cloud.getText('body').insert(0, 'cloud edit • ');
    replica.save({ workspaceId, pageId }, Y.encodeStateAsUpdate(cloud), Y.encodeStateVector(cloud));

    // A fresh load after the replica advanced must show both contributions.
    await local.destroy();
    await host!.close();
    host = startHost();
    const merged = connectCollaborationClient({ port: host!.port, origin: 'http://127.0.0.1', name });
    const deadline = Date.now() + 5_000;
    while (!merged.synced() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    const body = merged.document.getText('body').toString();
    expect(body).toContain('offline draft');
    expect(body).toContain('cloud edit • ');
    await merged.destroy();
  });
});
