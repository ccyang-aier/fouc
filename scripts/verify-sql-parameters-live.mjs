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
async function terminal(id, snapshot) {
  const start = Date.now();
  while (['running', 'cancelling'].includes(snapshot.status)) {
    assert.ok(Date.now() - start < 10000); await new Promise((resolve) => setTimeout(resolve, 60));
    snapshot = (await api(`/${id}/executions/${snapshot.id}`)).execution;
  }
  return snapshot;
}
for (const [provider, config, schema] of sources) {
  const session = await api('', config, 'POST', 201), id = session.id;
  const run = async (sql, extra = {}) => terminal(id, await api(`/${id}/executions`, { sql, schema, ...extra }, 'POST', 201));
  try {
    const sql = 'SELECT :name AS label, ${exact} AS exact_value, #{nil} AS missing, @enabled AS enabled, ? AS ordinal';
    const parameters = { name: { kind: 'string', value: "O'Reilly; SELECT 99 -- 😀" }, exact: { kind: 'number', value: '9007199254740993' }, nil: { kind: 'null', value: '' }, enabled: { kind: 'boolean', value: 'yes' }, '?1': { kind: 'number', value: '7' } };
    const result = await run(sql, { parameters, offset: 13 });
    assert.equal(result.status, 'completed', result.statements[0].error?.message);
    assert.deepEqual(result.statements[0].result.rows[0].slice(0, 3), [parameters.name.value, '9007199254740993', null]);
    assert.ok([true, 1, '1'].includes(result.statements[0].result.rows[0][3]));
    assert.equal(String(result.statements[0].result.rows[0][4]), '7');
    assert.equal(result.statements[0].sql, sql); assert.equal(result.statements[0].from, 13);
    const string = "C:\\new\\'quote; ${not_a_parameter}";
    const escaped = await run("SELECT 'prefix ${name}' AS embedded", { parameters: { name: { kind: 'string', value: string } } });
    assert.equal(escaped.status, 'completed', escaped.statements[0].error?.message);
    assert.equal(escaped.statements[0].result.rows[0][0], 'prefix ' + string);
    const variables = await run("@set ids = (1,2,3);\nSELECT id,name FROM dbx_filter_fixture WHERE id IN @ids ORDER BY id");
    assert.equal(variables.status, 'completed'); assert.equal(variables.statements[0].result.rows.length, 3);
    const currentSql = 'SELECT @tenant AS tenant';
    const context = await run(currentSql, { declarationSql: '@set tenant = 42;\nSELECT 123;\n' + currentSql });
    assert.equal(String(context.statements[0].result.rows[0][0]), '42'); assert.equal(context.statements.length, 1);
    const collectionSql = 'SELECT name FROM dbx_filter_fixture <where>AND id &lt; #{limit} AND name IN <foreach collection="names" item="name" open="(" close=")" separator=",">#{name}</foreach></where> ORDER BY name';
    const collection = await run(collectionSql, { parameters: { limit: { kind: 'number', value: '5' }, names: { kind: 'string', value: '["Alpha","Beta"]' } } });
    assert.equal(collection.status, 'completed', collection.statements[0].error?.message); assert.deepEqual(collection.statements[0].result.rows, [['Alpha'], ['Beta']]);
    await api(`/${id}/executions`, { sql: 'SELECT :n', schema, parameters: { n: { kind: 'number', value: '1; DELETE FROM dbx_filter_fixture' } } }, 'POST', 400);
    await api(`/${id}/executions`, { sql: 'SELECT :n', schema }, 'POST', 400);
    await api(`/${id}/executions`, { sql: 'SELECT 1; ${write}', schema, parameters: { write: { kind: 'raw', value: 'DELETE FROM dbx_filter_fixture' } } }, 'POST', 400);
    const raw = await run('${batch}', { parameters: { batch: { kind: 'raw', value: 'SELECT 1; SELECT 2' } } });
    assert.equal(raw.status, 'completed'); assert.equal(raw.statements.length, 2);
    assert.ok(raw.statements.every((item) => item.sql === '${batch}' && item.from === 0 && item.to === 8));
    if (provider === 'postgres') {
      const source = "SELECT :label, absent_parameter_field FROM dbx_filter_fixture";
      const failed = await run(source, { parameters: { label: { kind: 'string', value: '😀long replacement' } }, offset: 71 });
      assert.equal(failed.status, 'failed'); assert.equal(failed.statements[0].error.position, source.indexOf('absent_parameter_field'));
      const native = await run("SELECT '{\"a\":1}'::jsonb ? 'a' AS contains_key, (ARRAY[:first,:second])[1] AS first_item", { parameters: { first: { kind: 'number', value: '7' }, second: { kind: 'number', value: '8' } } });
      assert.equal(native.status, 'completed', native.statements[0].error?.message);
      assert.deepEqual(native.statements[0].result.rows[0], [true, 7]);
    }
    const repeated = await run('-- overridden variables\n@set tenant = 1;\nSELECT @tenant AS first_target;\n@set tenant = 2;\nSELECT @tenant AS second_target');
    assert.equal(repeated.status, 'completed'); assert.ok(repeated.statements.every((item) => String(item.result.rows[0][0]) === '2'));
    const history = await api(`/${id}/history/search`, {}, 'POST');
    assert.ok(JSON.stringify(history).includes(':name'), 'history retains parameterized source');
    assert.ok(JSON.stringify(history).includes('@set tenant = 42;'), 'history preserves declarations needed to restore current-statement context');
    assert.ok(!JSON.stringify(history).includes(parameters.name.value), 'history does not persist parameter input values');
    const entry = history.entries.find((item) => item.sqlPreview.includes('first_target'));
    assert.ok(entry, 'full history is available for each statement');
    const saved = await api(`/${id}/history/${entry.id}`);
    const replay = await run(saved.sql);
    assert.equal(replay.status, 'completed'); assert.equal(String(replay.statements[0].result.rows[0][0]), '2');
    console.log(`PASS ${provider}: typed parameters, exact integer, escaped embedded strings, @set context, MyBatis collections/where/entities, server-side input validation, full-batch policy and source history.`);
  } finally { await fetch(base + '/' + id, { method: 'DELETE' }); }
}
