import { expect, test } from 'bun:test';
import type { RelationalProvider, DatabaseColumnInfo } from '@fouc/shared';
import { parseTableClearInput, parseTableClearConfirmation } from '@fouc/shared/table-clear';
import type { RelationalDriver, DriverResult, DriverStructure } from './drivers/relational-driver';
import { TableClearPlans } from './table-clear-plans';

const allowed = () => undefined;
function result(columns: string[], rows: DriverResult['rows']): DriverResult { return { columns, rows, columnTypes: [], hasMore: false }; }
function fixture(provider: RelationalProvider) {
  const column: DatabaseColumnInfo = { name: 'id', dataType: 'integer', isNullable: false, columnDefault: null, isPrimaryKey: true, isUnique: true, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null };
  const native: DriverStructure = { schema: provider === 'sqlite' ? 'main' : 'lab', table: 'items', kind: 'table', indexes: [], foreignKeys: [], constraints: [], triggers: [], properties: {}, definition: { sql: '', origin: 'native', warnings: [] } };
  const state = { count: 2, writes: 0, transactions: 0, column, native, references: [] as DriverResult['rows'], fail: null as Error | null, after: null as Error | null };
  const read = async (sql: string): Promise<DriverResult> => {
    if (sql.includes('fouc_table_clear_catalog')) return result(['catalog'], [[JSON.stringify({ column: state.column, native: state.native, references: state.references })]]);
    if (sql.includes('FROM pg_catalog.pg_class c')) return result(['relkind', 'relrowsecurity', 'relispartition', 'can_select', 'can_clear', 'inherited'], [['r', false, false, true, true, false]]);
    if (sql.includes('FROM pg_catalog.pg_constraint') || sql.includes('REFERENTIAL_CONSTRAINTS') || sql.includes('pragma_foreign_key_list')) return result(['owner_schema', 'owner_table', 'constraint_name', 'owner_column', 'target_column', 'delete_rule'], state.references);
    if (sql.includes('CURRENT_USER()')) return result(['account'], ['lab@localhost'].map(value => [value]));
    if (sql.includes('USER_PRIVILEGES')) return result(['PRIVILEGE_TYPE'], [['DROP'], ['SELECT']]);
    if (sql.includes('main.sqlite_schema')) return result(['count'], [[1]]);
    if (sql.includes('COUNT(*)')) return result(['count'], [[state.count]]);
    throw new Error('Unexpected probe: ' + sql);
  };
  const driver: RelationalDriver = {
    info: {}, quoteIdentifier: value => provider === 'mysql' ? '`' + value.replaceAll('`', '``') + '`' : '"' + value.replaceAll('"', '""') + '"',
    schemas: async () => [native.schema], tables: async () => [], columns: async () => [state.column], structure: async () => state.native,
    read, assertEditable: async () => undefined, close: async () => undefined,
    transaction: async (_, callback) => {
      state.transactions++; const original = state.count;
      try {
        const value = await callback({ query: async sql => {
          if (sql.startsWith('LOCK TABLE')) return { ...result([], []), affectedRows: 0 };
          if (/^(TRUNCATE|DELETE)/.test(sql)) { state.writes++; if (state.fail) throw state.fail; const affectedRows = state.count; state.count = 0; return { ...result([], []), affectedRows }; }
          return { ...await read(sql), affectedRows: 0 };
        } });
        if (state.after) throw state.after;
        return value;
      } catch (reason) { if (provider !== 'mysql') state.count = original; throw reason; }
    },
  } as RelationalDriver;
  return { driver, state, input: { schema: native.schema, table: native.table } };
}

test('strict target and dangerous confirmation accept identifiers, reject raw SQL/CASCADE/extra fields', () => {
  expect(parseTableClearInput({ schema: 'main', table: 'quote"table' }).table).toBe('quote"table');
  for (const value of [{ schema: 'main', table: 'x', sql: 'DELETE FROM y' }, { schema: 'main', table: 'x', cascade: true }, { schema: 'main', table: 'x\u0000' }, { schema: 'main', table: 'x', acknowledgeTriggers: 'yes' }]) expect(() => parseTableClearInput(value)).toThrow();
  expect(parseTableClearConfirmation({ confirm: true, tableName: 'main.x' }).tableName).toBe('main.x');
  expect(() => parseTableClearConfirmation({ confirm: true, tableName: 'main.x', sql: 'DROP TABLE x' })).toThrow();
});

test('three native plans are read-only, quoted, single-use and retain true transaction/identity behavior', async () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const { driver, state, input } = fixture(provider), plans = new TableClearPlans();
    const prepared = await plans.prepare(driver, provider, input, allowed);
    expect(state.writes).toBe(0); expect(state.transactions).toBe(0);
    expect(prepared.review.visibleRowCount).toBe('2'); expect(prepared.review.sql).not.toContain('CASCADE');
    if (provider === 'postgres') expect(prepared.review.sql).toBe('TRUNCATE TABLE ONLY "lab"."items" CONTINUE IDENTITY RESTRICT;');
    if (provider === 'sqlite') expect(prepared.review.sql).toBe('DELETE FROM "main"."items";');
    if (provider === 'mysql') expect(prepared.review.transaction).toBe('implicit-commit');
    const cleared = await plans.commit(driver, prepared.planId, { confirm: true, tableName: prepared.review.confirmationName }, allowed);
    expect(cleared.outcome).toBe('cleared'); expect(state.count).toBe(0); expect(state.writes).toBe(1);
    expect(cleared.affectedRows).toBe(provider === 'sqlite' ? '2' : null);
    await expect(plans.commit(driver, prepared.planId, { confirm: true, tableName: prepared.review.confirmationName }, allowed)).rejects.toThrow();
  }
});

test('references, triggers and MySQL identity require honest explicit review and never execute by default', async () => {
  const mysql = fixture('mysql'); mysql.state.column.extra = 'auto_increment';
  const plans = new TableClearPlans();
  const blocked = await plans.prepare(mysql.driver, 'mysql', mysql.input, allowed);
  expect(blocked.review.identity).toBe('reset'); expect(blocked.review.blockedReasons.length).toBe(1);
  expect((await plans.commit(mysql.driver, blocked.planId, { confirm: true, tableName: 'lab.items' }, allowed)).outcome).toBe('rejected'); expect(mysql.state.writes).toBe(0);
  const accepted = await plans.prepare(mysql.driver, 'mysql', { ...mysql.input, acknowledgeIdentityReset: true }, allowed);
  expect(accepted.review.blockedReasons).toHaveLength(0);
  const sqlite = fixture('sqlite'); sqlite.state.native.triggers = [{ name: 'delete_audit', timing: 'AFTER', events: ['DELETE'], orientation: 'ROW', enabled: null, definition: 'CREATE TRIGGER ...' }];
  const triggers = await plans.prepare(sqlite.driver, 'sqlite', sqlite.input, allowed);
  expect(triggers.review.triggers).toHaveLength(1); expect(triggers.review.blockedReasons.length).toBe(1);
  sqlite.state.references = [['main', 'children', 'fk_1', 'parent_id', 'id', 'CASCADE']];
  const reference = await plans.prepare(sqlite.driver, 'sqlite', { ...sqlite.input, acknowledgeTriggers: true }, allowed);
  expect(reference.review.incomingReferences[0].onDelete).toBe('CASCADE'); expect(reference.review.blockedReasons.length).toBe(1);
});

test('wrong Entry, lock revocation, name mismatch, changed row count and changed structure reject before writes', async () => {
  const { driver, state, input } = fixture('sqlite'), plans = new TableClearPlans();
  const wrong = await plans.prepare(driver, 'sqlite', input, allowed);
  await expect(plans.commit({ ...driver }, wrong.planId, { confirm: true, tableName: 'main.items' }, allowed)).rejects.toThrow();
  const locked = await plans.prepare(driver, 'sqlite', input, allowed); plans.clear();
  await expect(plans.commit(driver, locked.planId, { confirm: true, tableName: 'main.items' }, allowed)).rejects.toThrow();
  const name = await plans.prepare(driver, 'sqlite', input, allowed);
  await expect(plans.commit(driver, name.planId, { confirm: true, tableName: 'items' }, allowed)).rejects.toThrow();
  const count = await plans.prepare(driver, 'sqlite', input, allowed); state.count++;
  expect((await plans.commit(driver, count.planId, { confirm: true, tableName: 'main.items' }, allowed)).outcome).toBe('rejected');
  const structure = await plans.prepare(driver, 'sqlite', input, allowed); state.column.dataType = 'text';
  expect((await plans.commit(driver, structure.planId, { confirm: true, tableName: 'main.items' }, allowed)).outcome).toBe('rejected');
  expect(state.writes).toBe(0);
});

test('MySQL acknowledged DDL persists across wrapper failure; Pg commit response loss remains unknown', async () => {
  for (const provider of ['mysql', 'postgres'] as const) {
    const { driver, state, input } = fixture(provider), plans = new TableClearPlans();
    const prepared = await plans.prepare(driver, provider, input, allowed);
    state.after = Object.assign(new Error('commit response lost'), { code: 'ECONNRESET' });
    const committed = await plans.commit(driver, prepared.planId, { confirm: true, tableName: prepared.review.confirmationName }, allowed);
    expect(committed.outcome).toBe(provider === 'mysql' ? 'cleared' : 'unknown');
    expect(committed.affectedRows).toBeNull();
  }
});
