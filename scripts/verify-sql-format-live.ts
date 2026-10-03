import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { formatSqlText, compressSqlText } from '../src/features/connectors/datastore/sql-format/formatter'
import type { RelationalProvider, RelationalSession, SqlExecutionSnapshot } from '@fouc/shared'

const env = parseEnv(readFileSync('.env.fouc.local', 'utf8'))
assert.ok(env.DATABASE_ADMIN_URL, 'DATABASE_ADMIN_URL is required for the isolated PostgreSQL lab')
const pg = new URL(env.DATABASE_ADMIN_URL)
const mysql = JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8'))
const sources: [RelationalProvider, Record<string, unknown>, string][] = [
  ['mysql', { ...mysql, provider: 'mysql', ssl: false }, mysql.database],
  ['postgres', { provider: 'postgres', host: pg.hostname, port: Number(pg.port), username: decodeURIComponent(pg.username), password: decodeURIComponent(pg.password), database: 'fouc_datastore_lab', ssl: false }, 'public'],
  ['sqlite', { provider: 'sqlite', path: process.cwd() + '/.runtime/dbx-lab/relational.sqlite' }, 'main'],
]
const base = 'http://127.0.0.1:8710/api/database/workspaces/dbx-format-verification/relational/sessions'
async function api<T>(route: string, body?: unknown, method = body ? 'POST' : 'GET', status = 200): Promise<T> {
  const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const payload = await response.json()
  assert.equal(response.status, status, payload.error?.message)
  return payload.data
}
for (const [provider, config, schema] of sources) {
  const session = await api<RelationalSession>('', config, 'POST', 201)
  try {
    const queries = [
      "select 42 as answer, '中文😀  AND\nOR  still literal' as literal, 9007199254740993 as exact_value /* keep token boundary */",
      "select id,name from dbx_filter_fixture where name in ('Alpha','Beta') order by id",
      ...(provider === 'postgres' ? ["select 'one'\n 'two' as adjacent, $tag$  AND\nOR  literal$tag$ as dollar, E'O\\'Reilly' as escaped"] : []),
      ...(provider === 'mysql' ? ["select 1--2 as arithmetic, 'O\\'Reilly' as escaped_value # remove comment\n"] : []),
      ...(provider === 'sqlite' ? ["select 'unchanged' as [AND\nOR identifier], 'O''Reilly' as escaped"] : []),
    ]
    const run = async (sql: string) => {
      let snapshot = await api<SqlExecutionSnapshot>(`/${session.id}/executions`, { sql, schema }, 'POST', 201)
      const started = Date.now()
      while (['running', 'cancelling'].includes(snapshot.status)) {
        assert.ok(Date.now() - started < 10000)
        await new Promise((resolve) => setTimeout(resolve, 60))
        snapshot = (await api<{ execution: SqlExecutionSnapshot }>(`/${session.id}/executions/${snapshot.id}`)).execution
      }
      assert.equal(snapshot.status, 'completed', `${snapshot.statements.find((statement) => statement.error)?.error?.message}\nSQL: ${sql}`)
      return snapshot.statements.map((statement) => ({ columns: statement.result?.columns, rows: statement.result?.rows }))
    }
    for (const sql of queries) {
      const original = await run(sql)
      assert.deepEqual(await run(await formatSqlText(sql, provider)), original, `${provider} formatted SQL must preserve native results`)
      assert.deepEqual(await run(compressSqlText(sql, provider)), original, `${provider} compressed SQL must preserve native results`)
    }
    console.log(`PASS ${provider}: native formatting/compression execution equivalence`)
  } finally { await api(`/${session.id}`, undefined, 'DELETE') }
}
