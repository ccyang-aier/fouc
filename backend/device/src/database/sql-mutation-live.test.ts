import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type { RelationalConnectInput } from '@fouc/shared';
import { connectMysql } from './drivers/mysql';
import { connectPostgres } from './drivers/postgres';
import { SqlMutationPlans } from './sql-mutation-plans';

const enabled = process.env.FOUC_SQL_MUTATION_LIVE === '1';

test.skipIf(!enabled)('real native MySQL/Postgres exact DML preview, conflict, INSERT defaults and DELETE execution', async () => {
  if (!existsSync('.runtime/dbx-lab/mysql-connection.json')) throw new Error('Native lab configuration is required');
  const mysqlInput = JSON.parse(readFileSync('.runtime/dbx-lab/mysql-connection.json', 'utf8')) as Extract<RelationalConnectInput, { provider: 'mysql' }>;
  const mysqlAdmin = parseEnv(readFileSync('.runtime/dbx-lab/mysql.env', 'utf8'));
  if (!mysqlAdmin.FOUC_MYSQL_LAB_ROOT_PASSWORD) throw new Error('Native MySQL lab administrator configuration is required');
  const environment = parseEnv(readFileSync('.env.fouc.local', 'utf8'));
  if (!environment.DATABASE_ADMIN_URL) throw new Error('Native PostgreSQL lab configuration is required');
  const url = new URL(environment.DATABASE_ADMIN_URL);
  const sources = [
    { provider: 'mysql' as const, schema: mysqlInput.database!, connect: () => connectMysql({ ...mysqlInput, provider: 'mysql', username: 'root', password: mysqlAdmin.FOUC_MYSQL_LAB_ROOT_PASSWORD! }) },
    { provider: 'postgres' as const, schema: 'public', connect: () => connectPostgres({ provider: 'postgres', host: url.hostname, port: Number(url.port), username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'fouc_datastore_lab' }) },
  ];
  for (const source of sources) {
    const driver = await source.connect();
    const table = '__fouc_q10_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const target = `${driver.quoteIdentifier(source.schema)}.${driver.quoteIdentifier(table)}`;
    try {
      const suffix = source.provider === 'mysql' ? ' ENGINE=InnoDB' : '';
      await driver.transaction(source.schema, (transaction) => transaction.query(`CREATE TABLE ${target}(id BIGINT PRIMARY KEY,amount DECIMAL(30,4) NOT NULL DEFAULT 9,label VARCHAR(100),payload ${source.provider === 'mysql' ? 'JSON' : 'JSONB'})${suffix}`, []));
      await driver.transaction(source.schema, (transaction) => transaction.query(`INSERT INTO ${target} VALUES(9007199254740993,1234567890123456.1234,'first','{"n":9007199254740993}'),(2,4,'second',NULL)`, []));
      const plans = new SqlMutationPlans();
      const prepared = await plans.prepare(driver, source.provider, { schema: source.schema, sql: `UPDATE ${target} SET amount=amount+0.0001,label='O''Reilly' WHERE id=9007199254740993` }, () => {});
      expect(prepared.review.rows[0].before![0]).toBe('9007199254740993');
      expect(prepared.review.rows[0].before![1]).toBe('1234567890123456.1234');
      expect(String(prepared.review.rows[0].before![3])).toContain('9007199254740993');
      expect(prepared.review.rows[0].after![1]).toEqual({ state: 'value', value: '1234567890123456.1235' });
      const committed = await plans.commit(driver, prepared.planId!, () => {});
      expect(committed.error).toBeNull();
      expect(committed.outcome).toBe('committed');
      expect((await driver.read(`SELECT amount,label FROM ${target} WHERE id=9007199254740993`, source.schema, 1)).rows[0]).toEqual(['1234567890123456.1235', "O'Reilly"]);
      const stale = await plans.prepare(driver, source.provider, { schema: source.schema, sql: `DELETE FROM ${target} WHERE id=2` }, () => {});
      await driver.transaction(source.schema, (transaction) => transaction.query(`UPDATE ${target} SET label='external edit' WHERE id=2`, []));
      expect((await plans.commit(driver, stale.planId!, () => {})).outcome).toBe('conflict');
      const insert = await plans.prepare(driver, source.provider, { schema: source.schema, sql: `INSERT INTO ${target}(id,label) VALUES(3,'default')` }, () => {});
      expect(insert.review.rows[0].after![1].state).toBe('database');
      expect((await plans.commit(driver, insert.planId!, () => {})).outcome).toBe('committed');
      const deletion = await plans.prepare(driver, source.provider, { schema: source.schema, sql: `DELETE FROM ${target} WHERE id IN(2,3)` }, () => {});
      expect(deletion.review.matchedRows).toBe(2);
      expect((await plans.commit(driver, deletion.planId!, () => {})).affectedRows).toBe(2);
      expect(String((await driver.read(`SELECT COUNT(*) FROM ${target}`, source.schema, 1)).rows[0][0])).toBe('1');
      console.log(`PASS Q10 ${source.provider}: native precision, read-only preview, guarded transaction, stale conflict, INSERT/DELETE`);
    } finally {
      try { await driver.transaction(source.schema, (transaction) => transaction.query(`DROP TABLE IF EXISTS ${target}`, [])); }
      finally { await driver.close(); }
    }
  }
}, 90000);
