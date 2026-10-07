import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';
const environment = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
const admin = new URL(environment.DATABASE_ADMIN_URL), mysql = JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8'));
const base = `http://127.0.0.1:8710/api/database/relational`;
async function request(route, body, method = body ? 'POST' : 'GET', status = 200, missingResource = false) {
  const response = await fetch(base + (missingResource ? route.replace(/^\/(sessions|connections)\/[^/]+/, (_, kind) => `/${kind}/${crypto.randomUUID()}`) : route), { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const result = await response.json(); assert.equal(response.status, status, result.error?.message); return result.data;
}
const inputs = [
  { config: { provider: 'mysql', host: mysql.host, port: mysql.port, username: mysql.username, database: mysql.database, ssl: false }, password: mysql.password, schema: mysql.database },
  { config: { provider: 'postgres', host: admin.hostname, port: Number(admin.port), username: decodeURIComponent(admin.username), database: 'fouc_datastore_lab', ssl: false }, password: decodeURIComponent(admin.password), schema: 'public' },
  { config: { provider: 'sqlite', path: path.resolve('.runtime/dbx-lab/relational.sqlite') }, password: '', schema: 'main' },
];
for (const { config, password, schema } of inputs) {
  const connection = await request('/connections', { name: `${config.provider} SQL draft verifier`, config }, 'POST', 201);
  const route = `/connections/${connection.id}/sql-library/drafts`; let session;
  try {
    session = await request(`/connections/${connection.id}/connect`, { password }, 'POST', 201);
    const objectRoot = `/sessions/${session.id}/schemas/${encodeURIComponent(schema)}/tables`;
    const objects = await request(objectRoot), metadataNames = ['dbx_filter_fixture', ...objects.filter((item) => /[\s`"']/u.test(item.name)).map((item) => item.name)];
    const historyBefore = await request(`/sessions/${session.id}/history/search`, {});
    for (const table of metadataNames) {
      const object = `${objectRoot}/${encodeURIComponent(table)}`;
      const columns = await request(object + '/columns');
      assert.ok(columns.length); assert.ok(columns.every((column) => typeof column.name === 'string' && typeof column.dataType === 'string'));
      if (table === 'dbx_filter_fixture') assert.ok(columns.some((column) => column.name === 'id' && column.isPrimaryKey));
      assert.deepEqual(columns, (await request(object + '/structure')).columns);
      await request(object + '/columns', undefined, 'GET', 400, true);
    }
    await request(objectRoot + '/missing_metadata_fixture/columns', undefined, 'GET', 400);
    assert.deepEqual(await request(`/sessions/${session.id}/history/search`, {}), historyBefore);
    console.log(`PASS ${config.provider}: read-only native column metadata matches full structure, quoted object names, missing object and session boundaries; no user-query history side effects.`);
    const tab = { id: crypto.randomUUID(), title: '中文草稿', customTitle: true, pinned: true, database: session.database, schema, sql: '-- Unicode\nSELECT 9007199254740993 AS exact_value;', originalSql: '', savedFile: null, editorPosition: { anchor: 1, head: 6, scrollTop: 66, scrollLeft: 0 }, resultView: 'json' };
    const initial = await request(route); assert.deepEqual(initial.tabs, []);
    const first = await request(route, { tabs: [tab], activeTabId: tab.id, version: initial.version }, 'PUT');
    const second = { ...tab, id: crypto.randomUUID(), title: 'Empty SQL file draft', sql: '', savedFile: { id: 'not-a-file', version: 'old', name: 'query.sql', folderId: null } };
    const next = await request(route, { tabs: [tab, second], activeTabId: second.id, version: first.version }, 'PUT');
    await request(route, { tabs: [tab], activeTabId: tab.id, version: first.version }, 'PUT', 400);
    await request(route, undefined, 'GET', 400, true); await request(route, { ...next }, 'PUT', 400, true);
    assert.deepEqual(await request(route), next);
    await request(`/sessions/${session.id}/query`, { sql: tab.sql, schema });
    await request(`/sessions/${session.id}`, undefined, 'DELETE'); session = await request(`/connections/${connection.id}/connect`, { password }, 'POST', 201);
    assert.deepEqual(await request(route), next);
    const emptied = await request(route, { tabs: [], activeTabId: null, version: next.version }, 'PUT'); assert.equal(emptied.tabs.length, 0); assert.ok(emptied.version);
    console.log(`PASS ${config.provider}: real native execution, ordered/pinned multi-tab target+exact source+empty draft/position/view, CAS and missing-connection rejection, reconnect restore and explicit empty state.`);
  } finally {
    if (session) await request(`/sessions/${session.id}`, undefined, 'DELETE');
    await request(`/connections/${connection.id}`, undefined, 'DELETE');
    await request(route, undefined, 'GET', 400);
  }
}
