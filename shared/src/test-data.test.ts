import { expect, test } from 'bun:test';
import type { DatabaseColumnInfo } from './database';
import type { RelationalTableStructure } from './relational-structure';
import { parseTableImport } from './table-import';
import { buildTestDataImport, defaultTestDataConfig, generateTestDataPreview, validateTestDataConfig } from './test-data';

function column(name: string, dataType: string, patch: Partial<DatabaseColumnInfo> = {}): DatabaseColumnInfo {
  return {
    name, dataType, isNullable: false, columnDefault: null, isPrimaryKey: false,
    isUnique: false, extra: null, comment: null, numericPrecision: null,
    numericScale: null, characterMaximumLength: null, ...patch,
  };
}

function structure(columns: DatabaseColumnInfo[]): RelationalTableStructure {
  return {
    connectionId: 'test-session', provider: 'postgres', schema: 'lab', table: 'generated', kind: 'table',
    columns, indexes: [], foreignKeys: [], constraints: [], triggers: [], properties: {},
    definition: { sql: '', origin: 'native', warnings: [] },
  };
}

test('seeded sample matches the actual bounded batch, preserving BIGINT and scaled DECIMAL lexical values', async () => {
  const table = structure([
    column('id', 'bigint', { isPrimaryKey: true }),
    column('amount', 'numeric', { numericPrecision: 40, numericScale: 18 }),
    column('name', 'varchar', { characterMaximumLength: 40 }),
    column('uuid', 'uuid'), column('active', 'boolean'), column('note', 'text', { isNullable: true }),
  ]);
  const config = defaultTestDataConfig(table);
  config.rowCount = 25;
  config.columns[0].generator = { kind: 'sequence', start: '9007199254740993', step: '1' };
  config.columns[1].generator = { kind: 'sequence', start: '9007199254.100000000000000001', step: '0.000000000000000001' };
  config.columns[5].nullPercent = 100;
  const sample = generateTestDataPreview(table, config);
  const generated = await buildTestDataImport(table, config);
  const repeated = await buildTestDataImport(table, config);
  const parsed = parseTableImport(generated.input.text, generated.input.options);
  expect(generated.input.text).toBe(repeated.input.text);
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.slice(0, 20)).toEqual(sample.parsed.rows);
  expect(sample.targetRows).toBe(25);
  expect(sample.sampleRows).toBe(20);
  expect(parsed.rows[0][0]).toEqual({ kind: 'number', value: '9007199254740993' });
  expect(parsed.rows[24][0]).toEqual({ kind: 'number', value: '9007199254741017' });
  expect(parsed.rows[0][1]).toEqual({ kind: 'number', value: '9007199254.100000000000000001' });
  expect(parsed.rows[24][1]).toEqual({ kind: 'number', value: '9007199254.100000000000000025' });
  expect(generated.input.text).toContain('"id":9007199254740993');
  expect(generated.input.text).toContain('"amount":9007199254.100000000000000001');
  expect(parsed.rows.every(row => row[5].kind === 'null')).toBe(true);
  const uuid = parsed.rows[0][3];
  expect(uuid.kind === 'text' && uuid.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(generated.bytes).toBe(new TextEncoder().encode(generated.input.text).length);
  config.seed = 'different-seed';
  expect((await buildTestDataImport(table, config)).input.text).not.toBe(generated.input.text);
});

test('UTC leap dates and times stay inside their configured range and reject rolled-over calendar dates', async () => {
  const table = structure([column('day', 'date'), column('moment', 'timestamp with time zone'), column('clock', 'time')]);
  const config = defaultTestDataConfig(table);
  config.rowCount = 40;
  config.columns[0].generator = { kind: 'date', start: '2024-02-28', end: '2024-03-01' };
  config.columns[1].generator = { kind: 'datetime', start: '2024-02-29T12:00:00.000Z', end: '2024-02-29T12:00:01.000Z' };
  config.columns[2].generator = { kind: 'time', start: '09:00:00', end: '09:00:01' };
  const batch = await buildTestDataImport(table, config);
  const parsed = parseTableImport(batch.input.text, batch.input.options);
  for (const row of parsed.rows) {
    expect(row[0].kind === 'text' && ['2024-02-28', '2024-02-29', '2024-03-01'].includes(row[0].value)).toBe(true);
    const date = row[1].kind === 'text' ? Date.parse(row[1].value) : NaN;
    expect(date).toBeGreaterThanOrEqual(Date.parse('2024-02-29T12:00:00Z'));
    expect(date).toBeLessThanOrEqual(Date.parse('2024-02-29T12:00:01Z'));
    expect(row[2].kind === 'text' && row[2].value >= '09:00:00.000' && row[2].value <= '09:00:01.000').toBe(true);
  }
  config.columns[0].generator = { kind: 'date', start: '2025-02-29', end: '2025-03-01' };
  expect(validateTestDataConfig(table, config).valid).toBe(false);
  expect(() => generateTestDataPreview(table, config)).toThrow('真实');
});

test('native identity, generated columns, defaults and foreign references cannot bypass import mapping restrictions', () => {
  const table = structure([
    column('id', 'bigint', { isPrimaryKey: true, extra: 'identity' }),
    column('computed', 'integer', { extra: 'STORED GENERATED' }),
    column('label', 'varchar', { columnDefault: "'native'", characterMaximumLength: 40 }),
    column('value', 'integer'), column('parent', 'integer', { isNullable: true }),
  ]);
  table.foreignKeys = [{ name: 'parent_fk', nameSource: 'catalog', columns: ['parent'], referencedSchema: 'lab', referencedTable: 'parent', referencedColumns: ['id'], onUpdate: 'NO ACTION', onDelete: 'NO ACTION', match: 'SIMPLE', deferrable: false, initiallyDeferred: false, validated: true, definition: null }];
  const config = defaultTestDataConfig(table);
  expect(config.columns.map(item => item.enabled)).toEqual([false, false, false, true, false]);
  expect(validateTestDataConfig(table, config).valid).toBe(true);
  config.columns[0].enabled = true;
  expect(validateTestDataConfig(table, config).valid).toBe(false);
  config.columns[0].enabled = false;
  config.columns[4].enabled = true;
  expect(validateTestDataConfig(table, config).errors.some(issue => issue.message.includes('外键'))).toBe(true);
  config.columns[4].enabled = false;
  table.columns[4].isNullable = false;
  expect(validateTestDataConfig(table, config).errors.some(issue => issue.message.includes('必填'))).toBe(true);
  const illegal = { ...config, unexpected: true };
  expect(validateTestDataConfig(table, illegal).valid).toBe(false);
  const duplicated = { ...config, columns: config.columns.map((item, index) => index === 1 ? { ...item, column: 'id' } : item) };
  expect(validateTestDataConfig(table, duplicated).errors.some(issue => issue.message.includes('重复'))).toBe(true);
  const arrayTable = structure([column('values', 'integer[]')]);
  expect(defaultTestDataConfig(arrayTable).columns[0].enabled).toBe(false);
  expect(validateTestDataConfig(arrayTable, defaultTestDataConfig(arrayTable)).valid).toBe(false);
});

test('single and composite native uniqueness reject impossible batches and enforce numeric canonical identity', async () => {
  const table = structure([column('id', 'integer', { isUnique: true }), column('part', 'text')]);
  const config = defaultTestDataConfig(table);
  config.rowCount = 50;
  config.columns[0].generator = { kind: 'integer', min: '1', max: '1000' };
  const generated = await buildTestDataImport(table, config);
  const parsed = parseTableImport(generated.input.text, generated.input.options);
  expect(new Set(parsed.rows.map(row => row[0].kind === 'number' ? row[0].value : '')).size).toBe(50);
  config.columns[0].generator = { kind: 'integer', min: '1', max: '2' };
  expect(validateTestDataConfig(table, config).valid).toBe(false);
  config.columns[0].unique = false;
  expect(validateTestDataConfig(table, config).errors.some(issue => issue.message.includes('唯一字段'))).toBe(true);
  config.columns[0].generator = { kind: 'decimal', min: '0', max: '100', scale: 2 };
  expect(validateTestDataConfig(table, config).errors.some(issue => issue.message.includes('整数列'))).toBe(true);
  const composite = structure([column('a', 'text', { isPrimaryKey: true }), column('b', 'text', { isPrimaryKey: true })]);
  const duplicate = defaultTestDataConfig(composite);
  duplicate.rowCount = 2;
  duplicate.columns.forEach(item => { item.generator = { kind: 'constant', value: 'same' }; });
  await expect(buildTestDataImport(composite, duplicate)).rejects.toThrow('唯一约束');
  const decimals = structure([column('value', 'numeric', { isUnique: true, numericPrecision: 10, numericScale: 2 })]);
  const exact = defaultTestDataConfig(decimals);
  exact.rowCount = 2;
  exact.columns[0].generator = { kind: 'enum', values: ['1', '1.00'] };
  await expect(buildTestDataImport(decimals, exact)).rejects.toThrow('唯一约束');
  exact.columns[0].generator = { kind: 'decimal', min: '0', max: '0.001', scale: 2 };
  expect(validateTestDataConfig(decimals, exact).valid).toBe(false);
});

test('row, cell and UTF-8 byte budgets are enforced and cancellation stops before transport', async () => {
  const table = structure([column('note', 'text')]);
  const config = defaultTestDataConfig(table);
  config.rowCount = 5001;
  expect(validateTestDataConfig(table, config).valid).toBe(false);
  config.rowCount = 1500;
  config.columns[0].generator = { kind: 'constant', value: '中'.repeat(4096) };
  await expect(buildTestDataImport(table, config)).rejects.toThrow('5 MiB');
  const controller = new AbortController();
  config.rowCount = 5000;
  config.columns[0].generator = { kind: 'text', length: 10 };
  let reached = 0;
  await expect(buildTestDataImport(table, config, { signal: controller.signal, onProgress: rows => { reached = rows; controller.abort(); } })).rejects.toThrow('取消');
  expect(reached).toBe(100);
  const wide = structure(Array.from({ length: 21 }, (_, index) => column('c' + index, 'integer')));
  const wideConfig = defaultTestDataConfig(wide);
  wideConfig.rowCount = 5000;
  expect(validateTestDataConfig(wide, wideConfig).errors.some(issue => issue.message.includes('100,000'))).toBe(true);
});
