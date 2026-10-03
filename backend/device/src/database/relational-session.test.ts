import { afterAll, describe, expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseCapabilityRegistry } from './capability-registry';
import { RelationalSessionManager } from './relational-session';
import { RelationalConnectionRepository } from './relational-connections';
import { createApp } from '../api/server';

const directory = mkdtempSync(path.join(tmpdir(), 'fouc-relational-test-'));
const dbFile = path.join(directory, 'fixture.sqlite');
const db = new DatabaseSync(dbFile);
db.exec(`CREATE TABLE items (tenant TEXT NOT NULL, id INTEGER NOT NULL, value TEXT, computed TEXT GENERATED ALWAYS AS (tenant || id) VIRTUAL, PRIMARY KEY(tenant,id));
  INSERT INTO items VALUES ('a', 2, NULL), ('a', 1, 'hello'), ('b', 1, '世界');
  CREATE VIEW item_names AS SELECT tenant, value FROM items;`);
db.close();
afterAll(() => {
  Bun.gc(true);
  for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file));
  rmdirSync(directory);
});

describe('real SQLite connection and API', () => {
  test('discovers views/generated columns, paginates by composite primary key and retains duplicate result columns', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const session = await manager.connect('space-a', { provider: 'sqlite', path: dbFile });
    try {
      expect(session.info.productName).toBe('SQLite');
      expect(session.capabilities.capabilities.tableDataEdit).toBe(false);
      expect(await manager.schemas('space-a', session.id)).toEqual(['main']);
      expect(
        (await manager.tables('space-a', session.id, 'main')).find((item) => item.name === 'item_names')
          ?.kind,
      ).toBe('view');
      const first = await manager.page('space-a', session.id, 'main', 'items', 0, 1);
      expect(first.rows[0]).toEqual(['a', 1, 'hello', 'a1']);
      expect(first.hasMore).toBe(true);
      expect(first.columns[3]?.extra).toBe('generated');
      expect((await manager.page('space-a', session.id, 'main', 'items', 2, 1)).hasMore).toBe(false);
      const query = await manager.query(
        'space-a',
        session.id,
        'SELECT 9223372036854775807 AS x, 2 AS x, NULL AS n',
        'main',
      );
      expect(query.columns).toEqual(['x', 'x', 'n']);
      expect(query.rows[0]).toEqual(['9223372036854775807', 2, null]);
      await expect(manager.query('space-a', session.id, 'DELETE FROM items', 'main')).rejects.toThrow();
      await expect(manager.page('space-b', session.id, 'main', 'items')).rejects.toThrow();
      await expect(manager.disconnect('space-b', session.id)).rejects.toThrow();
    } finally {
      await manager.shutdown();
    }
    await expect(manager.schemas('space-a', session.id)).rejects.toThrow();
  });
  test('saved metadata is persistent, workspace scoped and discards passwords', () => {
    const repository = new RelationalConnectionRepository(directory);
    const connection = repository.save('space-a', {
      name: 'test',
      config: {
        provider: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'reader',
        database: 'app',
        password: 'do-not-store',
      },
    });
    expect(new RelationalConnectionRepository(directory).get('space-a', connection.id)).toEqual(connection);
    expect(repository.list('space-b')).toEqual([]);
    expect(() => repository.get('space-b', connection.id)).toThrow();
    const persisted = readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .map((name) => readFileSync(path.join(directory, name), 'utf8'))
      .join('');
    expect(persisted).not.toContain('do-not-store');
    repository.remove('space-a', connection.id);
    expect(repository.list('space-a')).toEqual([]);
  });
  test('device authentication covers native routes and validates bounds and workspace ownership', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const app = createApp({
      registry: {} as never,
      supervisor: {} as never,
      connectors: {} as never,
      relationalSessions: manager,
      token: 'test-token',
      internalToken: 'internal-token',
    }).app;
    const base = '/api/database/workspaces/space-a/relational/sessions';
    const headers = { authorization: 'Bearer test-token', 'content-type': 'application/json' };
    expect((await app.request(base, { method: 'POST', body: '{}' })).status).toBe(401);
    const created = await app.request(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider: 'sqlite', path: dbFile }),
    });
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };
    try {
      expect(
        (await app.request(`${base}/${data.id}/schemas/main/tables/items/rows?limit=501`, { headers }))
          .status,
      ).toBe(400);
      expect(
        (await app.request(`${base.replace('space-a', 'space-b')}/${data.id}/schemas`, { headers })).status,
      ).toBe(400);
      const result = await app.request(`${base}/${data.id}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sql: 'SELECT * FROM items', schema: 'main', maxRows: 2 }),
      });
      expect(result.status).toBe(200);
      expect(((await result.json()) as { data: { hasMore: boolean } }).data.hasMore).toBe(true);
    } finally {
      await manager.shutdown();
    }
  });
});
