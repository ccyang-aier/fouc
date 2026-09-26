import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Database } from 'bun:sqlite';
import * as Y from 'yjs';
import { createSqlitePageDocumentReplica } from './knowledge-documents';

describe('sqlite page document replica', () => {
  let directory: string;
  let database: Database;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'fouc-store-replica-'));
    database = open();
  });
  afterAll(async () => {
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

  function open() {
    const db = new Database(path.join(directory, 'replica.sqlite'));
    db.exec(`CREATE TABLE IF NOT EXISTS knowledge_page_document (
      workspace_id TEXT NOT NULL, page_id TEXT NOT NULL, state BLOB NOT NULL, state_vector BLOB NOT NULL,
      updated_at INTEGER NOT NULL, PRIMARY KEY (workspace_id, page_id));`);
    return db;
  }
  const scope = { workspaceId: 'w-1', pageId: 'p-1' };

  test('missing documents stay undefined; saved ones round-trip byte-exactly', () => {
    const replica = createSqlitePageDocumentReplica(database);
    expect(replica.load(scope)).toBeUndefined();
    const doc = new Y.Doc();
    doc.getText('body').insert(0, 'replica body');
    const state = Y.encodeStateAsUpdate(doc);
    const vector = Y.encodeStateVector(doc);
    replica.save(scope, state, vector);

    const persisted = replica.load(scope)!;
    expect([...persisted.state]).toEqual([...state]);
    expect([...persisted.stateVector]).toEqual([...vector]);
    expect(persisted.updatedAt).toBeGreaterThan(0);

    // Overwrites win for the same scope: the newest full state replaces the row.
    const next = new Y.Doc();
    Y.applyUpdate(next, state);
    next.getText('body').insert(0, 'v2 ');
    replica.save(scope, Y.encodeStateAsUpdate(next), Y.encodeStateVector(next));
    const decoded = new Y.Doc();
    Y.applyUpdate(decoded, replica.load(scope)!.state);
    expect(decoded.getText('body').toString()).toBe('v2 replica body');
  });

  test('workspaces and pages never share rows, and rows survive a database reopen', () => {
    const replica = createSqlitePageDocumentReplica(database);
    const other = { workspaceId: 'w-2', pageId: 'p-1' };
    const doc = new Y.Doc();
    doc.getText('body').insert(0, 'scoped');
    replica.save(other, Y.encodeStateAsUpdate(doc), Y.encodeStateVector(doc));

    expect(replica.load({ workspaceId: 'w-1', pageId: 'p-999' })).toBeUndefined();
    const before = replica.load(other)!.state;
    database.close();
    database = open();
    expect([...createSqlitePageDocumentReplica(database).load(other)!.state]).toEqual([...before]);
  });
});
