import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const require = createRequire(new URL('../backend/device/package.json', import.meta.url));
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const admin = new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).DATABASE_ADMIN_URL);
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
const scope = 'dbx-table-query-live-verification';
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
const fixture = [
  { id: '1', name: 'Alpha', score: '10', note: null, bucket: 'g1' },
  { id: '2', name: 'Beta', score: null, note: '', bucket: 'g1' },
  { id: '3', name: 'Gamma', score: '20', note: 'hello', bucket: 'g2' },
  { id: '4', name: '中文', score: '10', note: '世界', bucket: 'g2' },
  { id: '9007199254740993', name: 'A%_like', score: '30', note: "quote'; OR 1=1 --", bucket: 'g3' },
  { id: '6', name: '', score: '5', note: 'hello', bucket: 'g2' },
];
const condition = (column, operator, value, endValue) => ({
  kind: 'condition',
  column,
  operator,
  value,
  endValue,
});
for (const config of configurations) {
  const schema =
    config.provider === 'postgres' ? 'public' : config.provider === 'mysql' ? config.database : 'main';
  if (config.provider === 'postgres') {
    assert.equal(config.database, 'fouc_datastore_lab');
    const seed = new Pool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    try {
      await seed.query(
        'CREATE TABLE IF NOT EXISTS dbx_filter_fixture (id bigint PRIMARY KEY, name text NOT NULL, score numeric, note text, bucket text, metadata jsonb, payload bytea)',
      );
      await seed.query('CREATE TABLE IF NOT EXISTS dbx_page_fixture (id bigint PRIMARY KEY, name text NOT NULL)');
    } finally {
      await seed.end();
    }
  } else if (config.provider === 'mysql') {
    assert.equal(config.database, 'fouc_datastore_lab');
    const seed = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    try {
      await seed.query(
        'CREATE TABLE IF NOT EXISTS dbx_filter_fixture (id BIGINT PRIMARY KEY, name VARCHAR(200) NOT NULL, score DECIMAL(20,4), note TEXT, bucket VARCHAR(30), metadata JSON, payload BLOB) ENGINE=InnoDB',
      );
      await seed.query('CREATE TABLE IF NOT EXISTS dbx_page_fixture (id BIGINT PRIMARY KEY, name VARCHAR(200) NOT NULL) ENGINE=InnoDB');
    } finally {
      await seed.end();
    }
  } else {
    assert.equal(config.path, path.resolve('.runtime/dbx-lab/relational.sqlite'));
    const seed = new DatabaseSync(config.path);
    try {
      seed.exec(
        'CREATE TABLE IF NOT EXISTS dbx_filter_fixture (id INTEGER PRIMARY KEY, name TEXT NOT NULL, score NUMERIC, note TEXT, bucket TEXT, metadata JSON, payload BLOB)',
      );
      seed.exec('CREATE TABLE IF NOT EXISTS dbx_page_fixture (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    } finally {
      seed.close();
    }
  }
  const session = await request('/sessions', config, 'POST', 201);
  const sessionBase = `/sessions/${session.id}`;
  const route = `${sessionBase}/schemas/${schema}/tables/dbx_filter_fixture/rows`;
  const query = (filter = null, sort = [], offset = 0, limit = 100) =>
    request(route, { filter, sort, offset, limit });
  const ids = async (filter, sort, offset, limit) =>
    (await query(filter, sort, offset, limit)).rows.map((row) => String(row[0]));
  try {
    await request(sessionBase + '/write-access', { enabled: true }, 'PUT');
    const pageRoute = `${sessionBase}/schemas/${schema}/tables/dbx_page_fixture/rows`;
    const oldPageRows = (await request(pageRoute)).rows;
    if (oldPageRows.length) {
      const remove = await request(sessionBase + '/save-plans', { schema, table: 'dbx_page_fixture', changes: oldPageRows.map(original => ({ kind: 'delete', original })) }, 'POST', 201);
      await request(sessionBase + `/save-plans/${remove.id}/commit`, { confirm: true });
    }
    const insertPage = await request(sessionBase + '/save-plans', { schema, table: 'dbx_page_fixture', changes: Array.from({ length: 30 }, (_, index) => ({ kind: 'insert', values: { id: String(index + 1), name: `Page row ${String(index + 1).padStart(2,'0')}` } })) }, 'POST', 201);
    await request(sessionBase + `/save-plans/${insertPage.id}/commit`, { confirm: true });
    const existing = (await query()).rows;
    if (existing.length) {
      const plan = await request(
        sessionBase + '/save-plans',
        {
          schema,
          table: 'dbx_filter_fixture',
          changes: existing.map((original) => ({ kind: 'delete', original })),
        },
        'POST',
        201,
      );
      await request(sessionBase + `/save-plans/${plan.id}/commit`, { confirm: true });
    }
    const plan = await request(
      sessionBase + '/save-plans',
      {
        schema,
        table: 'dbx_filter_fixture',
        changes: fixture.map((values) => ({
          kind: 'insert',
          values: {
            ...values,
            metadata: { group: values.bucket, ready: true },
            payload: values.id === '1' ? { type: 'binary', base64: 'AP8=' } : null,
          },
        })),
      },
      'POST',
      201,
    );
    await request(sessionBase + `/save-plans/${plan.id}/commit`, { confirm: true });
    await request(sessionBase + '/write-access', { enabled: false }, 'PUT');
    for (const [filter, expected] of [
      [condition('note', 'is-null'), ['1']],
      [condition('note', 'is-not-null'), ['2', '3', '4', '6', '9007199254740993']],
      [condition('note', 'is-blank'), ['1', '2']],
      [condition('note', 'is-not-blank'), ['3', '4', '6', '9007199254740993']],
      [condition('note', 'equals', null), ['1']],
      [condition('note', 'not-equals', null), ['2', '3', '4', '6', '9007199254740993']],
      [condition('note', 'equals', "quote'; OR 1=1 --"), ['9007199254740993']],
      [condition('score', 'not-equals', '10'), ['3', '6', '9007199254740993']],
      [condition('note', 'like', 'ell'), ['3', '6']],
      [condition('note', 'not-like', 'ell'), ['2', '4', '9007199254740993']],
      [condition('name', 'begins-with', 'Al'), ['1']],
      [condition('name', 'ends-with', 'mma'), ['3']],
      [condition('score', 'less-than', '10'), ['6']],
      [condition('score', 'less-than-or-equal', '10'), ['1', '4', '6']],
      [condition('score', 'greater-than', '20'), ['9007199254740993']],
      [condition('score', 'greater-than-or-equal', '20'), ['3', '9007199254740993']],
      [
        { kind: 'condition', column: 'note', operator: 'in', values: [null, 'hello', 'hello'] },
        ['1', '3', '6'],
      ],
      [
        { kind: 'condition', column: 'note', operator: 'not-in', values: [null, 'hello'] },
        ['2', '4', '9007199254740993'],
      ],
      [condition('score', 'between', '10', '20'), ['1', '3', '4']],
      [condition('score', 'not-between', '10', '20'), ['6', '9007199254740993']],
      [condition('id', 'equals', '9007199254740993'), ['9007199254740993']],
      [condition('payload', 'equals', { type: 'binary', base64: 'AP8=' }), ['1']],
      [condition('metadata', 'equals', { group: 'g1', ready: true }), ['1', '2']],
      [
        {
          kind: 'group',
          join: 'and',
          children: [
            condition('bucket', 'equals', 'g2'),
            {
              kind: 'group',
              join: 'or',
              children: [condition('score', 'equals', '10'), condition('name', 'equals', 'Gamma')],
            },
          ],
        },
        ['3', '4'],
      ],
    ])
      assert.deepEqual(await ids(filter), expected, `${config.provider} ${JSON.stringify(filter)}`);
    const sort = [{ column: 'score', direction: 'asc', nulls: 'last' }];
    assert.deepEqual(await ids(null, sort), ['6', '1', '4', '3', '9007199254740993', '2']);
    assert.deepEqual(await ids(null, [{ column: 'score', direction: 'desc', nulls: 'first' }]), [
      '2',
      '9007199254740993',
      '3',
      '1',
      '4',
      '6',
    ]);
    assert.deepEqual(await ids(null, [...sort, { column: 'id', direction: 'desc', nulls: 'last' }]), [
      '6',
      '4',
      '1',
      '3',
      '9007199254740993',
      '2',
    ]);
    const paged = await query(null, sort, 0, 2);
    assert.equal(paged.hasMore, true);
    assert.equal(paged.stableOrder, true);
    assert.deepEqual(
      [...(await ids(null, sort, 0, 2)), ...(await ids(null, sort, 2, 2)), ...(await ids(null, sort, 4, 2))],
      ['6', '1', '4', '3', '9007199254740993', '2'],
    );
    const preview = await request(route + '/preview', {
      filter: condition('note', 'equals', "quote'; OR 1=1 --"),
      sort,
      offset: 0,
      limit: 25,
    });
    assert.equal(preview.statement.sql.includes('OR 1=1'), false);
    assert.deepEqual(preview.statement.parameters, ["quote'; OR 1=1 --"]);
    for (const bad of [
      { filter: condition('does_not_exist', 'equals', 'x'), sort: [] },
      { filter: { kind: 'condition', column: 'id', operator: 'DELETE' }, sort: [] },
      { filter: null, sort: [...sort, ...sort] },
      { filter: { kind: 'condition', column: 'id', operator: 'in', values: [] }, sort: [] },
      { filter: condition('id', 'equals', 9007199254740992), sort: [] },
    ])
      await request(route, bad, 'POST', 400);
    const foreign = await fetch(base.replace(scope, 'other-workspace') + route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filter: null, sort: [] }),
    });
    assert.equal(foreign.status, 400);
    console.log(
      `PASS table query ${config.provider}: 18 operators, nested AND/OR, NULL/blank/list/range semantics, exact bigint/JSON/binary, injection-safe previews, multi-sort/NULL order, stable pagination, invalid-input and workspace rejection.`,
    );
  } finally {
    await request(sessionBase, null, 'DELETE');
  }
}
