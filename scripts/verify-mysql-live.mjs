import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(new URL('../backend/device/package.json', import.meta.url));
const mysql = require('mysql2/promise');
const input = JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8'));
assert.equal(input.database, 'fouc_datastore_lab');
assert.equal(input.username, 'fouc_lab');
const seed = await mysql.createConnection({
  host: input.host,
  port: input.port,
  database: input.database,
  password: input.password,
  user: input.username,
  multipleStatements: false,
});
try {
  await seed.query(`CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY, name VARCHAR(200) NOT NULL, price DECIMAL(20,4), metadata JSON,
    payload BLOB, display_name VARCHAR(220) GENERATED ALWAYS AS (CONCAT(name, ' · item')) STORED
  )`);
  await seed.query(`INSERT INTO products(id,name,price,metadata,payload) VALUES
    (1,'MySQL 工作台',12.3400,'{"ready":true}',X'00ff'),(9007199254740993,'大整数',NULL,NULL,NULL)
    AS incoming ON DUPLICATE KEY UPDATE name=incoming.name`);
  await seed.query('CREATE OR REPLACE VIEW product_names AS SELECT id,name FROM products');
  await seed.query('CREATE TABLE IF NOT EXISTS `quoted``table` (`quoted``column` INT PRIMARY KEY)');
  await seed.query('INSERT IGNORE INTO `quoted``table` VALUES(7)');
} finally {
  await seed.end();
}

const base = `http://127.0.0.1:8710/api/database/relational`;
async function request(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + route, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(40000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${route}: ${response.status} ${result.error?.message}`);
  return result.data;
}
const { password, ...config } = input;
const saved = await request('/connections', { name: 'MySQL verification', config });
let session;
try {
  assert.equal('password' in saved.config, false);
  session = await request(`/connections/${saved.id}/connect`, { password });
  assert.equal(session.provider, 'mysql');
  assert.equal((await request(`/sessions/${session.id}`)).id, session.id);
  assert.ok((await request(`/sessions/${session.id}/schemas`)).includes(input.database));
  const tables = await request(`/sessions/${session.id}/schemas/${input.database}/tables`);
  assert.equal(tables.find((table) => table.name === 'product_names').kind, 'view');
  const page = await request(
    `/sessions/${session.id}/schemas/${input.database}/tables/products/rows?limit=1`,
  );
  assert.equal(page.rows.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(page.rows[0][2], '12.3400');
  assert.deepEqual(page.rows[0][3], { ready: true });
  assert.deepEqual(page.rows[0][4], { type: 'binary', base64: 'AP8=' });
  assert.ok(page.columns.some((column) => column.isPrimaryKey));
  assert.match(page.columns.find((column) => column.name === 'display_name').extra, /GENERATED/);
  const query = (sql) =>
    request(`/sessions/${session.id}/query`, { schema: input.database, sql, maxRows: 2 });
  assert.equal((await query('SELECT id FROM products ORDER BY id')).rows[1][0], '9007199254740993');
  const duplicate = await query('SELECT 1 AS x, 2 AS x');
  assert.deepEqual(duplicate.columns, ['x', 'x']);
  assert.deepEqual(duplicate.rows, [['1', '2']]);
  assert.equal(
    (
      await request(
        `/sessions/${session.id}/schemas/${input.database}/tables/${encodeURIComponent('quoted`table')}/rows`,
      )
    ).rows[0][0],
    7,
  );
  for (const sql of [
    'DELETE FROM products',
    "SELECT 1--1+GET_LOCK('fouc_test',0)",
    'SELECT application.ABS(1)',
    'SELECT SLEEP(1)',
  ]) {
    const response = await fetch(base + `/sessions/${session.id}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schema: input.database, sql }),
    });
    assert.equal(response.status, 400, sql);
  }
  for (const route of [
    `/sessions/${session.id}`,
    `/sessions/${session.id}/schemas`,
    `/connections/${saved.id}/connect`,
  ]) {
    const response = await fetch(base + route.replace(/^\/(sessions|connections)\/[^/]+/, (_, kind) => `/${kind}/${crypto.randomUUID()}`), {
      ...(route.endsWith('connect')
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
          }
        : {}),
    });
    assert.equal(response.status, 400);
  }
  const withoutDatabase = await request('/sessions', { ...input, database: '' });
  await request(`/sessions/${withoutDatabase.id}`, null, 'DELETE');
  console.log(
    'PASS MySQL: real connection CRUD/session identity, database/table/view/generated metadata, pagination, exact bigint/decimal/JSON/binary values, duplicate and quoted columns, unsafe SQL rejection, session ownership, optional default database.',
  );
} finally {
  if (session) await request(`/sessions/${session.id}`, null, 'DELETE');
  await request(`/connections/${saved.id}`, null, 'DELETE');
}
