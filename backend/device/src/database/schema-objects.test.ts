import { expect, test } from 'bun:test';
import { DatabaseSync } from 'node:sqlite';
import { describeSchemaObject, listSchemaObjects, type NativeSchemaObjectAdapter } from './schema-objects';
import { quoteSchemaObject, schemaObjectsListInput } from './schema-objects-input';
import { splitCatalogExpressions } from './schema-objects-postgres';

test('native SQLite keeps trigger identity, header events, source and attached-schema isolation', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter: NativeSchemaObjectAdapter = { provider: 'sqlite', query: async (sql, parameters) => db.prepare(sql).all(...parameters.map(value => typeof value === 'boolean' ? Number(value) : value)) as Record<string, unknown>[] };
  try {
    db.exec(`CREATE TABLE records(id INTEGER, label TEXT); CREATE VIEW "视图'quoted" AS SELECT id,label FROM records;
      CREATE TRIGGER "触发'quoted" INSTEAD OF UPDATE ON "视图'quoted" FOR EACH ROW WHEN new.label <> '😀 BEFORE DELETE'
      BEGIN INSERT INTO records VALUES (new.id, 'AFTER DELETE'); END;
      ATTACH DATABASE ':memory:' AS "second'quoted"; CREATE VIEW "second'quoted".foreign_view AS SELECT 42 AS value;`);
    const objects = await listSchemaObjects(adapter, { schema: 'main', limit: 1 });
    expect(objects.hasMore).toBe(true);
    const list = await listSchemaObjects(adapter, { schema: 'main' });
    expect(list.supportedKinds).toEqual(['view', 'trigger']);
    expect(list.objects.map(object => object.kind).sort()).toEqual(['trigger', 'view']);
    const trigger = list.objects.find(object => object.kind === 'trigger')!;
    expect(trigger.parentName).toBe("视图'quoted");
    const details = await describeSchemaObject(adapter, trigger);
    expect(details.properties.event).toBe('UPDATE'); expect(details.properties.timing).toBe('INSTEAD OF');
    expect(details.properties.condition).toContain('😀 BEFORE DELETE');
    expect(details.definition.sql).toContain("'AFTER DELETE'");
    expect(details.definition.body).toMatch(/^BEGIN INSERT/);
    expect(details.references[0]).toMatchObject({ schema: 'main', kind: 'view', name: "视图'quoted" });
    expect(details.referencesComplete).toBe(false);
    const other = await listSchemaObjects(adapter, { schema: "second'quoted" });
    expect(other.objects.map(object => object.name)).toEqual(['foreign_view']);
    expect(list.objects.some(object => object.name === 'foreign_view')).toBe(false);
    expect((await listSchemaObjects(adapter, { schema: 'main', search: "触发'quoted" })).objects).toHaveLength(1);
    const aborted = new AbortController(); aborted.abort();
    await expect(listSchemaObjects(adapter, { schema: 'main' }, aborted.signal)).rejects.toThrow();
  } finally { db.close(); }
});

test('invalid kinds, pagination, names and PostgreSQL identity never reach catalog execution', async () => {
  let calls = 0;
  const adapter: NativeSchemaObjectAdapter = { provider: 'sqlite', query: async () => { calls++; return []; } };
  for (const input of [{ schema: 'main', kinds: ['sequence'] }, { schema: 'main', limit: 0 }, { schema: 'main', limit: 1001 }, { schema: 'main', offset: -1 }, { schema: 'main', search: 'a'.repeat(257) }, { schema: 'main\0' }]) {
    await expect(listSchemaObjects(adapter, input)).rejects.toThrow();
  }
  await expect(describeSchemaObject({ ...adapter, provider: 'postgres' }, { schema: 'public', name: 'f', kind: 'function', catalogId: '4294967296' })).rejects.toThrow();
  expect(calls).toBe(0);
  expect(quoteSchemaObject('mysql', 'a`b')).toBe('`a``b`');
  expect(quoteSchemaObject('postgres', 'a"b')).toBe('"a""b"');
  expect(schemaObjectsListInput('postgres', { schema: 'public', kinds: ['view', 'view'] }).kinds).toEqual(['view']);
});

test('PostgreSQL native defaults retain nested arrays, strings, dollar quotes and NULL', () => {
  expect(splitCatalogExpressions("ARRAY[1,2]::integer[], 'a,b'::text, $body$x,y$body$, json_build_object('a',1,'b',2), NULL::text"))
    .toEqual(['ARRAY[1,2]::integer[]', "'a,b'::text", '$body$x,y$body$', "json_build_object('a',1,'b',2)", 'NULL::text']);
});

test('authorized MySQL routine body survives denied full DDL with explicit unknown source', async () => {
  const adapter: NativeSchemaObjectAdapter = { provider: 'mysql', query: async sql => {
    if (sql.startsWith('SHOW CREATE')) throw new Error('catalog permission denied');
    if (sql.includes('information_schema.PARAMETERS')) return [{ position: 0, data_type: 'bigint', name: null, mode: null }, { position: 1, name: 'n', mode: 'IN', data_type: 'bigint', has_default: null, default_value: null }];
    return [{ schema: 'lab', name: 'native_f', kind: 'function', specific_name: 'native_f', body: 'RETURN n + 9007199254740993', return_type: 'bigint' }];
  } };
  const details = await describeSchemaObject(adapter, { schema: 'lab', name: 'native_f', kind: 'function' });
  expect(details.definition.sql).toBeNull(); expect(details.definition.origin).toBe('unknown');
  expect(details.definition.body).toContain('9007199254740993'); expect(details.returnType).toBe('bigint');
  expect(details.parameters[0]).toMatchObject({ name: 'n', mode: 'IN', hasDefault: null });
  expect(details.definition.warnings.join(' ')).toContain('permission denied');
  expect(details.referencesComplete).toBe(false);
});
