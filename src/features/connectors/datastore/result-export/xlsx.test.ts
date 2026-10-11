import { expect, test } from 'bun:test'
import ExcelJS from 'exceljs'
import type { DatabaseQueryResult } from '@fouc/shared'
import { buildResultXlsx } from './xlsx'

const result: DatabaseQueryResult = { columns: ['id', 'amount', 'label', 'flag'], columnTypes: ['int', 'numeric', 'text', 'boolean'], columnSortables: [true, true, true, true], rows: [[1, '9007199254740993', '=HYPERLINK("file")', true], [2, '0.100000000000000001', null, false]], affectedRows: 0, executionTimeMs: 0, hasMore: false, truncated: false, sessionId: null, messages: [] }
test('XLSX keeps exact numeric text and formula-like strings, and exports selected source columns in their display order', async () => {
  const bytes = await buildResultXlsx(result, "'sales/main'", [1, 0], [2, 1, 3])
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer)
  const sheet = workbook.worksheets[0]
  expect(sheet.name).toBe('sales_main')
  expect(sheet.getRow(1).values).toEqual([undefined, 'label', 'amount', 'flag'])
  expect(sheet.getCell('A2').value).toBeNull()
  expect(sheet.getCell('B2').value).toBe('0.100000000000000001')
  expect(sheet.getCell('B3').value).toBe('9007199254740993')
  expect(sheet.getCell('A3').value).toBe('=HYPERLINK("file")')
  expect(sheet.getCell('A3').formula).toBeUndefined()
  expect(sheet.getCell('C2').value).toBe(false)
  expect(sheet.getCell('C3').value).toBe(true)
  expect(result.rows[0][1]).toBe('9007199254740993')
})
test('XLSX rejects foreign selections and oversized cells rather than silently truncating', async () => {
  await expect(buildResultXlsx(result, 'data', [10], [0])).rejects.toThrow('不属于当前数据结果')
  await expect(buildResultXlsx(result, 'data', [0], [10])).rejects.toThrow('不属于当前数据结果')
  await expect(buildResultXlsx({ ...result, rows: [[0, '', 'x'.repeat(32768), true]] }, 'data', [0], [2])).rejects.toThrow('32767')
  await expect(buildResultXlsx({ ...result, rows: [[0, '', 'x\u0000y', true]] }, 'data', [0], [2])).rejects.toThrow('控制字符')
  const bytes = await buildResultXlsx(result, 'data', [0], [0], false), workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer)
  expect(workbook.worksheets[0].getCell('A1').value).toBe(1)
})
