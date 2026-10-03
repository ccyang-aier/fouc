import { test, expect } from 'bun:test'
import { decodeSqlFile, sqlFileTitleFromPath } from './sql-files'

test('SQL files retain Unicode, quoted data and exact numeric source across BOM encodings', () => {
  const sql = "SELECT '中文😀' AS label, 9007199254740993 AS exact_value;\r\n"
  expect(decodeSqlFile(new TextEncoder().encode(sql))).toEqual({ sql, encoding: 'utf-8' })
  for (const little of [true, false]) {
    const bytes = new Uint8Array(2 + sql.length * 2), view = new DataView(bytes.buffer)
    view.setUint16(0, 0xfeff, little)
    for (let i = 0; i < sql.length; i++) view.setUint16(2 + i * 2, sql.charCodeAt(i), little)
    expect(decodeSqlFile(bytes)).toEqual({ sql, encoding: little ? 'utf-16le' : 'utf-16be' })
  }
  expect(sqlFileTitleFromPath('C:\\work\\脚本.sql')).toBe('脚本.sql')
})
test('invalid decoding or binary content is rejected rather than replacing source characters', () => {
  expect(() => decodeSqlFile(Uint8Array.of(0xff, 0xff))).toThrow()
  expect(() => decodeSqlFile(Uint8Array.of(0xff, 0xfe, 0x61))).toThrow()
  expect(() => decodeSqlFile(Uint8Array.of(0x53, 0))).toThrow()
  expect(decodeSqlFile(Uint8Array.of(0xd6, 0xd0, 0xce, 0xc4), 'gb18030').sql).toBe('中文')
})
