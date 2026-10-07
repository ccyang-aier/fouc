import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const root = process.cwd(), env = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
const pg = new URL(env.DATABASE_ADMIN_URL), mysql = JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8'));
const sources = [
  ['mysql', { ...mysql, provider: 'mysql', ssl: false }, mysql.database],
  ['postgres', { provider: 'postgres', host: pg.hostname, port: Number(pg.port), username: decodeURIComponent(pg.username), password: decodeURIComponent(pg.password), database: 'fouc_datastore_lab', ssl: false }, 'public'],
  ['sqlite', { provider: 'sqlite', path: root + '/.runtime/dbx-lab/relational.sqlite' }, 'main'],
];
const base = 'http://127.0.0.1:8710/api/database/relational/sessions';
async function api(path, body, method = body ? 'POST' : 'GET', expected = 200) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json(); assert.equal(response.status, expected, payload.error?.message); return payload.data;
}
async function terminal(sessionId, snapshot, limit = 12000) {
  const start = Date.now();
  while (['running', 'cancelling'].includes(snapshot.status)) {
    assert.ok(Date.now() - start < limit, 'native query reached terminal state within deadline');
    await new Promise((resolve) => setTimeout(resolve, 80));
    snapshot = (await api(`/${sessionId}/executions/${snapshot.id}`)).execution;
  }
  return snapshot;
}
for (const [provider, config, schema] of sources) {
  const session = await api('', config, 'POST', 201), id = session.id;
  let otherSession;
  try {
    const run = (sql, extra = {}) => api(`/${id}/executions`, { sql, schema, ...extra }, 'POST', 201);
    const result = await terminal(id, await run("SELECT 'first; result' AS label;\n-- kept comment\nSELECT 9007199254740993 AS exact_value;", { offset: 17 }));
    assert.equal(result.status, 'completed'); assert.equal(result.completedCount, 2);
    assert.deepEqual(result.statements.map((item) => item.status), ['succeeded', 'succeeded']);
    assert.equal(result.statements[0].from, 17); assert.equal(result.statements[0].result.rows[0][0], 'first; result');
    assert.equal(result.statements[1].result.rows[0][0], '9007199254740993');
    assert.equal((await api(`/${id}/executions/${result.id}?revision=${result.revision}`)).execution, null);
    otherSession = await api('', config, 'POST', 201);
    await api(`/${otherSession.id}/executions/${result.id}`, undefined, 'GET', 400);
    await api(`/${otherSession.id}/executions/${result.id}/cancel`, {}, 'POST', 400);
    await api(`/${id}/executions/${result.id}`.replace(`/${id}`, `/missing-${id}`), undefined, 'GET', 400);
    await api(`/${id}/executions`, { sql: 'SELECT 1; DELETE FROM dbx_filter_fixture', schema }, 'POST', 400);
    if (provider === 'mysql') {
      await api(`/${id}/executions`, { sql: 'SELECT 1; /*! DROP TABLE dbx_filter_fixture */', schema }, 'POST', 400);
      const quoted = await terminal(id, await run("SELECT '/*! literal ; */' AS protected_text"));
      assert.equal(quoted.statements[0].result.rows[0][0], '/*! literal ; */');
    }
    const failure = await terminal(id, await run('SELECT 1 AS kept; SELECT missing_execution_field FROM dbx_filter_fixture; SELECT 3 AS skipped'));
    assert.equal(failure.status, 'failed'); assert.deepEqual(failure.statements.map((item) => item.status), ['succeeded', 'failed', 'skipped']);
    assert.equal(String(failure.statements[0].result.rows[0][0]), '1'); assert.ok(failure.statements[1].error.message);
    if (provider === 'postgres') {
      const source = "SELECT '😀' AS label, absent_execution_field FROM dbx_filter_fixture";
      const diagnostic = await terminal(id, await run(source));
      assert.equal(diagnostic.statements[0].error.position, source.indexOf('absent_execution_field'), 'native error positions remove cursor wrapper and count UTF-16');
    }
    const longSql = provider === 'mysql'
      ? 'WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<999) SELECT COUNT(*) FROM seq a JOIN seq b ON TRUE JOIN seq c ON TRUE'
      : 'WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<100000000) SELECT COUNT(*) FROM seq';
    let running = await run(`SELECT 42 AS completed_before_cancel; ${longSql}; SELECT 99 AS never_run`);
    const waitStart = Date.now();
    while (running.statements[1].status !== 'running') {
      assert.ok(Date.now() - waitStart < 5000); await new Promise((resolve) => setTimeout(resolve, 60));
      running = (await api(`/${id}/executions/${running.id}`)).execution;
      assert.ok(['running', 'cancelling'].includes(running.status), running.statements[1].error?.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal((await fetch('http://127.0.0.1:8710/health')).status, 200, 'SQLite work does not block the device HTTP loop');
    const cancelStart = Date.now(); running = await api(`/${id}/executions/${running.id}/cancel`, {}, 'POST');
    const cancelled = await terminal(id, running, 6000);
    assert.equal(cancelled.status, 'cancelled'); assert.deepEqual(cancelled.statements.map((item) => item.status), ['succeeded', 'cancelled', 'skipped']);
    assert.equal(String(cancelled.statements[0].result.rows[0][0]), '42'); assert.ok(Date.now() - cancelStart < 6000);
    assert.equal(String((await terminal(id, await run('SELECT 7 AS after_cancel'))).statements[0].result.rows[0][0]), '7');
    const closing = await run(longSql);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await api(`/${id}`, undefined, 'DELETE');
    await api(`/${id}/executions/${closing.id}`, undefined, 'GET', 400);
    console.log(`PASS ${provider}: native multi-results, exact integer/offsets, unchanged-revision response, owned execution, full-batch read policy, stop-on-error, confirmed cancellation with prior results, live device loop, pool reuse and disconnect interruption.`);
  } finally {
    if (otherSession) await fetch(base + '/' + otherSession.id, { method: 'DELETE' });
    await fetch(base + '/' + id, { method: 'DELETE' });
  }
}
