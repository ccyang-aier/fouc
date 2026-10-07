import { expect, test, setSystemTime } from 'bun:test';
import { Hono } from 'hono';
import { parseSchemaCreateInput, schemaCreateNameError } from '@fouc/shared/schema-create';
import type { RelationalDriver, DriverResult } from './drivers/relational-driver';
import { SchemaCreatePlans } from './schema-create-plans';
import { schemaCreateRoutes } from '../api/schema-create-routes';

function result(columns: string[], rows: DriverResult['rows']): DriverResult {
  return { columns, rows, columnTypes: [], hasMore: false };
}
function fixture() {
  const state = { exists: false, privilege: true, sql: [] as string[], calls: [] as string[], failure: null as Error | null, afterQuery: null as (() => void) | null };
  const driver = {
    read: async (sql: string) => {
      state.calls.push(sql);
      if (sql.includes('has_database_privilege')) return result(['can_create'], [[state.privilege]]);
      if (sql === 'SHOW CHARACTER SET') return result(['Charset', 'Description', 'Default collation'], [['utf8mb4', 'Unicode', 'utf8mb4_general_ci']]);
      if (sql === 'SHOW COLLATION') return result(['Collation', 'Charset', 'Default'], [['utf8mb4_bin', 'utf8mb4', ''], ['utf8mb4_general_ci', 'utf8mb4', 'Yes'], ['latin1_bin', 'latin1', '']]);
      return result(['name'], state.exists ? [['existing']] : []);
    },
    transaction: async (_schema: string, run: Parameters<RelationalDriver['transaction']>[1]) => run({ query: async (sql: string) => {
      state.sql.push(sql);
      if (state.failure) throw state.failure;
      state.afterQuery?.();
      return { ...result([], []), affectedRows: 0 };
    } }),
  } as unknown as RelationalDriver;
  return { driver, state };
}
const allowed = () => undefined;

test('quoted targets preserve special characters and enforce native name/options limits before metadata', async () => {
  expect(schemaCreateNameError('postgres', '研究 "A"')).toBeNull();
  expect(schemaCreateNameError('postgres', '汉'.repeat(22))).not.toBeNull();
  expect(schemaCreateNameError('mysql', 'name`quoted')).toBeNull();
  expect(schemaCreateNameError('mysql', 'x'.repeat(65))).not.toBeNull();
  for (const name of ['mysql', 'SYS', 'a/b', 'a.b', 'a\\b', '😀', ' trailing ', 'x\u0000']) expect(schemaCreateNameError('mysql', name)).not.toBeNull();
  for (const name of ['pg_private', 'PG_test', 'information_schema', '\ud800']) expect(schemaCreateNameError('postgres', name)).not.toBeNull();
  expect(() => parseSchemaCreateInput('postgres', { name: 'x', sql: 'DROP SCHEMA public' })).toThrow();
  expect(() => parseSchemaCreateInput('mysql', { name: 'x', charset: 'utf8mb4; DROP DATABASE a' })).toThrow();
  expect(() => parseSchemaCreateInput('postgres', { name: 'x', charset: 'utf8mb4' })).toThrow();
  expect(() => parseSchemaCreateInput('sqlite', { name: 'x' })).toThrow();
  const { driver, state } = fixture(), plans = new SchemaCreatePlans();
  const pg = await plans.prepare(driver, 'postgres', 'lab', { name: '研究 "A"; SELECT 1' }, allowed);
  expect(pg.review.sql).toBe('CREATE SCHEMA "研究 ""A""; SELECT 1";');
  const my = await plans.prepare(driver, 'mysql', 'lab', { name: 'a`b', charset: 'utf8mb4', collation: 'utf8mb4_bin' }, allowed);
  expect(my.review.sql).toBe('CREATE DATABASE `a``b` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;');
  const options = await plans.options(driver, 'mysql', 'lab', allowed);
  expect(options.charsets[0].collations).toEqual(['utf8mb4_general_ci', 'utf8mb4_bin']);
  await expect(plans.prepare(driver, 'mysql', 'lab', { name: 'new', charset: 'latin1' }, allowed)).rejects.toThrow('真实目录');
  await expect(plans.prepare(driver, 'mysql', 'lab', { name: 'new', charset: 'utf8mb4', collation: 'latin1_bin' }, allowed)).rejects.toThrow('真实目录');
  expect(state.sql).toEqual([]);
});

test('readonly review does not write; explicit writable gate, fresh conflict/permission and one-use token control execution', async () => {
  const { driver, state } = fixture(), plans = new SchemaCreatePlans();
  const prepared = await plans.prepare(driver, 'postgres', 'lab', { name: 'safe' }, allowed);
  expect(state.sql).toEqual([]);
  await expect(plans.commit(driver, prepared.planId, () => { throw new Error('locked'); })).rejects.toThrow('locked');
  expect((await plans.commit(driver, prepared.planId, allowed)).outcome).toBe('created');
  expect(state.sql).toEqual(['CREATE SCHEMA "safe";']);
  await expect(plans.commit(driver, prepared.planId, allowed)).rejects.toThrow('失效');
  const conflict = await plans.prepare(driver, 'postgres', 'lab', { name: 'race' }, allowed);
  state.exists = true;
  expect((await plans.commit(driver, conflict.planId, allowed)).outcome).toBe('rejected');
  state.exists = false;
  const privilege = await plans.prepare(driver, 'postgres', 'lab', { name: 'permission' }, allowed);
  state.privilege = false;
  expect((await plans.commit(driver, privilege.planId, allowed)).outcome).toBe('rejected');
  expect(state.sql.length).toBe(1);
});

test('driver ownership, close/lock, five-minute expiry and abort invalidate plans without execution', async () => {
  const { driver, state } = fixture(), plans = new SchemaCreatePlans();
  const owned = await plans.prepare(driver, 'postgres', 'lab', { name: 'owned' }, allowed);
  await expect(new SchemaCreatePlans().commit(driver, owned.planId, allowed)).rejects.toThrow('失效');
  await expect(plans.commit(fixture().driver, owned.planId, allowed)).rejects.toThrow('失效');
  const closed = await plans.prepare(driver, 'postgres', 'lab', { name: 'closed' }, allowed);
  plans.clear();
  await expect(plans.commit(driver, closed.planId, allowed)).rejects.toThrow('失效');
  const expired = await plans.prepare(driver, 'postgres', 'lab', { name: 'expired' }, allowed);
  try {
    setSystemTime(new Date(expired.expiresAt + 1));
    await expect(plans.commit(driver, expired.planId, allowed)).rejects.toThrow('失效');
  } finally { setSystemTime(); }
  const controller = new AbortController(); controller.abort();
  await expect(plans.prepare(driver, 'postgres', 'lab', { name: 'abort' }, allowed, controller.signal)).rejects.toThrow();
  expect(state.sql).toEqual([]);
});

test('native permission rejection stays rejected while interrupted MySQL DDL remains unknown', async () => {
  const { driver, state } = fixture(), plans = new SchemaCreatePlans();
  const denied = await plans.prepare(driver, 'mysql', 'lab', { name: 'denied' }, allowed);
  state.failure = Object.assign(new Error('Access denied for user to database'), { code: 'ER_DBACCESS_DENIED_ERROR', sqlState: '42000' });
  expect((await plans.commit(driver, denied.planId, allowed)).outcome).toBe('rejected');
  state.failure = null;
  const uncertain = await plans.prepare(driver, 'mysql', 'lab', { name: 'uncertain' }, allowed);
  state.afterQuery = () => { throw Object.assign(new Error('lost COMMIT response'), { code: 'ECONNRESET' }); };
  expect((await plans.commit(driver, uncertain.planId, allowed)).outcome).toBe('unknown');
  const duplicate = await plans.prepare(driver, 'mysql', 'lab', { name: 'duplicate' }, allowed);
  state.failure = Object.assign(new Error('database exists'), { code: 'ER_DB_CREATE_EXISTS', sqlState: 'HY000' });
  expect((await plans.commit(driver, duplicate.planId, allowed)).outcome).toBe('rejected');
});

test('HTTP routes require exact confirmation and bound input, never dispatch arbitrary user SQL', async () => {
  let commits = 0, prepares = 0;
  const app = new Hono().route('/', schemaCreateRoutes({
    schemaCreateOptions: async () => ({ provider: 'sqlite', database: 'main', supported: false, target: null, permission: 'denied', charsets: [], warnings: [] }),
    prepareSchemaCreate: async () => { prepares++; throw new Error('stop'); },
    commitSchemaCreate: async () => { commits++; throw new Error('stop'); },
    discardSchemaCreate: () => undefined,
  }));
  app.onError(error => new Response(error.message, { status: 400 }));
  const base = '/api/database/relational/sessions/s/schema-create';
  for (const value of [{ confirm: false }, { confirm: true, sql: 'DROP SCHEMA public' }, []]) {
    expect((await app.request(`${base}/plans/token/commit`, { method: 'POST', body: JSON.stringify(value) })).status).toBe(400);
  }
  expect((await app.request(`${base}/plans`, { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(5000) }) })).status).toBe(400);
  expect((await app.request(`${base}/options?sql=DROP`)).status).toBe(400);
  expect(commits).toBe(0); expect(prepares).toBe(0);
});
