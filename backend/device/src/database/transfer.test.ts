import { expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseCell, DatabaseColumnInfo, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import type { TableTransferInput, TableTransferPlan } from '@fouc/shared/table-transfer';
import { connectSqlite } from './drivers/sqlite';
import type { RelationalDriver, DriverResult, RelationalTransaction } from './drivers/relational-driver';
import { prepareTableTransfer } from './transfer-prepare';
import { executeTableTransfer } from './transfer-execute';
import { transferCellValue } from './transfer-values';

function col(name: string, dataType = 'TEXT', nullable = true): DatabaseColumnInfo { return { name, dataType, isNullable: nullable, columnDefault: null, isPrimaryKey: false, isUnique: false, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null }; }
function table(provider: RelationalProvider, name: string, columns = [col('name')]): RelationalTableStructure { return { connectionId: name, provider, schema: provider === 'sqlite' ? 'main' : 'public', table: name, kind: 'table', columns, indexes: [], foreignKeys: [], constraints: [], triggers: [], properties: {}, definition: { sql: `CREATE TABLE ${name}(name TEXT)`, origin: 'native', warnings: [] } }; }
const input = (names = ['name'], options: Partial<TableTransferInput> = {}): TableTransferInput => ({ mode: 'append', mappings: names.map((name) => ({ sourceColumn: name, targetColumn: name, conversion: 'native' })), maxRows: 20, batchSize: 2, rowLimitMode: 'require-complete', ...options });
test('prepare validates required/default/generated targets and bounded explicit append contracts', () => {
  const source = table('postgres', 'source'), target = table('postgres', 'target', [col('name'), col('required', 'INTEGER', false)]);
  expect(prepareTableTransfer(source, target, input()).executable).toBe(false);
  target.columns[1].columnDefault = '7'; expect(prepareTableTransfer(source, target, input()).executable).toBe(true);
  target.columns[0].extra = 'generated'; target.definition.sql = 'CREATE TABLE target(name TEXT GENERATED ALWAYS AS (upper(required::text)) STORED, required INTEGER DEFAULT 7)';
  expect(prepareTableTransfer(source, target, input()).issues.some((issue) => issue.message.includes('生成列'))).toBe(true);
  expect(() => prepareTableTransfer(source, target, input(['name'], { maxRows: 100001 }))).toThrow();
  expect(prepareTableTransfer(source, source, input()).executable).toBe(false);
});
test('native JSON and PostgreSQL array source projections preserve raw textual numeric precision', () => {
  for (const provider of ['mysql', 'postgres'] as const) {
    const source = table(provider, 'source', [col('json_data', 'JSON')]), target = table(provider, 'target', [col('json_data', 'JSON')]);
    const plan = prepareTableTransfer(source, target, input(['json_data']));
    expect(plan.executable).toBe(true); expect(plan.sourcePreviewSql).toContain('CAST('); expect(plan.columns[0].sourceProjection).toBe('text');
    const json = provider === 'mysql' ? '{"exact":9007199254740993}' : '{"exact":9007199254740993123456789}';
    expect(transferCellValue(json, plan.columns[0], plan)).toBe(json);
    if (provider === 'mysql') expect(() => transferCellValue('{"exact":9007199254740993123456789}', plan.columns[0], plan)).toThrow();
  }
  const array = prepareTableTransfer(table('postgres', 's', [col('value', 'numeric[]')]), table('postgres', 't', [col('value', 'numeric[]')]), input(['value']));
  expect(array.sourcePreviewSql).toContain('CAST("value" AS TEXT)'); expect(transferCellValue('{9007199254740993,NULL,0.1234567890123456789}', array.columns[0], array)).toBe('{9007199254740993,NULL,0.1234567890123456789}');
});
test('native parameter values retain int64/decimal/binary; coercion, overflow and silent rounding are rejected', () => {
  const source = table('postgres', 's', [col('id', 'BIGINT'), col('amount', 'NUMERIC(40,8)'), col('payload', 'BYTEA')]), target = table('mysql', 't', [col('id', 'BIGINT'), col('amount', 'DECIMAL(40,8)'), col('payload', 'BLOB')]);
  const plan = prepareTableTransfer(source, target, input(['id', 'amount', 'payload'])); expect(plan.executable).toBe(true);
  expect(transferCellValue('9007199254740993', plan.columns[0], plan)).toBe('9007199254740993');
  expect(transferCellValue('123456789012345678901234567890.12345678', plan.columns[1], plan)).toBe('123456789012345678901234567890.12345678');
  expect([...transferCellValue({ type: 'binary', base64: 'AP+D' }, plan.columns[2], plan) as Uint8Array]).toEqual([0, 255, 131]);
  expect(() => transferCellValue(9007199254740992, plan.columns[0], plan)).toThrow();
  expect(() => transferCellValue('9223372036854775808', plan.columns[0], plan)).toThrow();
  expect(() => transferCellValue('0.123456789', plan.columns[1], plan)).toThrow();
  const sqlite = prepareTableTransfer(table('postgres', 's', [col('amount', 'NUMERIC')]), table('sqlite', 't', [col('amount', 'NUMERIC')]), input(['amount'])); expect(sqlite.executable).toBe(false);
  expect(prepareTableTransfer(table('mysql', 's', [col('value', 'tinyint(1)')]), table('mysql', 't', [col('value', 'tinyint(1)')]), input(['value'])).executable).toBe(true);
});
function fakeDriver(rows: DatabaseCell[][], names: string[], events: string[], commitFailure = false): RelationalDriver {
  return { info: { productName: 'fixture', productVersion: '1', driverName: 'fixture', currentDatabase: 'fixture' }, quoteIdentifier: (name) => `"${name}"`, schemas: async () => [], tables: async () => [], columns: async () => [], structure: async () => { throw new Error('unused'); }, assertEditable: async () => {}, close: async () => {},
    async read(sql): Promise<DriverResult> { const match = /LIMIT (\d+) OFFSET (\d+)$/.exec(sql)!; return { columns: names, columnTypes: [], rows: rows.slice(Number(match[2]), Number(match[2]) + Number(match[1])), hasMore: false }; },
    async transaction<T>(_schema: string, run: (tx: RelationalTransaction) => Promise<T>): Promise<T> { events.push('begin'); try { const result = await run({ async query(sql, values) { events.push(sql); return { columns: [], columnTypes: [], rows: [], hasMore: false, affectedRows: values.length / names.length }; } }); if (commitFailure) throw new Error('commit acknowledgement lost'); events.push('commit'); return result; } catch (error) { events.push('rollback'); throw error; } },
  };
}
test('complete-mode cap rolls back before commit; first-N mode requires explicit plan and reports remaining rows', async () => {
  const rows: DatabaseCell[][] = [['a'], ['b'], ['c']], events: string[] = [], plan = prepareTableTransfer(table('postgres', 's'), table('postgres', 't'), input(['name'], { maxRows: 2, batchSize: 1 }));
  const failed = await executeTableTransfer(fakeDriver(rows, ['name'], []), fakeDriver([], ['name'], events), plan);
  expect(failed.status).toBe('failed'); expect(failed.transaction).toBe('rolled-back'); expect(failed.rowsCommitted).toBe(0); expect(failed.sourceHasMore).toBe(true); expect(events).not.toContain('commit');
  const limited = prepareTableTransfer(table('postgres', 's'), table('postgres', 't'), input(['name'], { maxRows: 2, batchSize: 1, rowLimitMode: 'first-rows' }));
  const done = await executeTableTransfer(fakeDriver(rows, ['name'], []), fakeDriver([], ['name'], []), limited); expect(done.status).toBe('committed'); expect(done.rowsCommitted).toBe(2); expect(done.sourceHasMore).toBe(true);
});
test('cancel rolls back pending writes; commit acknowledgement loss is unknown, never reported committed', async () => {
  const plan = prepareTableTransfer(table('postgres', 's'), table('postgres', 't'), input(['name'], { batchSize: 1 })), abort = new AbortController(), events: string[] = [];
  const cancelled = await executeTableTransfer(fakeDriver([['a'], ['b']], ['name'], []), fakeDriver([], ['name'], events), plan, { signal: abort.signal, onProgress(progress) { if (progress.rowsWritten === 1) abort.abort(); } });
  expect(cancelled.status).toBe('cancelled'); expect(cancelled.transaction).toBe('rolled-back'); expect(cancelled.rowsCommitted).toBe(0); expect(events).not.toContain('commit');
  const unknown = await executeTableTransfer(fakeDriver([['a']], ['name'], []), fakeDriver([], ['name'], [], true), plan); expect(unknown.status).toBe('unknown'); expect(unknown.rowsCommitted).toBeNull();
});
test('SQLite parameter budget bounds batches and PostgreSQL placeholders are numbered across rows', async () => {
  const columns = Array.from({ length: 30 }, (_, index) => col(`c${index}`)), plan = prepareTableTransfer(table('sqlite', 's', columns), table('sqlite', 't', columns), input(columns.map((column) => column.name), { batchSize: 1000 })); expect(plan.effectiveBatchSize).toBe(33);
  const pg = prepareTableTransfer(table('postgres', 's', [col('a'), col('b')]), table('postgres', 't', [col('a'), col('b')]), input(['a', 'b'])), events: string[] = [];
  await executeTableTransfer(fakeDriver([['a', 'b'], ['c', 'd']], ['a', 'b'], []), fakeDriver([], ['a', 'b'], events), pg); expect(events.some((sql) => sql.includes('VALUES ($1, $2), ($3, $4)'))).toBe(true);
});
test('actual SQLite drivers transfer native rows, omitted DEFAULT/generated fields and preserve exact bytes/int64', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fouc-transfer-p0-')), sourceFile = path.join(directory, 'source.sqlite'), targetFile = path.join(directory, 'target.sqlite');
  const sourceDb = new DatabaseSync(sourceFile), targetDb = new DatabaseSync(targetFile);
  sourceDb.exec("CREATE TABLE source(id INTEGER PRIMARY KEY,name TEXT,amount TEXT,payload BLOB);INSERT INTO source VALUES(9007199254740993,'Ada','12345678901234567890.123456789',X'00ff83')");
  targetDb.exec("CREATE TABLE target(id INTEGER PRIMARY KEY,name TEXT,amount TEXT,payload BLOB,enabled INTEGER NOT NULL DEFAULT 7,display TEXT GENERATED ALWAYS AS (upper(name)) VIRTUAL)"); sourceDb.close(); targetDb.close();
  const sourceDriver = await connectSqlite({ provider: 'sqlite', path: sourceFile }), targetDriver = await connectSqlite({ provider: 'sqlite', path: targetFile });
  try {
    const metadata = async (driver: RelationalDriver, name: string): Promise<RelationalTableStructure> => { const columns = await driver.columns('main', name); return { ...await driver.structure('main', name, columns), columns, provider: 'sqlite', connectionId: name }; };
    const plan = prepareTableTransfer(await metadata(sourceDriver, 'source'), await metadata(targetDriver, 'target'), input(['id', 'name', 'amount', 'payload'])); expect(plan.executable).toBe(true);
    const result = await executeTableTransfer(sourceDriver, targetDriver, plan); expect(result.status).toBe('committed'); expect(result.rowsCommitted).toBe(1);
    const rows = await targetDriver.read('SELECT id,name,amount,payload,enabled,display FROM target', 'main', 5); expect(rows.rows).toEqual([['9007199254740993', 'Ada', '12345678901234567890.123456789', { type: 'binary', base64: 'AP+D' }, 7, 'ADA']]);
  } finally {
    await sourceDriver.close(); await targetDriver.close();
    // Bun's node:sqlite compatibility releases outstanding catalog statements during GC on Windows.
    Bun.gc(true);
    unlinkSync(sourceFile); unlinkSync(targetFile); rmdirSync(directory);
  }
});
