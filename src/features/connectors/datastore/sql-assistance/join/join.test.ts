import { expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import type { DatabaseColumnInfo, DatabaseObjectInfo, RelationalProvider, RelationalTableStructure } from '@fouc/shared';
import { sqlJoinRelationships } from '@fouc/shared/sql-join';
import { SqlJoinCompletion, SQL_JOIN_CANDIDATE_LIMIT } from './completion';
import { sqlJoinContext } from './context';

function context(source: string): CompletionContext {
  const pos = source.indexOf('|');
  return new CompletionContext(EditorState.create({ doc: source.replace('|', '') }), pos, true);
}
function column(name: string): DatabaseColumnInfo {
  return { name, dataType: 'integer', isNullable: false, columnDefault: null, isPrimaryKey: false, isUnique: false, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null };
}
function fixture(provider: RelationalProvider = 'sqlite') {
  const parent: RelationalTableStructure = { provider, connectionId: 'scope', schema: 'main', table: 'parents', kind: 'table', columns: ['tenant', 'id'].map(column), foreignKeys: [], indexes: [], constraints: [], triggers: [], properties: {}, definition: { sql: '', origin: 'native', warnings: [] } };
  const child = { ...parent, table: 'children', columns: ['tenant', 'parent_id'].map(column), foreignKeys: [{ name: 'fk_pair', nameSource: 'catalog' as const, columns: ['tenant', 'parent_id'], referencedSchema: 'main', referencedTable: 'parents', referencedColumns: ['tenant', 'id'], onUpdate: 'NO ACTION', onDelete: 'NO ACTION', match: 'NONE', deferrable: false, initiallyDeferred: false, validated: true, definition: null }] };
  const structures = [child, parent];
  const calls: string[] = [];
  const model = new SqlJoinCompletion(provider, {
    tables: async schema => structures.map(table => ({ name: table.table, schema, database: 'db', connectionId: 'scope', kind: 'table', comment: null })),
    structure: async (schema, table) => { calls.push(schema + '.' + table); return structures.find(item => item.schema === schema && item.table === table)!; },
  });
  return { model, calls, parent, child };
}
const target = { schema: 'main', schemas: ['main'] };

test('native catalog pairs retain order and only actual valid foreign keys form relations', () => {
  const { parent, child } = fixture();
  expect(sqlJoinRelationships([parent, child], 'sqlite')[0].pairs).toEqual([{ owner: 'tenant', referenced: 'tenant' }, { owner: 'parent_id', referenced: 'id' }]);
  expect(sqlJoinRelationships([{ ...child, foreignKeys: [{ ...child.foreignKeys[0], referencedColumns: ['id'] }] }], 'sqlite')).toHaveLength(0);
  expect(sqlJoinRelationships([{ ...child, foreignKeys: [{ ...child.foreignKeys[0], columns: ['missing', 'parent_id'] }] }], 'sqlite')).toHaveLength(0);
  expect(sqlJoinRelationships([parent, child], 'postgres')).toHaveLength(0);
});

test('forward/reverse JOIN and composite ON use aliases and exact native quoting', async () => {
  for (const provider of ['mysql', 'postgres', 'sqlite'] as const) {
    const { model } = fixture(provider);
    const q = provider === 'mysql' ? '`' : '"';
    const table = await model.complete(context('SELECT * FROM children c JOIN par|'), target);
    expect(table?.options[0].apply).toBe(`${q}main${q}.${q}parents${q} AS ${q}p${q} ON ${q}c${q}.${q}tenant${q} = ${q}p${q}.${q}tenant${q} AND ${q}c${q}.${q}parent_id${q} = ${q}p${q}.${q}id${q}`);
    const reverse = await model.complete(context('SELECT * FROM parents p jo|'), target, 'lower');
    expect(reverse?.options[0].apply).toBe(`join ${q}main${q}.${q}children${q} as ${q}c${q} on ${q}c${q}.${q}tenant${q} = ${q}p${q}.${q}tenant${q} and ${q}c${q}.${q}parent_id${q} = ${q}p${q}.${q}id${q}`);
    const on = await model.complete(context(`SELECT * FROM parents ${q}p alias${q} JOIN children c ON |`), target);
    expect(on?.options[0].apply).toBe(`${q}c${q}.${q}tenant${q} = ${q}p alias${q}.${q}tenant${q} AND ${q}c${q}.${q}parent_id${q} = ${q}p alias${q}.${q}id${q}`);
  }
});

test('current block and lexical suppression never borrow another statement, CTE or correlated alias', async () => {
  const { model, calls } = fixture();
  for (const sql of ["SELECT 'JOIN par|' FROM children c", 'SELECT * FROM children c -- JOIN par|', 'WITH children AS (SELECT 1) SELECT * FROM children c JOIN par|', 'SELECT * FROM children c; SELECT 1 JOIN par|', 'SELECT (SELECT * FROM parents p JOIN children c ON p.id = |) FROM children outer_c']) expect(await model.complete(context(sql), target)).toBeNull();
  expect(calls).toHaveLength(0);
  const nested = sqlJoinContext(context('SELECT (SELECT * FROM children c JOIN parents p ON |) FROM children outer_c'), 'sqlite');
  expect(nested?.references.map(ref => ref.alias)).toEqual(['c', 'p']);
  expect(await model.complete(context('SELECT * FROM children c JOIN par| ON c.id = p.id'), target)).toBeNull();
  expect(await model.complete(context('SELECT * FROM children c NATURAL JOIN par|'), target)).toBeNull();
  expect(await model.complete(context('SELECT * FROM children c CROSS JOIN par|'), target)).toBeNull();
  expect(await model.complete(context('SELECT * FROM children jo|'), target)).toBeNull();
  const qualified = await model.complete(context('SELECT * FROM children c JOIN main.par|'), target);
  expect(qualified?.options[0].apply).toMatch(/^"parents" AS "p" ON /);
  expect(await model.complete(context('SELECT * FROM children c JOIN parents p ON c.|'), target)).not.toBeNull();
  expect((await model.complete(context('SELECT * FROM children c JOIN parents p ON p.|'), target))?.options[0].apply).toBe('"p"."tenant" = "c"."tenant" AND "p"."id" = "c"."parent_id"');
});

test('USING is offered only for identically named full FK pairs and not inside an existing list', async () => {
  const { parent, child } = fixture();
  child.columns = ['tenant', 'id'].map(column); child.foreignKeys[0].columns = ['tenant', 'id'];
  const model = new SqlJoinCompletion('sqlite', { tables: async () => [], structure: async (_, table) => table === 'children' ? child : parent });
  expect((await model.complete(context('SELECT * FROM children c JOIN parents p USING (|)'), target))?.options[0].apply).toBe('"tenant", "id"');
  expect((await model.complete(context('SELECT * FROM children c JOIN parents p USING |'), target))?.options[0].apply).toBe('("tenant", "id")');
  expect(await model.complete(context('SELECT * FROM children c JOIN parents p USING (tenant, |)'), target)).toBeNull();
  const { model: unequal } = fixture();
  expect(await unequal.complete(context('SELECT * FROM children c JOIN parents p USING (|)'), target)).toBeNull();
});

test('bounded reverse reads, session-owned cache, refresh abort and oversized documents', async () => {
  const { child, parent } = fixture();
  const loaded: string[] = [];
  const model = new SqlJoinCompletion('sqlite', { tables: async () => Array.from({ length: 100 }, (_, index): DatabaseObjectInfo => ({ name: 'table_' + index, schema: 'main', database: 'db', connectionId: 'scope', kind: 'table', comment: null })), structure: async (_, table) => { loaded.push(table); return table === 'children' ? child : table === 'parents' ? parent : { ...parent, table }; } });
  await model.complete(context('SELECT * FROM children c jo|'), target);
  expect(loaded.length).toBeLessThanOrEqual(SQL_JOIN_CANDIDATE_LIMIT + 1);
  const count = loaded.length;
  await model.complete(context('SELECT * FROM children c jo|'), target);
  expect(loaded.length).toBe(count);
  expect(await model.complete(context('SELECT * FROM children c JOIN par|' + ' '.repeat(128_000)), target)).toBeNull();
  let resolve!: (value: RelationalTableStructure) => void, signal!: AbortSignal;
  const pending = new SqlJoinCompletion('sqlite', { tables: async () => [], structure: async (_, __, observed) => { signal = observed; return new Promise(done => { resolve = done; }); } });
  const request = pending.complete(context('SELECT * FROM children c JOIN par|'), target);
  await Promise.resolve(); pending.clear(); expect(signal.aborted).toBe(true);
  resolve(child); expect(await request).toBeNull(); expect(pending.getSnapshot()).toEqual({ pending: 0, error: '' });
});
