import { expect, test } from 'bun:test';
import { buildSqlExplain, explainSqlPlan } from './sql-explain';
import type { DriverResult } from './drivers/relational-driver';

const result: DriverResult = { columns: ['QUERY PLAN'], columnTypes: ['json'], rows: [[[{ Plan: { 'Node Type': 'Result', 'Plan Rows': 1 } }]]], hasMore: false };

test('native plans wrap only one preflighted read query and never request execution', async () => {
  const prefixes = { postgres: 'EXPLAIN (FORMAT JSON, ANALYZE FALSE) ', mysql: 'EXPLAIN FORMAT=JSON ', sqlite: 'EXPLAIN QUERY PLAN ' } as const;
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const calls: string[] = [];
    const driver = { read: async (sql: string, schema: string | null, maxRows: number) => { calls.push(sql); expect(schema).toBe('public'); expect(maxRows).toBe(4096); return result; } };
    const plan = await explainSqlPlan(driver, provider, { sql: '-- query\nSELECT 1;', schema: 'public' });
    expect(calls).toEqual([plan.sql]);
    expect(plan.sql.startsWith(prefixes[provider])).toBe(true);
    expect(plan.sql).not.toMatch(/;\s*$/);
    expect(plan.sourceSql).toBe('-- query\nSELECT 1;');
  }
});

test('write, EXPLAIN/ANALYZE, batches, unsafe templates and malformed input never reach a driver', async () => {
  let calls = 0;
  const driver = { read: async () => { calls++; return result; } };
  const invalid: unknown[] = [
    { sql: 'DELETE FROM users', schema: null }, { sql: 'SELECT 1; SELECT 2', schema: null },
    { sql: 'EXPLAIN SELECT 1', schema: null }, { sql: 'SELECT 1', schema: null, analyze: true },
    { sql: 'SELECT 1', schema: null, analyze: false }, { sql: 'SELECT 1', schema: '' },
    { sql: 'SELECT 1', schema: null, format: 'analyze' }, { sql: 'SELECT :n', schema: null },
    { sql: 'SELECT ${sql}', schema: null, parameters: { sql: { kind: 'raw', value: '1; DELETE FROM users' } } },
    { sql: 'WITH changes AS (DELETE FROM users RETURNING *) SELECT * FROM changes', schema: null },
    { sql: 'SELECT pg_sleep(1)', schema: null }, { sql: 'SELECT 1', schema: null, parameters: [] },
  ];
  for (const value of invalid) await expect(explainSqlPlan(driver, 'postgres', value)).rejects.toThrow();
  expect(calls).toBe(0);
  expect(() => buildSqlExplain('mysql', { sql: 'SELECT SLEEP(1)', schema: null })).toThrow();
});

test('templates remain data, while declared raw batches are preflighted after expansion', () => {
  const plan = buildSqlExplain('postgres', { sql: 'SELECT :label', schema: null, parameters: { label: { kind: 'string', value: "'; DELETE FROM users; -- 😀" } } });
  expect(plan.sql.startsWith('EXPLAIN (FORMAT JSON, ANALYZE FALSE) SELECT ')).toBe(true);
  expect(plan.sourceSql).toBe('SELECT :label');
  expect(() => buildSqlExplain('sqlite', { sql: 'SELECT ${n}', schema: 'main', parameters: { n: { kind: 'raw', value: '1; SELECT 2' } } })).toThrow();
  expect(buildSqlExplain('sqlite', { sql: 'SELECT @value', schema: 'main', declarationSql: '@set value = 42;\nSELECT @value' }).sql).toBe('EXPLAIN QUERY PLAN SELECT 42');
});

test('MySQL explicit JSON compatibility retries EXPLAIN only and ordinary errors propagate', async () => {
  const calls: string[] = [];
  const driver = { read: async (sql: string) => { calls.push(sql); if (calls.length === 1) throw new Error('Invalid EXPLAIN option: JSON. Valid options are: [TRADITIONAL]'); return result; } };
  const plan = await explainSqlPlan(driver, 'mysql', { sql: 'SELECT 1', schema: null });
  expect(calls).toEqual(['EXPLAIN FORMAT=JSON SELECT 1', 'EXPLAIN FORMAT=TRADITIONAL SELECT 1']);
  expect(plan.format).toBe('standard'); expect(plan.warnings).toHaveLength(1);
  let failures = 0;
  await expect(explainSqlPlan({ read: async () => { failures++; throw new Error('Unknown table'); } }, 'mysql', { sql: 'SELECT 1', schema: null })).rejects.toThrow('Unknown table');
  expect(failures).toBe(1);
  const controller = new AbortController(); controller.abort();
  await expect(explainSqlPlan(driver, 'mysql', { sql: 'SELECT 1', schema: null }, controller.signal)).rejects.toThrow();
  expect(calls).toHaveLength(2);
});
