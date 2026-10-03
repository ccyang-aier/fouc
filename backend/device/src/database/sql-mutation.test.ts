import { expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RelationalDriver } from './drivers/relational-driver';
import { connectSqlite } from './drivers/sqlite';
import { parseSqlMutation, renderMutationExpression } from './sql-mutation-parser';
import { SqlMutationPlans } from './sql-mutation-plans';

const approved = () => {};

test('native SQL subset preserves exact literals, quoting and operator precedence', () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const sql = "UPDATE fixture SET amount=amount+9007199254740993, label='x; O''Reilly' WHERE NOT id BETWEEN 2 AND 4 OR id IN(7,8) AND label IS NOT NULL; -- ordinary comment";
    const parsed = parseSqlMutation(sql, provider, 'main');
    expect(renderMutationExpression(parsed.assignments[0].expression, (name) => '"' + name + '"')).toContain('9007199254740993');
    expect(renderMutationExpression(parsed.where!, (name) => name)).toBe('((NOT (id BETWEEN 2 AND 4)) OR ((id IN (7, 8)) AND (label IS NOT NULL)))');
    expect(parsed.assignments[1].expression).toEqual({ kind: 'literal', sql: "'x; O''Reilly'" });
  }
  expect(parseSqlMutation("INSERT INTO fixture(label) VALUES(E'O\\'Reilly'),($tag$a; b$tag$)", 'postgres', 'public').values).toHaveLength(2);
  expect(parseSqlMutation("INSERT INTO fixture(blob) VALUES(X'00ff')", 'sqlite', 'main').values).toHaveLength(1);
});

test('unproven functions, scope, assignment dependencies and extra SQL are rejected', () => {
  const rejected = [
    'UPDATE fixture SET amount=1',
    'UPDATE fixture f SET amount=1 WHERE id=1',
    'UPDATE fixture SET amount=random() WHERE id=1',
    'UPDATE fixture SET amount=1,label=amount WHERE id=1',
    'DELETE FROM fixture WHERE id=1; DELETE FROM other WHERE id=2',
    'DELETE FROM other.fixture WHERE id=1',
    'DELETE FROM fixture WHERE id IN(SELECT id FROM other)',
    'DELETE FROM fixture WHERE id=?',
    'DELETE FROM fixture WHERE id=1 RETURNING *',
    'DELETE FROM fixture WHERE id=1 /*! AND id=2 */',
    'INSERT INTO fixture(label) SELECT label FROM other',
    'INSERT INTO fixture(label) VALUES(other)',
    'INSERT INTO fixture(label) VALUES(\'unfinished)',
    'INSERT INTO fixture(label) VALUES(1) ON CONFLICT DO NOTHING',
  ];
  for (const sql of rejected) expect(() => parseSqlMutation(sql, 'sqlite', 'main')).toThrow();
});

async function withSqlite(run: (driver: RelationalDriver, file: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-mutation-'));
  const file = path.join(directory, 'fixture.sqlite');
  const database = new DatabaseSync(file);
  database.exec("CREATE TABLE fixture(id INTEGER PRIMARY KEY, amount INTEGER NOT NULL DEFAULT 9, label TEXT, derived INTEGER GENERATED ALWAYS AS(amount*2) STORED); INSERT INTO fixture(id,amount,label) VALUES(1,3,'one'),(2,4,'two');");
  database.close();
  const driver = await connectSqlite({ provider: 'sqlite', path: file });
  try { await run(driver, file); }
  finally { await driver.close(); Bun.gc(true); unlinkSync(file); rmdirSync(directory); }
}

test('real SQLite previews stay read-only, commits exact changes and consumes a plan once', async () => {
  await withSqlite(async (driver) => {
    const plans = new SqlMutationPlans();
    const prepared = await plans.prepare(driver, 'sqlite', { schema: 'main', sql: "UPDATE fixture SET amount=amount+2,label='O''Reilly' WHERE id BETWEEN 1 AND 2" }, approved);
    expect(prepared.review.matchedRows).toBe(2);
    expect(prepared.review.changedRows).toBe(2);
    expect(prepared.review.rows[0].before).toEqual([1, 3, 'one', 6]);
    expect(prepared.review.rows[0].after![3].state).toBe('database');
    expect((await driver.read('SELECT amount FROM fixture WHERE id=1', 'main', 1)).rows[0][0]).toBe(3);
    expect((await plans.commit(driver, prepared.planId!, approved)).outcome).toBe('committed');
    expect((await driver.read('SELECT amount,label,derived FROM fixture WHERE id=1', 'main', 1)).rows[0]).toEqual([5, "O'Reilly", 10]);
    expect((await plans.commit(driver, prepared.planId!, approved)).outcome).toBe('conflict');

    const insert = await plans.prepare(driver, 'sqlite', { schema: 'main', sql: "INSERT INTO fixture(label) VALUES('defaulted')" }, approved);
    expect(insert.review.rows[0].after![0].state).toBe('database');
    expect(insert.review.rows[0].after![1].state).toBe('database');
    expect((await plans.commit(driver, insert.planId!, approved)).affectedRows).toBe(1);
    expect((await driver.read("SELECT amount,derived FROM fixture WHERE label='defaulted'", 'main', 1)).rows[0]).toEqual([9, 18]);
  });
}, 20000);

test('real SQLite detects changed old values, changed WHERE membership, metadata and the native row cap', async () => {
  await withSqlite(async (driver) => {
    const plans = new SqlMutationPlans();
    const sql = 'UPDATE fixture SET amount=amount+1 WHERE amount>0';
    const original = await plans.prepare(driver, 'sqlite', { schema: 'main', sql }, approved);
    await driver.transaction('main', (transaction) => transaction.query('UPDATE fixture SET label=? WHERE id=1', ['changed elsewhere']));
    expect((await plans.commit(driver, original.planId!, approved)).outcome).toBe('conflict');
    expect((await driver.read('SELECT amount FROM fixture WHERE id=1', 'main', 1)).rows[0][0]).toBe(3);
    const membership = await plans.prepare(driver, 'sqlite', { schema: 'main', sql }, approved);
    await driver.transaction('main', (transaction) => transaction.query('INSERT INTO fixture(id,amount) VALUES(3,7)', []));
    expect((await plans.commit(driver, membership.planId!, approved)).outcome).toBe('conflict');
    const capped = await plans.prepare(driver, 'sqlite', { schema: 'main', sql, maxRows: 1 }, approved);
    expect(capped.review.matchedRows).toBe(3);
    expect(capped.review.executable).toBe(false);
    expect(capped.planId).toBeNull();
    const metadata = await plans.prepare(driver, 'sqlite', { schema: 'main', sql: 'DELETE FROM fixture WHERE id=3' }, approved);
    await driver.transaction('main', (transaction) => transaction.query('ALTER TABLE fixture ADD COLUMN added TEXT', []));
    expect((await plans.commit(driver, metadata.planId!, approved)).outcome).toBe('conflict');
  });
}, 20000);

test('native SQLite rolls back cancellation after write and refuses triggers, cascades and unsafe precision', async () => {
  await withSqlite(async (driver) => {
    const abort = new AbortController();
    const controlled: RelationalDriver = { ...driver, transaction: (schema, run) => driver.transaction(schema, (transaction) => run({ query: async (sql, values) => {
      const result = await transaction.query(sql, values);
      if (/^UPDATE /i.test(sql)) abort.abort(new Error('fixture cancellation after UPDATE'));
      return result;
    } })) };
    const plans = new SqlMutationPlans();
    const prepared = await plans.prepare(controlled, 'sqlite', { schema: 'main', sql: 'UPDATE fixture SET amount=8 WHERE id=1' }, approved);
    expect((await plans.commit(controlled, prepared.planId!, approved, abort.signal)).outcome).toBe('cancelled');
    expect((await driver.read('SELECT amount FROM fixture WHERE id=1', 'main', 1)).rows[0][0]).toBe(3);
    await expect(plans.prepare(driver, 'sqlite', { schema: 'main', sql: 'UPDATE fixture SET amount=9223372036854775808 WHERE id=1' }, approved)).rejects.toThrow();
    await driver.transaction('main', (transaction) => transaction.query('CREATE TABLE child(id INTEGER PRIMARY KEY,parent INTEGER REFERENCES fixture(id) ON DELETE CASCADE)', []));
    await expect(plans.prepare(driver, 'sqlite', { schema: 'main', sql: 'DELETE FROM fixture WHERE id=1' }, approved)).rejects.toThrow('级联');
    await driver.transaction('main', (transaction) => transaction.query('CREATE TRIGGER fixture_effect AFTER UPDATE ON fixture BEGIN INSERT INTO child VALUES(99,new.id); END', []));
    await expect(plans.prepare(driver, 'sqlite', { schema: 'main', sql: 'UPDATE fixture SET amount=7 WHERE id=1' }, approved)).rejects.toThrow('触发器');
  });
}, 20000);

test('permission callbacks precede reads and writes; invalid plans and cleared requests cannot run SQL', async () => {
  await withSqlite(async (driver) => {
    const plans = new SqlMutationPlans();
    const deny = () => { throw new Error('workspace access denied'); };
    await expect(plans.prepare(driver, 'sqlite', { schema: 'main', sql: 'DELETE FROM fixture WHERE id=1' }, deny)).rejects.toThrow('access denied');
    const prepared = await plans.prepare(driver, 'sqlite', { schema: 'main', sql: 'DELETE FROM fixture WHERE id=1' }, approved);
    await expect(plans.commit(driver, prepared.planId!, deny)).rejects.toThrow('access denied');
    plans.clear();
    expect((await plans.commit(driver, prepared.planId!, approved)).outcome).toBe('conflict');
    expect((await driver.read('SELECT COUNT(*) FROM fixture', 'main', 1)).rows[0][0]).toBe(2);
  });
}, 20000);

test('lost COMMIT acknowledgement remains unknown; returned previews cannot mutate the stored plan', async () => {
  await withSqlite(async (driver) => {
    const interrupted: RelationalDriver = {
      ...driver,
      transaction: async (schema, run) => {
        await driver.transaction(schema, run);
        throw Object.assign(new Error('fixture lost COMMIT acknowledgement'), { code: 'ECONNRESET' });
      },
    };
    const plans = new SqlMutationPlans();
    const prepared = await plans.prepare(interrupted, 'sqlite', { schema: 'main', sql: 'UPDATE fixture SET amount=5 WHERE id=1' }, approved);
    prepared.review.rows[0].after![1] = { state: 'value', value: 999 };
    const result = await plans.commit(interrupted, prepared.planId!, approved);
    expect(result.outcome).toBe('unknown');
    expect(result.affectedRows).toBeNull();
    expect((await driver.read('SELECT amount FROM fixture WHERE id=1', 'main', 1)).rows[0][0]).toBe(5);
    expect((await plans.commit(interrupted, prepared.planId!, approved)).outcome).toBe('conflict');
  });
}, 20000);
