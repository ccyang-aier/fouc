import { expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DATABASE_EXPORT_MAX_BYTES, DEFAULT_DATABASE_EXPORT_INPUT, validateDatabaseExportInput, type DatabaseExportInput, type DatabaseExportProgress } from '@fouc/shared/database-export';
import type { RelationalTableStructure } from '@fouc/shared';
import { DatabaseExportJobs, prepareDatabaseExport, type NativeDatabaseExportAdapter } from './database-export';
import { compileDatabaseExportRead, decodeDatabaseExportRows } from './database-export-query';
import { databaseExportCsvRow, databaseExportDdl, databaseExportInsert } from './database-export-serialize';
import { connectSqlite } from './drivers/sqlite';
import { DatabaseExportWriter } from './database-export-writer';

const scope = { sessionId: 'session-a' };
const request = (patch: Partial<DatabaseExportInput> = {}): DatabaseExportInput => ({ ...DEFAULT_DATABASE_EXPORT_INPUT, schemas: ['main'], ...patch });

async function done(manager: DatabaseExportJobs, id: string, currentScope = scope): Promise<DatabaseExportProgress> {
  for (let count = 0; count < 1000; count++) {
    const progress = manager.status(currentScope, id);
    if (!['preparing', 'running', 'finalizing'].includes(progress.status)) return progress;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Own export P0 timed out');
}

async function cleanup(directory: string) {
  Bun.gc(true);
  for (const name of await readdir(directory)) {
    const file = resolve(directory, name);
    if (!file.startsWith(resolve(directory) + sep)) throw new Error('Unexpected cleanup target');
    await unlink(file);
  }
  await rmdir(directory);
}

function storedEntries(buffer: Buffer): Map<string, Buffer> {
  const footer = buffer.length - 22;
  expect(buffer.readUInt32LE(footer)).toBe(0x06054b50);
  const count = buffer.readUInt16LE(footer + 10), entries = new Map<string, Buffer>();
  let central = buffer.readUInt32LE(footer + 16);
  for (let index = 0; index < count; index++) {
    expect(buffer.readUInt32LE(central)).toBe(0x02014b50);
    expect(buffer.readUInt16LE(central + 10)).toBe(0);
    const size = buffer.readUInt32LE(central + 24), length = buffer.readUInt16LE(central + 28);
    const name = buffer.subarray(central + 46, central + 46 + length).toString('utf8');
    const local = buffer.readUInt32LE(central + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    expect(buffer.readUInt32LE(start + size)).toBe(0x08074b50);
    expect(buffer.readUInt32LE(start + size + 4)).toBe(buffer.readUInt32LE(central + 16));
    entries.set(name, data);
    central += 46 + length + buffer.readUInt16LE(central + 30) + buffer.readUInt16LE(central + 32);
  }
  return entries;
}

function nativeAdapter(driver: Awaited<ReturnType<typeof connectSqlite>>, database: string): NativeDatabaseExportAdapter {
  return {
    provider: 'sqlite', database, consistency: 'independent-reads',
    listTables: schema => driver.tables(schema),
    structure: async (schema, table) => {
      const columns = await driver.columns(schema, table);
      return { ...await driver.structure(schema, table, columns), columns, provider: 'sqlite', connectionId: 'p0' };
    },
    read: (sql, schema, maxRows, values, signal) => driver.read(sql, schema, maxRows, values, signal),
  };
}

test('native SQLite pages beyond one batch; SQL replay preserves integers, NULL, binary, real/text storage and delays triggers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fouc-export-p0-'));
  const file = join(directory, 'source.sqlite');
  const source = new DatabaseSync(file);
  source.exec(`CREATE TABLE "quoted""table" (id INTEGER NOT NULL PRIMARY KEY, value, nullable TEXT, bytes BLOB, "_fouc_value_0" TEXT, generated INTEGER GENERATED ALWAYS AS (id + 1) STORED);
    CREATE INDEX native_value_index ON "quoted""table"(value);
    CREATE TRIGGER native_after_insert AFTER INSERT ON "quoted""table" BEGIN UPDATE "quoted""table" SET "_fouc_value_0"='trigger fired' WHERE id=new.id; END;`);
  const insert = source.prepare(`INSERT INTO "quoted""table" (id,value,nullable,bytes,"_fouc_value_0") VALUES (?,?,?,?,?)`);
  for (let index = 0; index < 517; index++) insert.run(9007199254740993n + BigInt(index), index === 0 ? 1.5 : index === 1 ? '123' : '😀,"line\n' + index, index === 0 ? null : index === 1 ? '' : '\\N', new Uint8Array([0, 255, 39]), 'source');
  source.exec(`UPDATE "quoted""table" SET "_fouc_value_0"='retained'; UPDATE "quoted""table" SET value=CAST(1 AS REAL) WHERE id=9007199254740993;`);
  source.close();
  const driver = await connectSqlite({ provider: 'sqlite', path: file });
  const manager = new DatabaseExportJobs(directory);
  try {
    const started = manager.start(scope, nativeAdapter(driver, file), request({ packaging: 'file', partMiB: null }));
    expect(() => manager.artifact(scope, started.id)).toThrow();
    expect(() => manager.status({ ...scope, sessionId: 'other' }, started.id)).toThrow();
    expect(manager.list({ ...scope, sessionId: 'other' })).toEqual([]);
    const progress = await done(manager, started.id);
    expect(progress.error).toBeNull();
    expect(progress.status).toBe('completed');
    expect(progress.rows).toBe(517);
    expect(manager.list(scope)[0].artifact?.bytes).toBe(progress.bytes);
    expect(JSON.stringify(manager.list(scope))).not.toContain('"path"');
    expect(progress.review?.tables[0].pagination).toBe('keyset');
    const sql = await readFile(manager.artifact(scope, started.id).path, 'utf8');
    expect(sql).toContain('9007199254740993');
    expect(sql.indexOf('CREATE TRIGGER')).toBeGreaterThan(sql.lastIndexOf('INSERT INTO'));
    const restored = new DatabaseSync(':memory:');
    try {
      restored.exec(sql);
      const read = restored.prepare(`SELECT id,typeof(value),value,nullable,hex(bytes),"_fouc_value_0" FROM "quoted""table" ORDER BY id LIMIT 2`);
      read.setReadBigInts(true);
      const rows = read.all();
      expect(rows[0]).toMatchObject({ id: 9007199254740993n, 'typeof(value)': 'real', value: 1, nullable: null, 'hex(bytes)': '00FF27', _fouc_value_0: 'retained' });
      expect(rows[1]).toMatchObject({ 'typeof(value)': 'text', value: '123', nullable: '' });
      expect(restored.prepare(`SELECT count(*) AS count FROM "quoted""table"`).get()?.count).toBe(517);
      expect(restored.prepare(`SELECT name FROM sqlite_schema WHERE type='index' AND name='native_value_index'`).get()).toBeTruthy();
      restored.exec(`INSERT INTO "quoted""table"(id,value) VALUES (1,2)`);
      expect(restored.prepare(`SELECT "_fouc_value_0" AS value FROM "quoted""table" WHERE id=1`).get()?.value).toBe('trigger fired');
    } finally { restored.close(); }
    expect((await driver.read('SELECT count(*) FROM "quoted""table"', 'main', 1)).rows[0][0]).toBe(517);
  } finally { await manager.close(); await driver.close(); await cleanup(directory); }
});

test('CSV / NDJSON / JSON retain exact raw values and actual explicit limit; ZIP central directory and CRC are standard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fouc-export-format-p0-'));
  const file = join(directory, 'source.sqlite');
  const source = new DatabaseSync(file);
  source.exec(`CREATE TABLE data(id INTEGER NOT NULL PRIMARY KEY, label TEXT, nullable TEXT, bytes BLOB); INSERT INTO data VALUES(9007199254740993,'😀,"\n',NULL,X'00FF'),(9007199254740994,'','\\N',X'');`);
  source.close();
  const driver = await connectSqlite({ provider: 'sqlite', path: file });
  const manager = new DatabaseExportJobs(directory);
  try {
    for (const format of ['csv', 'ndjson', 'json'] as const) {
      const job = manager.start(scope, nativeAdapter(driver, file), request({ format, includeStructure: false, rowLimit: 1, packaging: 'file', partMiB: null }));
      const progress = await done(manager, job.id);
      expect(progress.status).toBe('completed');
      expect(progress.summary?.tables[0].limited).toBe(true);
      const text = await readFile(manager.artifact(scope, job.id).path, 'utf8');
      expect(text).toContain('9007199254740993');
      if (format === 'csv') { expect(text).toContain('"id","label","nullable","bytes"'); expect(text).toContain(',\\N,"base64:AP8="'); }
      else { expect(text).toContain('"id":9007199254740993'); expect(text).toContain('"nullable":null'); expect(text).toContain('"base64":"AP8="'); expect(JSON.parse(format === 'json' ? text : '[' + text.trim() + ']')[0].label).toBe('😀,"\n'); }
    }
    expect([...databaseExportCsvRow({ values: ['', '\\N', null], types: ['text', 'text', 'null'] }, 'sqlite')].join('')).toBe('"","\\N",\\N\r\n');
    const seed = new DatabaseSync(file);
    const large = 'q'.repeat(600_000) + '😀';
    seed.prepare('UPDATE data SET label=?').run(large);
    seed.prepare('INSERT INTO data VALUES(9007199254740995,?,?,?)').run(large, '', new Uint8Array());
    seed.close();
    const zipJob = manager.start(scope, nativeAdapter(driver, file), request({ format: 'json', includeStructure: false, packaging: 'zip', partMiB: 1 }));
    expect((await done(manager, zipJob.id)).status).toBe('completed');
    const entries = storedEntries(await readFile(manager.artifact(scope, zipJob.id).path));
    const manifest = JSON.parse(entries.get('manifest.json')!.toString());
    expect(manifest.summary.rows).toBe(3);
    expect(manifest.review.tables[0].columns[0].nativeType).toBe('INTEGER');
    const parts = [...entries].filter(([name]) => name !== 'manifest.json').map(([, bytes]) => JSON.parse(bytes.toString()));
    expect(parts).toHaveLength(2);
    expect(parts.flat()).toHaveLength(3);
    expect(parts.flat().every(row => row.label === large)).toBe(true);
    const reference = join(directory, 'reference.zip');
    const writer = await DatabaseExportWriter.create(reference, true, new AbortController().signal, () => undefined);
    await writer.begin('crc.txt'); await writer.write(['123456789']); await writer.finish();
    const bytes = await readFile(reference);
    const footer = bytes.length - 22, central = bytes.readUInt32LE(footer + 16);
    expect(bytes.readUInt32LE(central + 16)).toBe(0xcbf43926);
  } finally { await manager.close(); await driver.close(); await cleanup(directory); }
});

test('native SQL compilation is parameterized; PostgreSQL raw JSON/numeric arrays and MySQL geometry bypass lossy driver decoding', () => {
  const columns = ['id', 'raw_json', 'raw_array'].map((name, index) => ({ name, dataType: ['bigint', 'jsonb', 'numeric[]'][index], isNullable: false, isPrimaryKey: index === 0, isUnique: false, columnDefault: null, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null }));
  const structure: RelationalTableStructure = { provider: 'postgres', connectionId: 'test', schema: 'a"schema', table: 'table', kind: 'table', columns, indexes: [], foreignKeys: [], constraints: [], triggers: [], properties: {}, definition: { sql: 'CREATE TABLE "a""schema"."table" (id bigint);', origin: 'native', warnings: [] } };
  const review = { schema: structure.schema, table: structure.table, key: 'key', kind: 'table' as const, columns: columns.map(column => ({ name: column.name, nativeType: column.dataType, wireEncoding: 'native-text' as const, generated: false })), pagination: 'keyset' as const, orderColumns: ['id'], ddlOrigin: 'native' as const, dataIncluded: true, structureIncluded: true, warnings: [] };
  const read = compileDatabaseExportRead(structure, review, 500, 0, { values: ['9007199254740993'] });
  expect(read.sql).toContain('"raw_json"::text'); expect(read.sql).toContain('"raw_array"::text'); expect(read.sql).toContain('"a""schema"."table"');
  expect(read.values).toEqual(['9007199254740993', 501]);
  expect(read.sql).not.toContain('9007199254740993');
  const rows = decodeDatabaseExportRows({ columns: [], columnTypes: [], hasMore: false, rows: [['9007199254740993', '{"n":9007199254740993}', '{9007199254740993,1.0000000000000001}']] }, structure);
  const sql = [...databaseExportInsert(rows, structure)].join('');
  expect(sql).toContain('9007199254740993'); expect(sql).toContain('{9007199254740993,1.0000000000000001}');
  const mysql = { ...structure, provider: 'mysql' as const, columns: [{ ...columns[0], dataType: 'point' }] };
  const geometry = decodeDatabaseExportRows({ columns: [], columnTypes: [], hasMore: false, rows: [['000010E60101000000000000000000F03F0000000000000040']] }, mysql);
  expect([...databaseExportInsert(geometry, mysql)].join('')).toContain("ST_GeomFromWKB(X'0101000000000000000000f03f0000000000000040', 4326)");
  const trigger = 'CREATE TRIGGER native_trigger BEFORE INSERT ON "a""schema"."table" EXECUTE FUNCTION native_fn()';
  const withTrigger = { ...structure, triggers: [{ name: 'native_trigger', enabled: 'DISABLED', definition: trigger, timing: 'BEFORE', events: ['INSERT'], orientation: 'ROW' }], definition: { ...structure.definition, sql: structure.definition.sql + '\n' + trigger + ';\nALTER TABLE "a""schema"."table" DISABLE TRIGGER "native_trigger";' } };
  const ddl = databaseExportDdl(withTrigger);
  expect(ddl.before).not.toContain('TRIGGER'); expect(ddl.after.join('')).toContain('DISABLE TRIGGER');
});

test('invalid input, metadata mismatch and cancellation publish no partial artifact; session cleanup is isolated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fouc-export-cancel-p0-'));
  const manager = new DatabaseExportJobs(directory);
  let reads = 0;
  const structure: RelationalTableStructure = { provider: 'sqlite', connectionId: 'test', schema: 'main', table: 'table', kind: 'table', columns: [{ name: 'id', dataType: 'INTEGER', isNullable: false, isPrimaryKey: true, isUnique: false, columnDefault: null, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null }], indexes: [], foreignKeys: [], constraints: [], triggers: [], properties: {}, definition: { sql: 'CREATE TABLE "table"(id INTEGER PRIMARY KEY);', origin: 'native', warnings: [] } };
  const adapter: NativeDatabaseExportAdapter = { provider: 'sqlite', database: 'lab', consistency: 'independent-reads', listTables: async () => [{ schema: 'main', name: 'table', kind: 'table' }], structure: async () => structure, read: async (_sql, _schema, _max, _values, signal) => { reads++; await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 100); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); }); return { columns: [], columnTypes: [], rows: [['1', 'integer'], ['2', 'integer']], hasMore: true }; } };
  try {
    for (const input of [request({ pageSize: 0 }), request({ rowLimit: -1 }), { ...request(), outputPath: 'client-path' }, request({ format: 'json' })]) expect(() => validateDatabaseExportInput(input)).toThrow();
    await expect(prepareDatabaseExport(adapter, { ...request(), tables: [{ schema: 'other', table: 'table' }] })).rejects.toThrow();
    expect(reads).toBe(0);
    const job = manager.start(scope, adapter, request());
    for (let index = 0; index < 100 && !reads; index++) await new Promise(resolve => setTimeout(resolve, 2));
    manager.cancel(scope, job.id);
    expect((await done(manager, job.id)).status).toBe('cancelled');
    expect(() => manager.artifact(scope, job.id)).toThrow();
    expect(() => manager.cancel({ ...scope, sessionId: 'other' }, job.id)).toThrow();
    await manager.closeSession({ ...scope, sessionId: 'other' });
    expect(manager.status(scope, job.id).status).toBe('cancelled');
    await manager.closeSession(scope);
    expect(() => manager.status(scope, job.id)).toThrow();
    expect(await readdir(directory)).toEqual([]);
    let structures = 0;
    const changed = manager.start(scope, { ...adapter, structure: async () => ++structures === 1 ? structure : { ...structure, columns: [{ ...structure.columns[0], name: 'changed' }] } }, request());
    const failure = await done(manager, changed.id);
    expect(failure.status).toBe('failed');
    expect(failure.error).toContain('结构在准备后发生变化');
    expect(() => manager.artifact(scope, changed.id)).toThrow();
    const limited = new DatabaseExportJobs(directory, { maxStoredBytes: 32, maxSessionBytes: 32 });
    try {
      const budgetJob = limited.start(scope, adapter, request());
      const budgetFailure = await done(limited, budgetJob.id);
      expect(budgetFailure.status).toBe('failed');
      expect(budgetFailure.error).toContain('临时文件预算');
      expect(() => limited.artifact(scope, budgetJob.id)).toThrow();
    } finally { await limited.close(); }
    expect(DATABASE_EXPORT_MAX_BYTES).toBe(1024 * 1024 * 1024);
  } finally { await manager.close(); await cleanup(directory); }
});


test('export disk budgets aggregate files per session and across the device, releasing failed artifacts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fouc-export-budget-p0-'));
  const manager = new DatabaseExportJobs(directory, { maxStoredBytes: 20, maxSessionBytes: 10 });
  const structure: RelationalTableStructure = {
    provider: 'sqlite', connectionId: 'test', schema: 'main', table: 'table', kind: 'table',
    columns: [{ name: 'id', dataType: 'INTEGER', isNullable: false, isPrimaryKey: true, isUnique: false, columnDefault: null, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null }],
    indexes: [], foreignKeys: [], constraints: [], triggers: [], properties: {},
    definition: { sql: 'CREATE TABLE "table"(id INTEGER PRIMARY KEY);', origin: 'native', warnings: [] },
  };
  const adapter: NativeDatabaseExportAdapter = {
    provider: 'sqlite', database: 'lab', consistency: 'independent-reads',
    listTables: async () => [{ schema: 'main', name: 'table', kind: 'table' }],
    structure: async () => structure,
    read: async () => ({ columns: [], columnTypes: [], rows: [], hasMore: false }),
  };
  const input = request({ format: 'csv', packaging: 'file', partMiB: null, includeStructure: false });
  const exportFor = async (sessionId: string) => {
    const owner = { sessionId }, job = manager.start(owner, adapter, input);
    return { owner, job, progress: await done(manager, job.id, owner) };
  };
  try {
    const first = await exportFor('a');
    expect(first.progress.error).toBeNull();
    expect(first.progress.status).toBe('completed');
    expect(first.progress.bytes).toBe(6);
    const sameSession = await exportFor('a');
    expect(sameSession.progress.status).toBe('failed');
    expect(sameSession.progress.error).toContain('临时文件预算');
    expect(() => manager.artifact(sameSession.owner, sameSession.job.id)).toThrow();
    expect((await exportFor('b')).progress.status).toBe('completed');
    expect((await exportFor('c')).progress.status).toBe('completed');
    const fullDevice = await exportFor('d');
    expect(fullDevice.progress.status).toBe('failed');
    expect(fullDevice.progress.error).toContain('临时文件预算');
    await manager.discard(first.owner, first.job.id);
    expect((await exportFor('d')).progress.status).toBe('completed');
  } finally { await manager.close(); await cleanup(directory); }
});
