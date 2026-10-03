import { describe, expect, test } from 'bun:test'
import type { DatabaseColumnInfo, DatabaseQueryResult, RelationalProvider } from '@fouc/shared'
import { compareDataResults } from './compare'
import { inferCompareKeys, inferCompareMappings, validateCompareConfiguration, type DataCompareColumnMapping } from './model'
import { buildDataCompareSqlPreview } from './sql-preview'
import { compareValueToken } from './values'

function result(rows: DatabaseQueryResult['rows'], columns = ['id', 'name', 'amount'], types = ['integer', 'text', 'numeric']): DatabaseQueryResult {
  return { columns, rows, columnTypes: types, columnSortables: columns.map(() => true), affectedRows: 0, executionTimeMs: 0, truncated: false, hasMore: false, sessionId: null, messages: [] }
}
const mapping: DataCompareColumnMapping[] = [{ id: 'key', left: 0, right: 0 }, { id: 'name', left: 1, right: 1 }, { id: 'amount', left: 2, right: 2 }]
const config = { mapping, keyColumns: ['key'], provider: 'postgres' as const }
const instant = { yieldControl: () => Promise.resolve() }
function column(name: string, extra: string | null): DatabaseColumnInfo { return { name, dataType: 'text', isNullable: true, columnDefault: null, isPrimaryKey: false, isUnique: false, extra, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null } }

describe('DBX data comparison adapted to loaded results', () => {
  test('infers unambiguous name/case intersections, never guesses a result key', () => {
    expect(inferCompareMappings(['id', 'Name', 'amount'], ['AMOUNT', 'NAME', 'ID'])).toEqual([{ id: 'column-0', left: 0, right: 2 }, { id: 'column-1', left: 1, right: 1 }, { id: 'column-2', left: 2, right: 0 }])
    expect(inferCompareMappings(['name', 'name'], ['name'])).toEqual([])
    expect(inferCompareMappings(['Name', 'name'], ['Name', 'name'])).toHaveLength(2)
    expect(inferCompareKeys(result([]), mapping)).toEqual([])
    expect(inferCompareKeys(result([]), mapping, ['id', 'name'])).toEqual(['key', 'name'])
    expect(inferCompareKeys(result([]), mapping, ['missing'])).toEqual([])
  })
  test('reports source-ordered added, removed, modified and unchanged real rows', async () => {
    const diff = await compareDataResults(result([[3, 'New', '0.1'], [1, 'Changed', '1.00'], [4, 'Same', '2.0']]), result([[1, 'Old', '1.0'], [2, 'Removed', '1'], [4, 'Same', '2.00']]), config, instant)
    expect(diff.counts).toEqual({ added: 1, removed: 1, modified: 1, unchanged: 1, conflict: 0 })
    expect(diff.entries.map((entry) => entry.kind)).toEqual(['added', 'modified', 'unchanged', 'removed'])
    expect(diff.entries[1].changes).toEqual([{ mappingId: 'name', left: 'Changed', right: 'Old' }])
  })
  test('maps different table/query columns positionally and compares composite keys without separators colliding', async () => {
    const left = result([['a\u001fb', 'c', 'first'], ['a', 'b\u001fc', 'second']], ['tenant', 'id', 'name'], ['text', 'text', 'text']), right = result([['first', 'c', 'a\u001fb'], ['old', 'b\u001fc', 'a']], ['LABEL', 'CODE', 'TENANT'], ['text', 'text', 'text'])
    const diff = await compareDataResults(left, right, { mapping: [{ id: 'tenant', left: 0, right: 2 }, { id: 'id', left: 1, right: 1 }, { id: 'name', left: 2, right: 0 }], keyColumns: ['tenant', 'id'] }, instant)
    expect(diff.counts).toMatchObject({ unchanged: 1, modified: 1, conflict: 0 }); expect(diff.entries[1].changes[0].left).toBe('second')
  })
  test('duplicate keys on either side are explicit conflicts, including identical duplicates', async () => {
    const diff = await compareDataResults(result([[1, 'A', '1'], [1, 'A', '1'], [2, 'B', '2']]), result([[1, 'A', '1'], [2, 'B', '2'], [2, 'B', '2']]), config, instant)
    expect(diff.counts.conflict).toBe(2); expect(diff.counts.unchanged).toBe(0)
    expect(diff.entries[0].leftRows).toEqual([0, 1]); expect(diff.entries[1].rightRows).toEqual([1, 2])
    expect(diff.entries[0].reasons[0]).toContain('左侧匹配键重复')
  })
  test('missing and NULL are distinct; a missing key is a conflict rather than an arbitrary match', async () => {
    const diff = await compareDataResults(result([[1, 'A'], []]), result([[1, 'A', null], [null, 'X', null]]), config, instant)
    expect(diff.entries[0].changes).toEqual([{ mappingId: 'amount', left: undefined, right: null }])
    expect(diff.counts).toMatchObject({ modified: 1, conflict: 1, removed: 1 })
    expect(compareValueToken(undefined)).not.toBe(compareValueToken(null))
  })
  test('exact bigint/decimal strings stay precise and distinct from ordinary text and JS numbers', async () => {
    expect(compareValueToken('9007199254740993', 'bigint')).not.toBe(compareValueToken('9007199254740992', 'bigint'))
    expect(compareValueToken('1.000', 'numeric')).toBe(compareValueToken('1e0', 'numeric'))
    expect(compareValueToken('1.0', 'text')).not.toBe(compareValueToken('1.00', 'text'))
    expect(compareValueToken('1', 'numeric')).not.toBe(compareValueToken(1, 'numeric'))
    const diff = await compareDataResults(result([[1, 'A', '9007199254740993']]), result([[1, 'A', '9007199254740992']]), config, instant)
    expect(diff.entries[0].changes[0].left).toBe('9007199254740993')
    const unsafe = await compareDataResults(result([[1, 'A', Number.MAX_SAFE_INTEGER + 1]]), result([[1, 'A', '9007199254740992']]), config, instant)
    expect(unsafe.counts.conflict).toBe(1); expect(unsafe.entries[0].reasons[0]).toContain('不安全整数')
  })
  test('JSON object key order is structural, array order and binary payloads remain strict', () => {
    expect(compareValueToken({ a: 1, b: [true, null] })).toBe(compareValueToken({ b: [true, null], a: 1 }))
    expect(compareValueToken([1, 2])).not.toBe(compareValueToken([2, 1]))
    expect(compareValueToken({ type: 'binary', base64: 'AAEC' })).not.toBe(compareValueToken({ type: 'binary', base64: 'AAED' }))
    expect(compareValueToken({ type: 'binary', base64: 'AAEC' })).not.toBe(compareValueToken('AAEC'))
    expect(compareValueToken({ type: 'binary', base64: 'AAEC' }, 'jsonb')).not.toBe(compareValueToken({ type: 'binary', base64: 'AAEC' }, 'bytea'))
    expect(compareValueToken({ type: 'binary', base64: 'AAEC', extra: 1 }, 'jsonb')).not.toBe(compareValueToken({ type: 'binary', base64: 'AAEC', extra: 2 }, 'jsonb'))
    expect(() => compareValueToken({ type: 'binary', base64: '**invalid**' })).toThrow('Base64')
  })
  test('rejects invalid mappings, absent keys and bounded result limits', () => {
    expect(() => validateCompareConfiguration(result([]), result([]), { mapping, keyColumns: [] })).toThrow('匹配键')
    expect(() => validateCompareConfiguration(result([]), result([]), { mapping: [...mapping, { id: 'duplicate', left: 0, right: 0 }], keyColumns: ['key'] })).toThrow('一对一')
    expect(() => validateCompareConfiguration(result(Array.from({ length: 10_001 }, () => [1])), result([]), config)).toThrow('10,000')
    const wide = result(Array.from({ length: 2 }, () => [1]), Array.from({ length: 500_001 }, (_, index) => `c${index}`))
    expect(() => validateCompareConfiguration(wide, result([]), config)).toThrow('1,000,000')
  })
  test('emits truthful bounded progress and cancels cooperatively before completing', async () => {
    const controller = new AbortController(), steps: number[] = []
    await expect(compareDataResults(result(Array.from({ length: 3000 }, (_, index) => [index, 'A', '1'])), result([]), config, { signal: controller.signal, onProgress: (value) => steps.push(value.completed), yieldControl: async () => { controller.abort() } })).rejects.toMatchObject({ name: 'AbortError' })
    expect(steps.length).toBe(1); expect(steps[0]).toBeLessThan(6000)
    const progress: number[] = []
    const complete = await compareDataResults({ ...result([[1, 'A', '1']]), hasMore: true }, result([]), config, { ...instant, onProgress: (value) => progress.push(value.completed) })
    expect(complete.partial).toBe(true); expect(progress.at(-1)).toBe(2)
  })
})

describe('selective SQL candidates never execute', () => {
  test('only explicitly selected diffs generate correct native quoted SQL and old-value predicates', async () => {
    const diff = await compareDataResults(result([[1, "O'Reilly", '9007199254740993'], [3, 'New', '1']]), result([[1, 'Old', '9007199254740992'], [2, 'Delete', null]]), config, instant)
    expect(buildDataCompareSqlPreview(diff, new Set(), 'postgres', { table: 't' }).statements).toBe(0)
    const selection = new Set(diff.entries.map((entry) => entry.id))
    for (const provider of ['postgres', 'mysql', 'sqlite'] as RelationalProvider[]) {
      const preview = buildDataCompareSqlPreview(diff, selection, provider, { table: 'a"`b', schema: 's' })
      expect(preview.statements).toBe(3); expect(preview.sql).toContain('INSERT INTO'); expect(preview.sql).toContain('UPDATE'); expect(preview.sql).toContain('DELETE FROM')
      expect(preview.sql).toContain('9007199254740993'); expect(preview.sql).toContain('9007199254740992'); expect(preview.sql).toContain("O''Reilly"); expect(preview.sql).toContain('IS NULL')
      expect(preview.sql).toContain(provider === 'mysql' ? '`a"``b`' : '"a""`b"')
    }
  })
  test('conflicts, missing source cells and unchanged rows never invent write candidates', async () => {
    const diff = await compareDataResults(result([[1, 'A'], [2, 'B', '1'], [2, 'B', '1'], [3, 'C', '1']]), result([[1, 'A', null], [2, 'B', '1'], [3, 'C', '1']]), config, instant)
    const preview = buildDataCompareSqlPreview(diff, new Set(diff.entries.map((entry) => entry.id)), 'postgres', { table: 't' })
    expect(preview.statements).toBe(0); expect(preview.skipped).toHaveLength(3); expect(preview.skipped.some((item) => item.reason.includes('源值缺失'))).toBe(true)
  })
  test('binary/JSON literals use shared native codecs and duplicate target aliases are rejected', async () => {
    const left = result([[1, { type: 'binary', base64: 'AAEC' }, { json: 'a"b' }]]), right = result([[1, { type: 'binary', base64: 'AAED' }, { json: 'old' }]])
    const diff = await compareDataResults(left, right, config, instant)
    const preview = buildDataCompareSqlPreview(diff, new Set(diff.entries.map((entry) => entry.id)), 'postgres', { table: 't' })
    expect(preview.sql).toContain("pg_catalog.decode('000102', 'hex')"); expect(preview.sql).toContain('to_jsonb("amount")')
    const duplicate = { ...diff, right: { ...right, columns: ['id', 'duplicate', 'duplicate'] } }
    expect(() => buildDataCompareSqlPreview(duplicate, new Set(), 'postgres', { table: 't' })).toThrow('重复列名')
  })
  test('known generated columns are omitted while ordinary defaults remain writable', async () => {
    const diff = await compareDataResults(result([[1, 'A', '2']]), result([]), config, instant)
    const preview = buildDataCompareSqlPreview(diff, new Set(diff.entries.map((entry) => entry.id)), 'mysql', { table: 't', columns: [column('id', null), column('name', 'DEFAULT_GENERATED'), column('amount', 'STORED GENERATED')] })
    expect(preview.sql).toContain('`name`'); expect(preview.sql).not.toContain('`amount`')
  })
  test('PostgreSQL native arrays retain typed predicates and known identity values use explicit override', async () => {
    const diff = await compareDataResults(result([[1, [1, 2], '1']], undefined, ['integer', 'oid:1007', 'numeric']), result([[1, [2, 3], '1']], undefined, ['integer', 'oid:1007', 'numeric']), config, instant)
    const preview = buildDataCompareSqlPreview(diff, new Set(diff.entries.map((entry) => entry.id)), 'postgres', { table: 't' })
    expect(preview.sql).toContain('"name" IS NOT DISTINCT FROM ARRAY[2, 3]::int4[]'); expect(preview.sql).not.toContain('to_jsonb("name")')
    const insert = await compareDataResults(result([[1, 'A', '1']]), result([]), config, instant)
    expect(buildDataCompareSqlPreview(insert, new Set(insert.entries.map((entry) => entry.id)), 'postgres', { table: 't', columns: [column('id', 'identity'), column('name', null), column('amount', null)] }).sql).toContain('OVERRIDING SYSTEM VALUE')
  })
})
