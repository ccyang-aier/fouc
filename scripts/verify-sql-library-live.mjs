import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';
const admin = new URL(parseEnv(readFileSync('.env.fouc.local', 'utf8')).DATABASE_ADMIN_URL);
const mysql = JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8'));
const workspace = 'dbx-sql-library-verification', base = `http://127.0.0.1:8710/api/database/workspaces/${workspace}/relational`;
async function request(route, { body, method = body ? 'POST' : 'GET', status = 200, foreign = false } = {}) {
  const response = await fetch((foreign ? base.replace(workspace, 'other-sql-workspace') : base) + route, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const result = await response.json(); assert.equal(response.status, status, result.error?.message); return result.data ?? result.error;
}
const inputs = [
  { config: { provider: 'mysql', host: mysql.host, port: mysql.port, username: mysql.username, database: mysql.database, ssl: false }, password: mysql.password, schema: mysql.database },
  { config: { provider: 'postgres', host: admin.hostname, port: Number(admin.port), username: decodeURIComponent(admin.username), database: 'fouc_datastore_lab', ssl: false }, password: decodeURIComponent(admin.password), schema: 'public' },
  { config: { provider: 'sqlite', path: path.resolve('.runtime/dbx-lab/relational.sqlite') }, password: '', schema: 'main' },
];
for (const { config, password, schema } of inputs) {
  const saved = await request('/connections', { body: { name: `${config.provider} SQL library verifier`, config }, status: 201 }); let session;
  const library = `/connections/${saved.id}/sql-library`, sql = "-- 中文 and exact integer\nSELECT 9007199254740993 AS integer_value;";
  try {
    session = await request(`/connections/${saved.id}/connect`, { body: { password }, status: 201 }); assert.equal(session.connectionId, saved.id);
    const historyBase = `/sessions/${session.id}/history`;
    await request(`/sessions/${session.id}/query`, { body: { sql, schema, maxRows: 1 } });
    await request(`/sessions/${session.id}/query`, { body: { sql: 'SELECT * FROM fouc_sql_library_nonexistent_fixture', schema }, status: 502 });
    await request(`/sessions/${session.id}/query`, { body: { sql: 'DROP TABLE products', schema }, status: 400 });
    let history = await request(historyBase + '/search', { body: {} }); assert.equal(history.total, 2); assert.equal(history.persistent, true);
    const original = history.entries.find((entry) => entry.success); assert.equal((await request(historyBase + `/${original.id}`)).sql, sql); assert.ok(history.entries.some((entry) => !entry.success && entry.error));
    const filtered = await request(historyBase + '/search', { body: { success: true, search: 'exact integer', schema } }); assert.equal(filtered.total, 1);
    assert.equal((await request('/history/search', { body: { databases: [{ connectionId: saved.id, database: config.database ?? config.path }] } })).total, 2);
    await request(historyBase + `/${original.id}`, { foreign: true, status: 400 }); assert.equal((await request('/history/search', { body: {}, foreign: true })).total, 0);
    const folder = await request(library + '/folders', { body: { name: 'Queries', parentFolderId: null }, status: 201 });
    const nested = await request(library + '/folders', { body: { name: 'Nested', parentFolderId: folder.id }, status: 201 });
    await request(library + `/folders/${folder.id}`, { method: 'PUT', body: { name: 'Queries', parentFolderId: nested.id }, status: 400 });
    let file = await request(library + '/files', { body: { name: 'integer', folderId: nested.id, database: config.database ?? config.path, schema, sql }, status: 201 });
    assert.equal(file.name, 'integer.sql'); assert.equal(file.sql, sql); assert.equal(file.sqlBytes, Buffer.byteLength(sql));
    const summary = await request(library); assert.equal(summary.files.length, 1); assert.ok(!('sql' in summary.files[0]));
    assert.equal((await request(library + `/files/${file.id}/open`, { method: 'POST' })).openCount, 1);
    await request(library + `/files/${file.id}`, { foreign: true, status: 400 });
    const before = file;
    file = await request(library + `/files/${file.id}`, { method: 'PUT', body: { version: file.version, name: 'renamed' } }); assert.equal(file.sql, sql);
    await request(library + `/files/${file.id}`, { method: 'PUT', body: { version: before.version, sql: 'SELECT 0' }, status: 400 });
    await request(library + '/files', { body: { name: 'RENAMED.SQL', folderId: nested.id, database: config.database ?? config.path, schema, sql }, status: 400 });
    await request(`/sessions/${session.id}`, { method: 'DELETE' }); session = await request(`/connections/${saved.id}/connect`, { body: { password }, status: 201 });
    assert.equal((await request(`/sessions/${session.id}/history/search`, { body: {} })).total, 2); assert.equal((await request(library + `/files/${file.id}`)).sql, sql);
    await request(`/sessions/${session.id}/history`, { method: 'DELETE', body: { confirmed: false }, status: 400 });
    await request(`/sessions/${session.id}/history`, { method: 'DELETE', body: { confirmed: true } }); assert.equal((await request(`/sessions/${session.id}/history/search`, { body: {} })).total, 0);
    await request(library + `/folders/${folder.id}`, { method: 'DELETE', body: { confirmed: true } }); assert.deepEqual(await request(library), { folders: [], files: [] });
    console.log(`PASS ${config.provider}: actual execution/failure vs rejected-policy history, exact SQL+target, search/status/schema, connection-scoped database and foreign workspace guards, lazy SQL tree/documents, names/CAS/recursive deletion, persistence across reconnect and clear confirmation.`);
  } finally {
    if (session) await request(`/sessions/${session.id}`, { method: 'DELETE' }).catch(() => {});
    await request(`/connections/${saved.id}`, { method: 'DELETE' });
  }
}
