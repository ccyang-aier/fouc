import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared'
import { exportQueryResult, exportSqlLiteral, previewQueryResult } from './export'
import { resultExportFilename } from './model'
import { numericExportType } from './values'

function result(columns: string[], rows: DatabaseCell[][], columnTypes: string[] = []): DatabaseQueryResult {
  return { columns, rows, columnTypes, columnSortables: columns.map(() => true), affectedRows: rows.length,
    executionTimeMs: 1, sessionId: null, truncated: false, hasMore: false, messages: [] }
}
const sql = (value: DatabaseCell, provider: 'mysql' | 'postgres' | 'sqlite', type?: string) => [...exportSqlLiteral(value, provider, type)].join('')

test('CSV and TSV escape delimiters, quotes and multiline content with distinct NULL/empty markers', async () => {
  const source = result(['name', 'empty', 'null'], [['A,"B"\r\n汉字', '', null], ['NULL', '\tTabbed', false]])
  const csv = await exportQueryResult(source, 'mysql', { format: 'csv', quoteMode: 'necessary', nullMode: 'literal', newline: 'crlf' })
  expect(csv.chunks.join('')).toBe('name,empty,null\r\n"A,""B""\r\n汉字","",NULL\r\n"NULL",\tTabbed,false\r\n')
  const tsv = await exportQueryResult(source, 'mysql', { format: 'tsv', includeHeader: false, quoteMode: 'necessary', nullMode: 'custom', nullText: '\\N' })
  expect(tsv.chunks.join('')).toBe('"A,""B""\r\n汉字"\t""\t\\N\nNULL\t"\tTabbed"\tfalse\n')
})

test('selected row/column order is preserved, repeated indices are deduplicated, bounds are checked', async () => {
  const source = result(['a', 'b'], [['r0a', 'r0b'], ['r1a', 'r1b'], ['r2a', 'r2b']])
  const output = await exportQueryResult(source, 'sqlite', { format: 'csv', quoteMode: 'necessary' }, { selectedRows: [2, 0, 2], selectedColumns: [1, 0, 1] })
  expect(output.chunks.join('')).toBe('b,a\nr2b,r2a\nr0b,r0a\n')
  expect(output.rowCount).toBe(2)
  expect(output.columnCount).toBe(2)
  await expect(exportQueryResult(source, 'sqlite', { format: 'csv' }, { selectedRows: [3] })).rejects.toThrow('范围已变化')
  await expect(exportQueryResult(source, 'sqlite', { format: 'csv' }, { selectedColumns: [] })).rejects.toThrow('至少选择一列')
})

test('native OID/type-code numeric text exports without JS coercion, text columns stay strings', async () => {
  const large = '9223372036854775807', decimal = '12345678901234567890.12345678901234567890'
  const source = result(['int', 'decimal', 'label'], [[large, decimal, large]], ['oid:20', 'oid:1700', 'oid:25'])
  const output = await exportQueryResult(source, 'postgres', { format: 'json', jsonShape: 'records' })
  expect(output.chunks.join('')).toContain(`"int": ${large}, "decimal": ${decimal}, "label": "${large}"`)
  expect(numericExportType('mysql', '246')).toBe(true)
  expect(numericExportType('mysql', 'NEWDECIMAL')).toBe(true)
  expect(numericExportType('postgres', 'oid:25')).toBe(false)
  expect(numericExportType('sqlite', 'varchar(100)')).toBe(false)
  expect(sql(decimal, 'mysql', '246')).toBe(decimal)
  expect(sql(large, 'postgres', 'oid:20')).toBe(large)
  expect(sql('0); DROP TABLE t; --', 'mysql', 'BIGINT')).toBe("'0); DROP TABLE t; --'")
})

test('matrix JSON retains duplicate column names; records and INSERT reject collisions', async () => {
  const source = result(['id', 'id'], [[1, 2]])
  const output = await exportQueryResult(source, 'sqlite', { format: 'json' })
  expect(JSON.parse(output.chunks.join(''))).toEqual({ columns: ['id', 'id'], rows: [[1, 2]] })
  await expect(exportQueryResult(source, 'sqlite', { format: 'json', jsonShape: 'records' })).rejects.toThrow('重复列名')
  await expect(exportQueryResult(source, 'sqlite', { format: 'sql', target: { table: 'target' } })).rejects.toThrow('重复列名')
})

test('binary cells export actual bytes, including empty and invalid data', async () => {
  const binary = { type: 'binary', base64: 'AP9cJw==' }
  expect(sql(binary, 'mysql')).toBe("X'00ff5c27'")
  expect(sql(binary, 'sqlite')).toBe("X'00ff5c27'")
  expect(sql(binary, 'postgres')).toBe("pg_catalog.decode('00ff5c27', 'hex')")
  expect(sql({ type: 'binary', base64: '' }, 'sqlite')).toBe("X''")
  expect(() => sql({ type: 'binary', base64: 'bad?' }, 'sqlite')).toThrow('Base64')
  const source = result(['payload'], [[binary]])
  expect((await exportQueryResult(source, 'sqlite', { format: 'csv', includeHeader: false })).chunks.join('')).toBe('"0x00ff5c27"\n')
  const json = await exportQueryResult(source, 'sqlite', { format: 'json', jsonShape: 'records' })
  expect(JSON.parse(json.chunks.join(''))).toEqual([{ payload: binary }])
})

test('native INSERT quoting, batch sizes, NULL, boolean and binary have no unsupported-driver syntax', async () => {
  const source = result(['i`d', 'say"'], [[1, "O'Reilly\\path"], [null, true], [2, 'third']])
  const mysql = (await exportQueryResult(source, 'mysql', { format: 'sql', target: { schema: 'd`b', table: 't`est' }, sqlBatchSize: 2 })).chunks.join('')
  expect(mysql).toContain('INSERT INTO `d``b`.`t``est` (`i``d`, `say"`) VALUES')
  expect(mysql).toContain("CONVERT(X'4f275265696c6c795c70617468' USING utf8mb4)")
  expect(mysql.match(/INSERT INTO/g)).toHaveLength(2)
  expect(mysql).toContain('(NULL, TRUE)')
  const pg = (await exportQueryResult(source, 'postgres', { format: 'sql', target: { schema: 'pub"lic', table: 't' }, sqlInsertMode: 'single' })).chunks.join('')
  expect(pg).toContain('INSERT INTO "pub""lic"."t" ("i`d", "say""") VALUES')
  expect(pg).toContain("E'O''Reilly\\\\path'")
  expect(pg.match(/INSERT INTO/g)).toHaveLength(3)
  const sqlite = (await exportQueryResult(source, 'sqlite', { format: 'sql', target: { table: 't' } })).chunks.join('')
  expect(sqlite).toContain("'O''Reilly\\path'")
  expect(sqlite).not.toContain("E'")
})

test('SQLite exported INSERT executes and roundtrips NUL, quotes, backslashes, native int64 and binary', async () => {
  const source = result(['id', 'text', 'binary'], [['9223372036854775807', "a\0b'\\c😀", { type: 'binary', base64: 'AP8=' }]], ['INTEGER', 'TEXT', 'BLOB'])
  const output = (await exportQueryResult(source, 'sqlite', { format: 'sql', target: { table: 'roundtrip' } })).chunks.join('')
  const script = `import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE roundtrip(id INTEGER,text TEXT,binary BLOB);');db.exec(${JSON.stringify(output)});const s=db.prepare('SELECT id,text,hex(binary) as binary FROM roundtrip');s.setReadBigInts(true);const r=s.get();console.log(JSON.stringify({id:String(r.id),text:r.text,binary:r.binary}));db.close();`
  const returned = JSON.parse(execFileSync('node', ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', script], { encoding: 'utf8' }))
  expect(returned).toEqual({ id: '9223372036854775807', text: "a\0b'\\c😀", binary: '00FF' })
})

test('PostgreSQL arrays use native metadata types; NUL text is rejected', () => {
  expect(sql(['9223372036854775807', null], 'postgres', 'oid:1016')).toBe('ARRAY[9223372036854775807, NULL]::int8[]')
  expect(sql([], 'postgres', 'oid:1007')).toBe('ARRAY[]::int4[]')
  expect(sql([['a', 'b'], ['c', 'd']], 'postgres', 'oid:1009')).toBe("ARRAY[[E'a', E'b'], [E'c', E'd']]::text[]")
  expect(sql({ name: "a'b\\c" }, 'postgres', 'oid:3802')).toBe("E'{\"name\":\"a''b\\\\\\\\c\"}'::jsonb")
  expect(() => sql('null\0', 'postgres')).toThrow('text 不支持空字符')
})

test('Markdown preserves pipes, linebreaks and text without evaluating HTML', async () => {
  const output = await exportQueryResult(result(['text'], [['<script>|*bold*\r\nnext'], [null]]), 'sqlite', { format: 'markdown', nullMode: 'literal' })
  expect(output.chunks.join('')).toContain('&lt;script&gt;\\|\\*bold\\*<br>next')
  expect(output.chunks.join('')).toContain('| NULL |')
})

test('UTF-8 chunked Blob output preserves emoji pairs and BOM while preview is bounded', async () => {
  const text = 'a'.repeat(16383) + '😀' + '汉字'.repeat(40000)
  const source = result(['text'], [[text]])
  const output = await exportQueryResult(source, 'sqlite', { format: 'json', bom: true })
  expect(output.chunks.length).toBeGreaterThan(1)
  const decoded = await new Blob(output.chunks).text()
  expect(JSON.parse(decoded).rows[0][0]).toBe(text)
  expect(output.byteLength).toBe(new TextEncoder().encode(output.chunks.join('')).length)
  expect(output.chunks[0].startsWith('\ufeff')).toBe(true)
  const preview = await previewQueryResult(source, 'sqlite', { format: 'json' })
  expect(preview.truncated).toBe(true)
  expect(new TextEncoder().encode(preview.text).length).toBeLessThanOrEqual(65536)
  expect(preview.text).not.toContain('�')
})

test('cooperative generation yields for cancellation and preview does not become the full artifact', async () => {
  const source = result(['id'], Array.from({ length: 20000 }, (_, index) => [index]))
  const preview = await previewQueryResult(source, 'sqlite', { format: 'csv' })
  expect(preview.rowCount).toBe(25)
  expect(preview.totalRows).toBe(20000)
  expect(preview.truncated).toBe(true)
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 0)
  await expect(exportQueryResult(source, 'sqlite', { format: 'csv' }, { signal: controller.signal })).rejects.toThrow()
  expect(resultExportFilename('../a/b?.csv', 'json')).toBe('.._a_b_.json')
})
