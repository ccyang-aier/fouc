import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const require = createRequire(new URL('../backend/device/package.json', import.meta.url));
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const environment = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
const admin = new URL(environment.DATABASE_ADMIN_URL);
const configurations = [
  {
    provider: 'postgres',
    host: admin.hostname,
    port: Number(admin.port),
    username: decodeURIComponent(admin.username),
    password: decodeURIComponent(admin.password),
    database: 'fouc_datastore_lab',
    ssl: false,
  },
  JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8')),
  { provider: 'sqlite', path: path.resolve('.runtime/dbx-lab/relational.sqlite') },
];
const scope = 'dbx-table-save-live-verification';
const base = `http://127.0.0.1:8710/api/database/workspaces/${scope}/relational`;
async function request(route, body, method = body ? 'POST' : 'GET', expected = 200) {
  const response = await fetch(base + route, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(40000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${route}: ${result.error?.message ?? ''}`);
  return result.data;
}

for (const config of configurations) {
  const schema =
    config.provider === 'postgres' ? 'public' : config.provider === 'sqlite' ? 'main' : config.database;
  // Only this explicitly named lab fixture is created/reset. No application
  // database, table, Redis keyspace or persistent connection is modified.
  if (config.provider === 'postgres') {
    assert.equal(config.database, 'fouc_datastore_lab');
    const seed = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      password: config.password,
      user: config.username,
    });
    try {
      await seed.query(
        `CREATE TABLE IF NOT EXISTS public.dbx_save_fixture (id bigint PRIMARY KEY, name text NOT NULL, price numeric(20,4), metadata jsonb, payload bytea, label text GENERATED ALWAYS AS (name || ' · generated') STORED)`,
      );
      await seed.query('DELETE FROM public.dbx_save_fixture WHERE id IN (1,2,3,9007199254740993)');
      await seed.query(
        'CREATE TABLE IF NOT EXISTS public.dbx_unique_fixture (id bigint PRIMARY KEY, code text, included text, a int, b int, UNIQUE(a,b))',
      );
      await seed.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS dbx_unique_with_include ON public.dbx_unique_fixture(code) INCLUDE(included)',
      );
    } finally {
      await seed.end();
    }
  } else if (config.provider === 'mysql') {
    assert.equal(config.database, 'fouc_datastore_lab');
    assert.equal(config.username, 'fouc_lab');
    const seed = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      password: config.password,
      user: config.username,
    });
    try {
      await seed.query(
        `CREATE TABLE IF NOT EXISTS dbx_save_fixture (id BIGINT PRIMARY KEY, name VARCHAR(200) NOT NULL, price DECIMAL(20,4), metadata JSON, payload BLOB, label VARCHAR(220) GENERATED ALWAYS AS (CONCAT(name,' · generated')) STORED) ENGINE=InnoDB`,
      );
      await seed.query('DELETE FROM dbx_save_fixture WHERE id IN (1,2,3,9007199254740993)');
      await seed.query(
        'CREATE TABLE IF NOT EXISTS dbx_unique_fixture (id BIGINT PRIMARY KEY, code VARCHAR(100) UNIQUE, included VARCHAR(100), a INT, b INT, UNIQUE(a,b))',
      );
    } finally {
      await seed.end();
    }
  } else {
    assert.equal(config.path, path.resolve('.runtime/dbx-lab/relational.sqlite'));
    const seed = new DatabaseSync(config.path);
    try {
      seed.exec(
        `CREATE TABLE IF NOT EXISTS dbx_save_fixture (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price NUMERIC, metadata JSON, payload BLOB, label TEXT GENERATED ALWAYS AS (name || ' · generated') STORED); DELETE FROM dbx_save_fixture WHERE id IN (1,2,3,9007199254740993)`,
      );
      seed.exec(
        'CREATE TABLE IF NOT EXISTS dbx_unique_fixture (id INTEGER PRIMARY KEY, code TEXT UNIQUE, included TEXT, a INTEGER, b INTEGER, UNIQUE(a,b))',
      );
    } finally {
      seed.close();
    }
  }
  const session = await request('/sessions', config, 'POST', 201);
  const sessionBase = `/sessions/${session.id}`;
  const prepare = (changes) =>
    request(sessionBase + '/save-plans', { schema, table: 'dbx_save_fixture', changes }, 'POST', 201);
  const commit = (plan) => request(sessionBase + `/save-plans/${plan.id}/commit`, { confirm: true });
  const rows = async () =>
    (await request(sessionBase + `/schemas/${schema}/tables/dbx_save_fixture/rows`)).rows;
  try {
    const unique = await request(sessionBase + `/schemas/${schema}/tables/dbx_unique_fixture/rows`);
    assert.equal(unique.columns.find((column) => column.name === 'code').isUnique, true);
    for (const name of ['included', 'a', 'b'])
      assert.equal(
        unique.columns.find((column) => column.name === name).isUnique,
        false,
        `Incorrect unique key: ${name}`,
      );
    await request(
      sessionBase + '/save-plans',
      {
        schema,
        table: 'dbx_save_fixture',
        changes: [{ kind: 'insert', values: { id: 1, name: 'initial' } }],
      },
      'POST',
      400,
    );
    assert.equal(
      (await request(sessionBase + '/write-access', { enabled: true }, 'PUT')).capabilities.capabilities
        .tableDataEdit,
      true,
    );
    const text = "引号 ' ; DROP TABLE dbx_save_fixture; --";
    const insert = await prepare([
      {
        kind: 'insert',
        values: {
          id: '9007199254740993',
          name: text,
          price: '12.3400',
          metadata: { ready: true },
          payload: { type: 'binary', base64: 'AP8=' },
        },
      },
      { kind: 'insert', values: { id: 1, name: 'initial', price: null } },
    ]);
    assert.equal(insert.statements[0].sql.includes(text), false);
    assert.equal((await rows()).length, 0, 'Preview must never execute writes');
    await request(sessionBase + `/save-plans/${insert.id}/commit`, {}, 'POST', 400);
    const foreign = await fetch(
      base.replace(scope, 'other-workspace') + sessionBase + `/save-plans/${insert.id}/commit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      },
    );
    assert.equal(foreign.status, 400);
    assert.equal((await commit(insert)).affectedRows, 2);
    await request(sessionBase + `/save-plans/${insert.id}/commit`, { confirm: true }, 'POST', 400);
    const first = (await rows()).find((row) => String(row[0]) === '1');
    const exact = (await rows()).find((row) => String(row[0]) === '9007199254740993');
    assert.equal(exact[0], '9007199254740993');
    assert.equal(exact[1], text);
    assert.deepEqual(exact[4], { type: 'binary', base64: 'AP8=' });
    const update = await prepare([
      {
        kind: 'update',
        original: exact,
        values: { name: '', metadata: { next: [1, null] }, payload: { type: 'binary', base64: 'AAE=' } },
      },
    ]);
    assert.equal((await commit(update)).affectedRows, 1);
    assert.equal((await rows()).find((row) => String(row[0]) === '9007199254740993')[1], '');
    const stale = await prepare([
      { kind: 'insert', values: { id: 3, name: 'rollback' } },
      { kind: 'update', original: first, values: { name: 'stale' } },
    ]);
    await commit(await prepare([{ kind: 'update', original: first, values: { name: 'fresh' } }]));
    await request(sessionBase + `/save-plans/${stale.id}/commit`, { confirm: true }, 'POST', 400);
    assert.equal(
      (await rows()).some((row) => String(row[0]) === '3'),
      false,
      'Conflict must roll back earlier inserts',
    );
    const duplicate = await prepare([
      { kind: 'insert', values: { id: 2, name: 'rollback too' } },
      { kind: 'insert', values: { id: 1, name: 'duplicate key' } },
    ]);
    await request(sessionBase + `/save-plans/${duplicate.id}/commit`, { confirm: true }, 'POST', 502);
    assert.equal(
      (await rows()).some((row) => String(row[0]) === '2'),
      false,
      'Constraint failure must roll back earlier inserts',
    );
    await request(
      sessionBase + '/save-plans',
      {
        schema,
        table: 'dbx_save_fixture',
        changes: [{ kind: 'insert', values: { id: 2, name: 'invalid', label: 'generated' } }],
      },
      'POST',
      400,
    );
    await request(sessionBase + '/query', { schema, sql: 'DELETE FROM dbx_save_fixture' }, 'POST', 400);
    await commit(await prepare((await rows()).map((original) => ({ kind: 'delete', original }))));
    assert.equal((await rows()).length, 0);
    const revoked = await prepare([{ kind: 'insert', values: { id: 1, name: 'revoked' } }]);
    await request(sessionBase + '/write-access', { enabled: false }, 'PUT');
    await request(sessionBase + '/write-access', { enabled: true }, 'PUT');
    await request(sessionBase + `/save-plans/${revoked.id}/commit`, { confirm: true }, 'POST', 400);
    console.log(
      `PASS table save ${config.provider}: explicit unlock/confirmation, no-write preview, one-time/workspace-bound plans, parameter injection protection, exact bigint/JSON/binary, insert/update/delete, original-row conflict and constraint rollback, generated-column guard, write-lock invalidation, raw SQL remains read-only.`,
    );
  } finally {
    await request(sessionBase, null, 'DELETE');
  }
}
