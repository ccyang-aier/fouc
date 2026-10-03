import { describe, expect, test } from 'bun:test';
import type { DatabaseColumnInfo, DatabaseObjectInfo, SchemaObject, SchemaObjectList } from '@fouc/shared';
import { schemaSearchInput } from './schema-search-input';
import { searchNativeSchema, type NativeSchemaSearchAdapter } from './schema-search';
import { schemaSearchQueue } from './schema-search-concurrency';

const column = (name: string): DatabaseColumnInfo => ({ name, dataType: 'TEXT', isNullable: true, isPrimaryKey: false, isUnique: false, columnDefault: null, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null });
const relation = (schema: string, name: string, kind: DatabaseObjectInfo['kind'] = 'table'): DatabaseObjectInfo => ({ connectionId: 'session-a', database: 'db', schema, name, kind, comment: null });
const object = (name: string, catalogId: string, signature: string | null = null, kind: SchemaObject['kind'] = 'function'): SchemaObject => ({ id: JSON.stringify(['public', kind, catalogId]), schema: 'public', kind, name, catalogId, signature, displayName: signature === null ? name : `${name}(${signature})`, parentSchema: null, parentName: null, owner: null, comment: null, createdAt: null, updatedAt: null });
const list = (schema: string, objects: SchemaObject[] = [], hasMore = false): SchemaObjectList => ({ provider: 'postgres', schema, objects, supportedKinds: ['function', 'view'], offset: 0, limit: 1000, hasMore, warnings: [] });
function adapter(extra: Partial<NativeSchemaSearchAdapter> = {}): NativeSchemaSearchAdapter { return { scopeKey: crypto.randomUUID(), provider: 'postgres', schemas: async () => ['public', 'other'], tables: async (schema) => [relation(schema, 'users')], columns: async () => [column('email'), column('id')], schemaObjects: async (input) => list(input.schema), ...extra }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve }; }

describe('authorized native schema search', () => {
  test('current-session schemas, actual parent relations and exact field ordering are retained', async () => {
    const data = await searchNativeSchema(adapter({ tables: async (schema) => [relation(schema, 'email_log'), relation(schema, 'users')] }), { query: 'email', kinds: ['column', 'table'] });
    expect(data.scope.schemas).toEqual(['other', 'public']); expect(data.hits[0].kind).toBe('column'); expect(data.hits[0].parentName).toBe('email_log'); expect(data.hits[0].relation?.connectionId).toBe('session-a'); expect(data.scope.columnTablesScanned).toBe(4); expect(data.scope.complete).toBe(true);
    const path = await searchNativeSchema(adapter(), { query: 'public.users.email', kinds: ['column'], schemas: ['public'] });
    expect(path.hits).toHaveLength(1); expect(path.hits[0].column).toBe('email'); expect(path.scope.schemas).toEqual(['public']);
  });
  test('unlisted schema names are rejected before probing metadata and SQL-shaped text remains a literal matcher', async () => {
    let probes = 0;
    const a = adapter({ tables: async () => { probes++; return []; } });
    await expect(searchNativeSchema(a, { query: 'x', schemas: ['secret'] })).rejects.toThrow('不属于当前连接'); expect(probes).toBe(0);
    const data = await searchNativeSchema(adapter({ tables: async (schema) => [relation(schema, "users'; DROP TABLE users;")] }), { query: "'; DROP", kinds: ['table'] });
    expect(data.hits).toHaveLength(2); expect(data.hits[0].name).toBe("users'; DROP TABLE users;");
  });
  test('catalog views keep real OIDs, and routine overloads remain independent identities', async () => {
    const data = await searchNativeSchema(adapter({ schemas: async () => ['public'], tables: async () => [relation('public', 'report', 'view')], schemaObjects: async () => list('public', [object('report', '100', null, 'view'), object('report', '101', 'integer'), object('report', '102', 'text')]) }), { query: 'report' });
    expect(data.hits).toHaveLength(3); expect(new Set(data.hits.map((hit) => hit.id)).size).toBe(3); expect(data.hits.find((hit) => hit.kind === 'view')?.object?.catalogId).toBe('100');
  });
  test('partial permissions, catalog paging and result limits are explicit', async () => {
    const data = await searchNativeSchema(adapter({ columns: async (schema) => { if (schema === 'other') throw new Error('无字段读取权限'); return [column('email')]; }, schemaObjects: async (input) => list(input.schema, [], input.schema === 'public') }), { query: 'email', includeColumns: true, limit: 1 });
    expect(data.scope.complete).toBe(false); expect(data.issues[0].operation).toBe('columns'); expect(data.issues[0].schema).toBe('other'); expect(data.scope.limits.some((message) => message.includes('第一页'))).toBe(true); expect(data.truncated).toBe(true);
    const capped = await searchNativeSchema(adapter(), { query: 'users', kinds: ['table'], limit: 1 }); expect(capped.totalMatches).toBe(2); expect(capped.hits).toHaveLength(1); expect(capped.truncated).toBe(true);
  });
  test('field traversal is bounded and object-only searches never read columns', async () => {
    let calls = 0;
    const a = adapter({ schemas: async () => ['public'], tables: async () => Array.from({ length: 125 }, (_, index) => relation('public', `table_${index}`)), columns: async () => { calls++; return [column('value')]; } });
    await searchNativeSchema(a, { query: 'table', kinds: ['table'] }); expect(calls).toBe(0);
    const data = await searchNativeSchema(a, { query: 'value', kinds: ['column'] }); expect(calls).toBe(120); expect(data.scope.columnTablesTotal).toBe(125); expect(data.scope.limits.some((message) => message.includes('120 / 125'))).toBe(true);
  });
  test('validation rejects empty names, unknown kinds, oversized schema scopes and nonboolean options', () => {
    expect(() => schemaSearchInput({ query: '' })).toThrow(); expect(() => schemaSearchInput({ query: 'a', kinds: ['connection'] })).toThrow(); expect(() => schemaSearchInput({ query: 'a', includeColumns: 1 })).toThrow(); expect(() => schemaSearchInput({ query: 'a', schemas: Array(33).fill('public') })).toThrow(); expect(() => schemaSearchInput({ query: 'a', limit: 501 })).toThrow(); expect(schemaSearchInput({ query: 'x', kinds: ['column'] }).includeColumns).toBe(true);
  });
});

test('queue cancellation rejects promptly, schedules no stale reads and keeps native concurrency bounded across searches', async () => {
  const first = new AbortController(), next = new AbortController(), scope = crypto.randomUUID(), one = schemaSearchQueue(first.signal, 1, scope), two = schemaSearchQueue(next.signal, 1, scope), held = deferred<number>();
  let reads = 0;
  const running = one.run(async () => { reads++; return held.promise; }), pending = one.run(async () => { reads++; return 2; });
  const runningRejected = running.catch(() => 'aborted'), pendingRejected = pending.catch(() => 'aborted');
  await Promise.resolve(); first.abort(new DOMException('cancelled', 'AbortError'));
  expect(await runningRejected).toBe('aborted'); expect(await pendingRejected).toBe('aborted');
  const fresh = two.run(async () => { reads++; return 3; }); await Promise.resolve(); expect(reads).toBe(1);
  held.resolve(1); expect(await fresh).toBe(3); expect(reads).toBe(2); one.dispose(); two.dispose();
});
test('an aborted search ignores late column values and stops queued metadata reads', async () => {
  const controller = new AbortController(), held = deferred<DatabaseColumnInfo[]>(); let reads = 0;
  const a = adapter({ schemas: async () => ['public'], tables: async () => Array.from({ length: 10 }, (_, index) => relation('public', `items_${index}`)), columns: async () => { reads++; if (reads === 3) controller.abort(new DOMException('cancelled', 'AbortError')); return held.promise; } });
  const searching = searchNativeSchema(a, { query: 'email', kinds: ['column'] }, controller.signal);
  await expect(searching).rejects.toThrow('cancelled'); expect(reads).toBe(3); held.resolve([column('email')]);
});
