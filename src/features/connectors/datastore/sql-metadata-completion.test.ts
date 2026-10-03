import { expect, test } from 'bun:test'
import { EditorState } from '@codemirror/state'
import { CompletionContext } from '@codemirror/autocomplete'
import type { DatabaseColumnInfo, DatabaseObjectInfo } from '@fouc/shared'
import { sqlCompletionPosition } from './sql-completion-context'
import { tokenizeSqlSemantic } from '@fouc/shared'
import { quoteCompletionIdentifier, SqlMetadataCompletion, sqlKeywordCompletion } from './sql-metadata-completion'

function context(source: string) { const pos = source.indexOf('|'); return new CompletionContext(EditorState.create({ doc: source.replace('|', '') }), pos, true) }
function table(name: string): DatabaseObjectInfo { return { name, database: 'db', connectionId: 'session', schema: 'public', kind: 'table', comment: null } }
function column(name: string): DatabaseColumnInfo { return { name, dataType: 'text', isNullable: true, columnDefault: null, isPrimaryKey: name === 'id', isUnique: false, extra: null, comment: '原始字段说明', numericPrecision: null, numericScale: null, characterMaximumLength: null } }
const target = { schema: 'public', schemas: ['public', 'other'] }
function fixture() {
  const calls: string[] = []
  const model = new SqlMetadataCompletion('postgres', {
    tables: async (schema) => { calls.push('tables:' + schema); return [table('items'), table('other_items'), table('Mixed Case')] },
    columns: async (schema, name) => { calls.push('columns:' + schema + '.' + name); return [column('id'), column(name === 'items' ? 'name' : 'score'), column('field"quote')] },
  })
  return { model, calls }
}

test('native completion follows aliases, qualified schemas, quoted names and current statements', async () => {
  const { model, calls } = fixture()
  const result = await model.complete(context('SELECT F.na| FROM PUBLIC.items AS F;'), target)
  expect(result?.options.map((item) => item.label)).toContain('name')
  expect(result?.options.find((item) => item.label === 'field"quote')?.apply).toBe('"field""quote"')
  expect(calls).toEqual(['tables:public', 'columns:public.items'])
  await model.complete(context('SELECT f.id| FROM public.items f'), target)
  expect(calls).toHaveLength(2)
  const qualified = await model.complete(context('SELECT other.items.na|;'), target)
  expect(qualified?.options.map((item) => item.label)).toContain('name')
  expect(calls.slice(-2)).toEqual(['tables:other', 'columns:other.items'])
  const quoted = await model.complete(context('SELECT f."fi|eld" FROM items f'), target)
  expect(quoted?.from).toBe(9); expect(quoted?.to).toBe(16)
  expect(quoted?.options.find((item) => item.label === 'field"quote')?.apply).toBe('"field""quote"')
  const names = await model.complete(context('SELECT * FROM Mi|'), target)
  expect(names?.options.find((item) => item.label === 'Mixed Case')?.apply).toBe('"Mixed Case"')
  const second = sqlCompletionPosition('SELECT * FROM items a; SELECT b.na FROM other_items b;', 34, 'postgres')
  expect(second?.references.map((ref) => ref.table)).toEqual(['other_items'])
})
test('sibling subqueries and shadowed aliases cannot supply another scope’s fields', () => {
  const sql = 'SELECT (SELECT x.name FROM items x), (SELECT y.score FROM other_items y) FROM items a'
  const position = sqlCompletionPosition(sql, sql.indexOf('y.score') + 4, 'postgres')!
  expect(position.references.map((ref) => ref.alias)).toEqual(['y', 'a'])
  const shadow = 'SELECT (SELECT a.score FROM other_items a) FROM items a'
  expect(sqlCompletionPosition(shadow, shadow.indexOf('a.score') + 4, 'postgres')?.references.map((ref) => ref.table)).toEqual(['other_items'])
  const cte = 'WITH items AS (SELECT 1) SELECT i.name FROM items i'
  expect(sqlCompletionPosition(cte, cte.indexOf('i.name') + 4, 'postgres')?.references[0].virtual).toBe(true)
  const insensitive = 'SELECT (SELECT A.score FROM other_items A) FROM items a'
  expect(sqlCompletionPosition(insensitive, insensitive.indexOf('A.score') + 4, 'sqlite')?.references.map((ref) => ref.table)).toEqual(['other_items'])
})
test('ambiguous joined fields insert qualified references, and FROM commas only suggest objects', async () => {
  const { model } = fixture()
  const result = await model.complete(context('SELECT i| FROM items a JOIN other_items b ON a.id = b.id'), target)
  expect(result?.options.filter((item) => item.label === 'id').map((item) => item.apply)).toEqual(['a."id"', 'b."id"'])
  const from = await model.complete(context('SELECT * FROM items a, oth|'), target)
  expect(from?.options.some((item) => item.type === 'property')).toBe(false)
  expect(from?.options.some((item) => item.label === 'other_items')).toBe(true)
  const schemas = await model.complete(context('SELECT i| FROM public.items JOIN other.items ON true'), target)
  expect(schemas?.options.filter((item) => item.label === 'id').map((item) => item.apply)).toEqual(['"public".items."id"', 'other.items."id"'])
  const cte = await model.complete(context('WITH items AS (SELECT 1) SELECT * FROM it|'), target)
  expect(cte?.options.filter((item) => item.label === 'items').map((item) => item.detail)).toEqual(['CTE · 当前语句'])
  const before = fixture()
  expect(await before.model.complete(context('WITH items AS (SELECT 1) SELECT items.i| FROM items'), target)).toBeNull()
  expect(before.calls).toHaveLength(0)
})
test('strings/comments are suppressed with dialect-specific escapes and Unicode positions', async () => {
  const { model, calls } = fixture()
  for (const source of ["SELECT 'na|me' FROM items", 'SELECT $tag$ na|me $tag$', 'SELECT 1 /* nested /* na|me */ comment */', 'SELECT 1 -- na|me']) expect(await model.complete(context(source), target)).toBeNull()
  expect(calls).toHaveLength(0)
  expect(tokenizeSqlSemantic("SELECT 'C:\\' AS name FROM items", 'postgres').filter((token) => token.kind === 'string')).toHaveLength(1)
  expect(tokenizeSqlSemantic("SELECT 'a\\'b' FROM items", 'mysql').find((token) => token.kind === 'string')?.text).toBe("'a\\'b'")
  const unicode = 'SELECT 科研数据.字段 FROM 科研数据'
  const parsed = sqlCompletionPosition(unicode, unicode.indexOf('字段') + 1, 'sqlite')!
  expect(parsed.qualifier).toEqual(['科研数据']); expect(parsed.prefix).toBe('字')
  expect(quoteCompletionIdentifier('a`b', 'mysql')).toBe('`a``b`')
  expect(quoteCompletionIdentifier('select', 'postgres')).toBe('"select"')
  expect(quoteCompletionIdentifier('MixedCase', 'postgres')).toBe('"MixedCase"')
  expect(await sqlKeywordCompletion('postgres')(context('SELECT f.na| FROM items f'))).toBeNull()
})
test('failed metadata can retry; refresh aborts pending reads and rejects old responses', async () => {
  let fail = true
  const model = new SqlMetadataCompletion('postgres', { tables: async () => { if (fail) throw new Error('permission denied'); return [table('items')] }, columns: async () => [] })
  expect(await model.complete(context('SELECT * FROM it|'), target)).toBeNull()
  expect(model.getSnapshot()).toEqual({ pending: 0, error: 'permission denied' })
  fail = false; expect((await model.complete(context('SELECT * FROM it|'), target))?.options.some((item) => item.label === 'items')).toBe(true)
  expect(model.getSnapshot()).toEqual({ pending: 0, error: '' })
  let resolve!: (value: DatabaseObjectInfo[]) => void, signal!: AbortSignal
  const pending = new SqlMetadataCompletion('sqlite', { tables: (_, observed) => { signal = observed; return new Promise((done) => { resolve = done }) }, columns: async () => [] })
  const promise = pending.complete(context('SELECT * FROM it|'), target); await Promise.resolve()
  expect(pending.getSnapshot().pending).toBe(1); pending.clear(); expect(signal.aborted).toBe(true)
  resolve([table('obsolete')]); expect(await promise).toBeNull(); expect(pending.getSnapshot()).toEqual({ pending: 0, error: '' })
})
