import { expect, test } from 'bun:test';
import type { DatabaseColumnInfo } from '@fouc/shared';
import { appendTableImport, previewTableImport, tableImportInput } from './table-import';
import { normalizeTableImportDecimal, tableImportParameter } from './table-import-values';
import type { RelationalDriver, SqlParameter } from './drivers/relational-driver';

const column = (name: string, dataType: string, extras: Partial<DatabaseColumnInfo> = {}): DatabaseColumnInfo => ({ name, dataType, isNullable: false, columnDefault: null, isPrimaryKey: false, isUnique: false, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null, ...extras });
const columns = [column('id', 'BIGINT'), column('name', 'TEXT'), column('note', 'TEXT', { isNullable: true, columnDefault: "'fallback'" })];
const input = { schema: 'public', table: 'people', text: 'id,name,note\n9007199254740993,"O\'Reilly; DELETE FROM people",\\N\n2,two', options: { format: 'csv' as const, nullToken: '\\N' }, mappings: ['id', 'name', 'note'].map((name) => ({ sourceColumn: name, targetColumn: name })) };
function mock() {
  const calls: Array<{ sql: string; values: SqlParameter[] }> = [];
  let transactions = 0;
  const driver = { assertEditable: async () => undefined, columns: async () => columns, quoteIdentifier: (name: string) => '"' + name.replaceAll('"', '""') + '"', transaction: async (_: string, callback: (transaction: { query: (sql: string, values: SqlParameter[]) => Promise<unknown> }) => Promise<unknown>) => { transactions++; return callback({ query: async (sql, values) => { calls.push({ sql, values }); return { affectedRows: 1 }; } }); } } as unknown as RelationalDriver;
  return { driver, calls, count: () => transactions };
}

test('preview is metadata-only and append binds exact integers, quoted text and row-specific defaults', async () => {
  const { driver, calls, count } = mock();
  const review = await previewTableImport(driver, 'postgres', input);
  expect(review.validation.valid).toBe(true); expect(review.rowsToImport).toBe(2); expect(count()).toBe(0); expect(calls).toEqual([]);
  const summary = await appendTableImport(driver, 'postgres', input);
  expect(summary.rowsImported).toBe(2); expect(count()).toBe(1); expect(calls).toHaveLength(2);
  expect(calls[0].sql).toBe('INSERT INTO "public"."people" ("id", "name", "note") VALUES ($1, $2, $3)');
  expect(calls[0].values).toEqual(['9007199254740993', "O'Reilly; DELETE FROM people", null]);
  expect(calls[1].sql).not.toContain('"note"'); expect(calls[1].values).toEqual(['2', 'two']);
  expect(calls.every((call) => !/DELETE|TRUNCATE|CREATE|O'Reilly/.test(call.sql))).toBe(true);
});

test('invalid mappings, missing required fields, NULL, overflow and source errors cause zero transactions', async () => {
  const { driver, count } = mock();
  for (const value of [
    { ...input, text: 'id,name\n1,' }, { ...input, text: 'id,name,note\n1,two,extra,unexpected' },
    { ...input, text: 'id,name,note\n9223372036854775808,two,x' },
    { ...input, text: 'id,name,note\n1,\\N,x' },
    { ...input, mappings: [{ sourceColumn: 'id', targetColumn: 'absent' }] },
    { ...input, mappings: [{ sourceColumn: 'id', targetColumn: 'name' }, { sourceColumn: 'name', targetColumn: 'name' }] },
  ]) await expect(appendTableImport(driver, 'postgres', value)).rejects.toThrow();
  expect(count()).toBe(0);
  expect(() => tableImportInput({ ...input, mode: 'truncate' })).toThrow();
});

test('native target coercion preserves JSON/scientific decimal/bigints and refuses lossy precision', () => {
  expect(normalizeTableImportDecimal('1.2300e+2')).toBe('123.00'); expect(normalizeTableImportDecimal('1e-3')).toBe('0.001');
  expect(tableImportParameter({ kind: 'number', value: '9007199254740993' }, columns[0], 'sqlite')).toBe(9007199254740993n);
  expect(tableImportParameter({ kind: 'number', value: '1e3' }, columns[0], 'postgres')).toBe('1000');
  expect(tableImportParameter({ kind: 'number', value: '9007199254740993' }, column('n', 'DOUBLE'), 'mysql')).toBe('9007199254740993');
  expect(tableImportParameter({ kind: 'json', value: '{"n":9007199254740993}' }, column('j', 'jsonb'), 'postgres')).toBe('{"n":9007199254740993}');
  expect(tableImportParameter({ kind: 'text', value: 'literal' }, column('j', 'jsonb'), 'postgres', 'json')).toBe('"literal"');
  expect(() => tableImportParameter({ kind: 'number', value: '1.234' }, column('n', 'NUMERIC(5,2)'), 'postgres')).toThrow('不会自动舍入');
  expect(() => tableImportParameter({ kind: 'number', value: '1.25' }, columns[0], 'postgres')).toThrow('小数');
  expect(tableImportParameter({ kind: 'boolean', value: 'true' }, column('b', 'tinyint(1) unsigned'), 'mysql')).toBe(1);
});

test('cancel before/between batches never commits and database errors propagate rollback context', async () => {
  const { driver, count } = mock();
  const controller = new AbortController(); controller.abort();
  await expect(appendTableImport(driver, 'postgres', input, controller.signal)).rejects.toThrow(); expect(count()).toBe(0);
  let rolledBack = false, committed = false;
  driver.transaction = async (_schema, callback) => { try { const result = await callback({ query: async () => { throw new Error('unique violation'); } }); committed = true; return result; } catch (error) { rolledBack = true; throw error; } };
  await expect(appendTableImport(driver, 'postgres', input)).rejects.toThrow('整批已回滚');
  expect(rolledBack).toBe(true); expect(committed).toBe(false);
});
