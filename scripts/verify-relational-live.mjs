import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const environment = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
const admin = new URL(environment.DATABASE_ADMIN_URL);
const base = `http://127.0.0.1:8710/api/database/relational`;
function postgresTool(command, args, input) {
  const dockerArgs = ['exec', ...(input ? ['-i'] : []), 'fouc-knowledge-dev-postgres-1', command, '-U', environment.FOUC_POSTGRES_USER, ...args];
  return execFileSync(process.platform === 'win32' ? 'wsl.exe' : 'docker', process.platform === 'win32'
    ? ['-d', environment.KNOWLEDGE_WSL_DISTRO ?? 'Ubuntu-22.04', '--exec', 'docker', ...dockerArgs] : dockerArgs,
  { input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}
// A dedicated lab database keeps device connector validation independent of
// Fouc account/resource tables. Existing application data is never reset.
if (postgresTool('psql', ['-d', 'postgres', '-tAc', "SELECT datname FROM pg_database WHERE datname='fouc_datastore_lab'"]).trim() !== 'fouc_datastore_lab') {
  postgresTool('createdb', ['fouc_datastore_lab']);
}
postgresTool('psql', ['-d', 'fouc_datastore_lab', '-v', 'ON_ERROR_STOP=1'], `
CREATE TABLE IF NOT EXISTS public.products (id bigint PRIMARY KEY, name text NOT NULL, price numeric(20,4), metadata jsonb, payload bytea, display_name text GENERATED ALWAYS AS (name || ' · item') STORED);
INSERT INTO public.products (id,name,price,metadata,payload) VALUES (1,'数据库工作台',12.3400,'{"ready":true}',decode('00ff','hex')),(9007199254740993,'大整数',NULL,NULL,NULL) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name;
`);
mkdirSync('.runtime/dbx-lab', { recursive: true });
const sqlitePath = path.resolve('.runtime/dbx-lab/relational.sqlite');
const sqlite = new DatabaseSync(sqlitePath);
sqlite.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price NUMERIC);
  INSERT INTO products VALUES(1,'SQLite 工作台',12.34),(9007199254740993,'大整数',NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name;`);
sqlite.close();

async function request(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(40000) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${route}: ${response.status} ${result.error?.message}`);
  return result.data;
}

for (const config of [
  { provider: 'postgres', host: admin.hostname, port: Number(admin.port), username: decodeURIComponent(admin.username), database: 'fouc_datastore_lab', ssl: false },
  { provider: 'sqlite', path: sqlitePath },
]) {
  const saved = await request('/connections', { name: `${config.provider} verification`, config });
  let session;
  try {
    session = await request(`/connections/${saved.id}/connect`, { password: decodeURIComponent(admin.password) });
    assert.equal(session.provider, config.provider);
    const schema = config.provider === 'postgres' ? 'public' : 'main';
    assert.ok((await request(`/sessions/${session.id}/schemas`)).includes(schema));
    assert.ok((await request(`/sessions/${session.id}/schemas/${schema}/tables`)).some((table) => table.name === 'products'));
    const page = await request(`/sessions/${session.id}/schemas/${schema}/tables/products/rows?limit=1`);
    assert.equal(page.rows.length, 1);
    assert.equal(page.hasMore, true);
    assert.ok(page.columns.some((column) => column.isPrimaryKey));
    const result = await request(`/sessions/${session.id}/query`, { schema, sql: 'SELECT id, name, price FROM products ORDER BY id', maxRows: 2 });
    assert.equal(result.rows[1][0], '9007199254740993');
    assert.equal(result.hasMore, false);
    const duplicate = await request(`/sessions/${session.id}/query`, { schema, sql: 'SELECT 1 AS x, 2 AS x', maxRows: 1 });
    assert.deepEqual(duplicate.columns, ['x', 'x']);
    assert.deepEqual(duplicate.rows, [[1, 2]]);
    const unsafe = await fetch(base + `/sessions/${session.id}/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema, sql: 'DELETE FROM products' }) });
    assert.equal(unsafe.status, 400);
    if (config.provider === 'postgres') {
      const stateful = await fetch(base + `/sessions/${session.id}/query`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema, sql: 'SELECT pg_advisory_lock(1)' }) });
      assert.equal(stateful.status, 400);
    }
    const escaped = await fetch(base + `/sessions/${crypto.randomUUID()}/schemas`);
    assert.equal(escaped.status, 400);
    console.log(`PASS ${config.provider}: connection CRUD, identity, schemas/tables/columns, primary-key pagination, SQL, duplicate columns, bigint precision, write rejection, session ownership.`);
  } finally {
    if (session) await request(`/sessions/${session.id}`, null, 'DELETE');
    await request(`/connections/${saved.id}`, null, 'DELETE');
  }
}
