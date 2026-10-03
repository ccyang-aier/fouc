import { afterAll, describe, expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseCapabilityRegistry } from './capability-registry';
import { RelationalSessionManager } from './relational-session';
import { RelationalConnectionRepository } from './relational-connections';
import { createApp } from '../api/server';
import { RelationalSqlRepository } from './sql-library-repository';

const directory = mkdtempSync(path.join(tmpdir(), 'fouc-relational-test-'));
const dbFile = path.join(directory, 'fixture.sqlite');
const db = new DatabaseSync(dbFile);
db.exec(`CREATE TABLE items (tenant TEXT NOT NULL, id INTEGER NOT NULL, value TEXT, computed TEXT GENERATED ALWAYS AS (tenant || id) VIRTUAL, PRIMARY KEY(tenant,id));
  INSERT INTO items VALUES ('a', 2, NULL), ('a', 1, 'hello'), ('b', 1, '世界');
  CREATE VIEW item_names AS SELECT tenant, value FROM items;
  CREATE TABLE unique_items (code TEXT UNIQUE, a INTEGER, b INTEGER, "null" TEXT, UNIQUE(a,b));
  CREATE UNIQUE INDEX expression_key ON unique_items(lower(a));
  INSERT INTO unique_items VALUES('unique',1,2,'value');
  CREATE TABLE structure_child (id INTEGER PRIMARY KEY, "from" TEXT, "to" INTEGER, name TEXT CHECK(length(name)>0),
    FOREIGN KEY("from","to") REFERENCES items ON DELETE CASCADE ON UPDATE CASCADE);
  CREATE INDEX structure_expression ON structure_child(lower(name) DESC) WHERE name IS NOT NULL;
  CREATE UNIQUE INDEX structure_unique_partial ON structure_child(name) WHERE name IS NOT NULL;
  CREATE TRIGGER structure_trigger AFTER INSERT ON structure_child BEGIN SELECT 1; END;`);
db.close();
afterAll(() => {
  Bun.gc(true);
  for (const file of readdirSync(directory)) unlinkSync(path.join(directory, file));
  rmdirSync(directory);
});

describe('real SQLite connection and API', () => {
  test('native SQL history records actual outcomes, leaves blocked SQL out and keeps direct sessions transient', async () => {
    const store = new RelationalSqlRepository(), manager = new RelationalSessionManager(new DatabaseCapabilityRegistry(), store);
    try {
      const direct = await manager.connect('history-space', { provider: 'sqlite', path: dbFile });
      await manager.query('history-space', direct.id, '-- exact source\nSELECT 9223372036854775807 AS value;', 'main');
      await expect(manager.query('history-space', direct.id, 'SELECT * FROM nonexistent_sql_history', 'main')).rejects.toThrow('nonexistent_sql_history');
      await expect(manager.query('history-space', direct.id, 'DELETE FROM items', 'main')).rejects.toThrow();
      const history = manager.historySearch('history-space', direct.id, {});
      expect(history.persistent).toBe(false); expect(history.total).toBe(2); expect(store.search('history-space', {}).total).toBe(0);
      const success = history.entries.find((entry) => entry.success)!;
      expect(manager.historyEntry('history-space', direct.id, success.id).sql).toBe('-- exact source\nSELECT 9223372036854775807 AS value;');
      expect(() => manager.historySearch('foreign', direct.id, {})).toThrow();
      await manager.disconnect('history-space', direct.id);
      const saved = await manager.connect('history-space', { provider: 'sqlite', path: dbFile }, { id: 'saved', name: 'SQLite source' });
      const query = manager.query('history-space', saved.id, 'SELECT 1', 'main');
      manager.removeConnection('history-space', 'saved');
      expect((await query).rows).toEqual([[1]]); expect(store.search('history-space', {}).total).toBe(0);
      expect(() => manager.details('history-space', saved.id)).toThrow();
    } finally { await manager.shutdown(); }
  });
  test('a history storage failure reports a warning without turning a successful native query into a failure', async () => {
    class FailingHistory extends RelationalSqlRepository { override append(): void { throw new Error('history disk full'); } }
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry(), new FailingHistory());
    try {
      const session = await manager.connect('history-error', { provider: 'sqlite', path: dbFile }, { id: 'saved', name: 'SQLite source' });
      const result = await manager.query('history-error', session.id, 'SELECT 2 AS value', 'main');
      expect(result.rows).toEqual([[2]]); expect(result.messages).toEqual([{ severity: 'warning', message: '查询历史保存失败：history disk full' }]);
      await expect(manager.query('history-error', session.id, 'SELECT * FROM nonexistent_sql_history', 'main')).rejects.toThrow('nonexistent_sql_history');
    } finally { await manager.shutdown(); }
  });
  test('structure metadata groups implicit composite foreign keys and retains expression and trigger source', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const session = await manager.connect('space-structure', { provider: 'sqlite', path: dbFile });
    try {
      const structure = await manager.structure(
        'space-structure',
        session.id,
        'main',
        'structure_child',
      );
      expect(structure.foreignKeys[0]?.columns).toEqual(['from', 'to']);
      expect(structure.foreignKeys[0]?.referencedColumns).toEqual(['tenant', 'id']);
      expect(structure.foreignKeys[0]?.onDelete).toBe('CASCADE');
      expect(structure.foreignKeys[0]?.deferrable).toBeNull();
      const expression = structure.indexes.find((index) => index.name === 'structure_expression');
      expect(expression?.parts[0]?.descending).toBe(true);
      expect(expression?.parts[0]?.column).toBeNull();
      expect(expression?.definition).toContain('WHERE name IS NOT NULL');
      expect(
        structure.constraints.some((constraint) => constraint.name === 'structure_unique_partial'),
      ).toBe(false);
      expect(structure.triggers[0]?.definition).toContain('CREATE TRIGGER');
      expect(structure.definition.origin).toBe('native');
      expect(structure.definition.sql).toContain('CHECK(length(name)>0)');
      expect(
        (await manager.structure('space-structure', session.id, 'main', 'item_names')).kind,
      ).toBe('view');
      await expect(
        manager.structure('space-b', session.id, 'main', 'structure_child'),
      ).rejects.toThrow();
      await expect(
        manager.structure('space-structure', session.id, 'main', 'missing'),
      ).rejects.toThrow();
    } finally {
      await manager.shutdown();
    }
  });
  test('typed database filters preserve NULL/list semantics and deterministic composite-key pagination', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const session = await manager.connect('space-filter', { provider: 'sqlite', path: dbFile });
    try {
      const query = {
        filter: {
          kind: 'group',
          join: 'and',
          children: [
            { kind: 'condition', column: 'tenant', operator: 'equals', value: 'a' },
            { kind: 'condition', column: 'value', operator: 'in', values: [null, 'hello'] },
          ],
        },
        sort: [{ column: 'value', direction: 'desc', nulls: 'first' }],
      };
      const first = await manager.page('space-filter', session.id, 'main', 'items', 0, 1, query);
      const second = await manager.page('space-filter', session.id, 'main', 'items', 1, 1, query);
      expect(first.rows[0]?.slice(0, 3)).toEqual(['a', 2, null]);
      expect(second.rows[0]?.slice(0, 3)).toEqual(['a', 1, 'hello']);
      expect(first.hasMore).toBe(true);
      expect(second.hasMore).toBe(false);
      expect(first.stableOrder).toBe(true);
      expect(first.statement.sql).not.toContain('hello');
      expect(first.statement.parameters).toEqual(['a', 'hello']);
      await expect(
        manager.page('space-filter', session.id, 'main', 'items', 0, 100, {
          filter: { kind: 'condition', column: 'id; DELETE', operator: 'equals', value: 1 },
          sort: [],
        }),
      ).rejects.toThrow('不存在');
      await expect(
        manager.previewPage('other-space', session.id, 'main', 'items', 0, 100, query),
      ).rejects.toThrow();
    } finally {
      await manager.shutdown();
    }
  });
  test('a real single-column unique key identifies a keyless row; composite/expression indices do not', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const session = await manager.connect('space-unique', { provider: 'sqlite', path: dbFile });
    try {
      manager.setWriteAccess('space-unique', session.id, true);
      const page = await manager.page('space-unique', session.id, 'main', 'unique_items');
      expect(page.columns.map((column) => column.isUnique)).toEqual([true, false, false, false]);
      const plan = await manager.prepare('space-unique', session.id, {
        schema: 'main',
        table: 'unique_items',
        changes: [{ kind: 'update', original: page.rows[0], values: { b: 3 } }],
      });
      await manager.commit('space-unique', session.id, plan.id);
      expect(
        (await manager.page('space-unique', session.id, 'main', 'unique_items')).rows[0]?.[2],
      ).toBe(3);
    } finally {
      await manager.shutdown();
    }
  });
  test('writes require an explicit unlock and single-use plan; conflicts roll back the whole batch', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const session = await manager.connect('space-write', { provider: 'sqlite', path: dbFile });
    const scope = 'space-write';
    try {
      const insert = {
        schema: 'main',
        table: 'items',
        changes: [
          {
            kind: 'insert',
            values: { tenant: 'write-test', id: '9007199254740993', value: 'first' },
          },
        ],
      };
      await expect(manager.prepare(scope, session.id, insert)).rejects.toThrow('只读');
      expect(
        manager.setWriteAccess(scope, session.id, true).capabilities.capabilities.tableDataEdit,
      ).toBe(true);
      const plan = await manager.prepare(scope, session.id, insert);
      await expect(manager.commit('other-space', session.id, plan.id)).rejects.toThrow();
      expect((await manager.commit(scope, session.id, plan.id)).affectedRows).toBe(1);
      await expect(manager.commit(scope, session.id, plan.id)).rejects.toThrow('失效');
      const original = (await manager.page(scope, session.id, 'main', 'items')).rows.find(
        (row) => row[0] === 'write-test',
      )!;
      expect(original[1]).toBe('9007199254740993');
      const pending = await manager.prepare(scope, session.id, {
        schema: 'main',
        table: 'items',
        changes: [
          { kind: 'insert', values: { tenant: 'rollback-test', id: 1, value: 'must disappear' } },
          { kind: 'update', original, values: { value: 'stale' } },
        ],
      });
      const changed = await manager.prepare(scope, session.id, {
        schema: 'main',
        table: 'items',
        changes: [{ kind: 'update', original, values: { value: 'fresh' } }],
      });
      await manager.commit(scope, session.id, changed.id);
      await expect(manager.commit(scope, session.id, pending.id)).rejects.toThrow('回滚');
      const after = await manager.page(scope, session.id, 'main', 'items');
      expect(after.rows.some((row) => row[0] === 'rollback-test')).toBe(false);
      expect(after.rows.find((row) => row[0] === 'write-test')?.[2]).toBe('fresh');
      await expect(
        manager.prepare(scope, session.id, {
          schema: 'main',
          table: 'items',
          changes: [{ kind: 'update', original, values: { computed: 'invalid' } }],
        }),
      ).rejects.toThrow('数据库生成');
      const invalidated = await manager.prepare(scope, session.id, insert);
      manager.setWriteAccess(scope, session.id, false);
      manager.setWriteAccess(scope, session.id, true);
      await expect(manager.commit(scope, session.id, invalidated.id)).rejects.toThrow('失效');
      await expect(manager.query(scope, session.id, 'DELETE FROM items', 'main')).rejects.toThrow();
      const current = after.rows.find((row) => row[0] === 'write-test')!;
      const deleted = await manager.prepare(scope, session.id, {
        schema: 'main',
        table: 'items',
        changes: [{ kind: 'delete', original: current }],
      });
      await manager.commit(scope, session.id, deleted.id);
    } finally {
      await manager.shutdown();
    }
  });
  test('discovers views/generated columns, paginates by composite primary key and retains duplicate result columns', async () => {
    const manager = new RelationalSessionManager(new DatabaseCapabilityRegistry());
    const session = await manager.connect('space-a', { provider: 'sqlite', path: dbFile });
    try {
      expect(session.info.productName).toBe('SQLite');
      expect(session.capabilities.capabilities.tableDataEdit).toBe(false);
      expect(await manager.schemas('space-a', session.id)).toEqual(['main']);
      expect(
        (await manager.tables('space-a', session.id, 'main')).find(
          (item) => item.name === 'item_names',
        )?.kind,
      ).toBe('view');
      const first = await manager.page('space-a', session.id, 'main', 'items', 0, 1);
      expect(first.rows[0]).toEqual(['a', 1, 'hello', 'a1']);
      expect(first.hasMore).toBe(true);
      expect(first.columns[3]?.extra).toBe('generated');
      expect((await manager.page('space-a', session.id, 'main', 'items', 2, 1)).hasMore).toBe(
        false,
      );
      const query = await manager.query(
        'space-a',
        session.id,
        'SELECT 9223372036854775807 AS x, 2 AS x, NULL AS n',
        'main',
      );
      expect(query.columns).toEqual(['x', 'x', 'n']);
      expect(query.rows[0]).toEqual(['9223372036854775807', 2, null]);
      await expect(
        manager.query('space-a', session.id, 'DELETE FROM items', 'main'),
      ).rejects.toThrow();
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
    expect(new RelationalConnectionRepository(directory).get('space-a', connection.id)).toEqual(
      connection,
    );
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
      const structurePath = `${base}/${data.id}/schemas/main/tables/items/structure`;
      expect((await app.request(structurePath)).status).toBe(401);
      expect((await app.request(structurePath, { headers })).status).toBe(200);
      expect(
        (
          await app.request(`${base}/${data.id}/write-access`, {
            method: 'PUT',
            body: '{"enabled":true}',
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await app.request(`${base}/${data.id}/write-access`, {
            method: 'PUT',
            headers,
            body: '{"enabled":true}',
          })
        ).status,
      ).toBe(200);
      const prepared = await app.request(`${base}/${data.id}/save-plans`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          schema: 'main',
          table: 'items',
          changes: [{ kind: 'insert', values: { tenant: 'api-test', id: 1, value: 'ok' } }],
        }),
      });
      expect(prepared.status).toBe(201);
      const plan = (await prepared.json()) as { data: { id: string } };
      const commitPath = `${base}/${data.id}/save-plans/${plan.data.id}/commit`;
      expect((await app.request(commitPath, { method: 'POST', headers, body: '{}' })).status).toBe(
        400,
      );
      expect(
        (await app.request(commitPath, { method: 'POST', headers, body: '{"confirm":true}' }))
          .status,
      ).toBe(200);
      expect(
        (await app.request(commitPath, { method: 'POST', headers, body: '{"confirm":true}' }))
          .status,
      ).toBe(400);
      expect(
        (
          await app.request(`${base}/${data.id}/schemas/main/tables/items/rows?limit=501`, {
            headers,
          })
        ).status,
      ).toBe(400);
      expect(
        (await app.request(`${base.replace('space-a', 'space-b')}/${data.id}/schemas`, { headers }))
          .status,
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
