import { describe, expect, test } from 'bun:test'
import type { DatabaseCell, DatabaseColumnInfo, DatabaseTablePage } from '@fouc/shared'
import { formatGridEditClipboard, parseGridEditClipboard } from './clipboard'
import { initialGridDraftHistory, reduceGridDraftHistory } from './history'
import { gridEditScopeSignature, gridEditSourceCurrent, type GridEditDraft } from './model'
import { fillGridSelection, gridRowsWithDrafts, pasteGridSelection, stageGridCellEdits, validateGridEditScope } from './operations'
import { coerceGridEditValue, gridGeneratedColumn } from './values'
import { gridEditShortcut } from './shortcuts'

const column = (name: string, dataType = 'TEXT', extra: Partial<DatabaseColumnInfo> = {}): DatabaseColumnInfo => ({ name, dataType, isNullable: true, isPrimaryKey: false, isUnique: false, columnDefault: null, extra: null, comment: null, numericPrecision: null, numericScale: null, characterMaximumLength: null, ...extra })
function page(rows: DatabaseCell[][] = [[1, 'A', '0.1'], [2, 'B', '9007199254740993']]): DatabaseTablePage { return { connectionId: 'c', database: 'd', table: 'items', columns: [column('id', 'INTEGER', { isPrimaryKey: true, isNullable: false }), column('name'), column('amount', 'DECIMAL')], rows, offset: 50, limit: 100, hasMore: true } }
const scope = { rows: [0, 1], columns: [2, 1], rectangular: true }
describe('grid paste matrix and raw values', () => {
  test('quoted tabs/newlines, empty rows and literal NULL remain distinct', () => {
    expect(parseGridEditClipboard('"a\tb"\tNULL\r\n"line 1\nline 2"\t"NULL"', { separator: '\t' })).toEqual([[{ mode: 'value', text: 'a\tb' }, { mode: 'value', text: 'NULL' }], [{ mode: 'value', text: 'line 1\nline 2' }, { mode: 'value', text: 'NULL' }]])
    expect(parseGridEditClipboard('NULL\t"NULL"\t""', { separator: '\t', nullToken: 'NULL' })).toEqual([[{ mode: 'null' }, { mode: 'value', text: 'NULL' }, { mode: 'value', text: '' }]])
    expect(parseGridEditClipboard('\n\n', { separator: '\t' })).toEqual([[{ mode: 'value', text: '' }], [{ mode: 'value', text: '' }]])
    expect(parseGridEditClipboard('', { separator: '\t' })).toEqual([[{ mode: 'value', text: '' }]])
    expect(() => parseGridEditClipboard('a\tb\nc', { separator: '\t' })).toThrow('每行列数')
    expect(() => parseGridEditClipboard('"a', { separator: ',' })).toThrow('未闭合')
    expect(formatGridEditClipboard([[null, 'NULL', '', { x: 1 }]], '\t')).toBe('NULL\t"NULL"\t""\t"{""x"":1}"')
  })
  test('single value fills, matrices use original reordered columns, mismatches never truncate', () => {
    expect(pasteGridSelection(scope, [[{ mode: 'value', text: 'x' }]])).toHaveLength(4)
    const edits = pasteGridSelection(scope, [[{ mode: 'value', text: '0.2' }, { mode: 'value', text: 'C' }], [{ mode: 'value', text: '9007199254740995' }, { mode: 'value', text: 'D' }]])
    expect(edits[0]).toEqual({ rowIndex: 0, columnIndex: 2, input: { mode: 'value', text: '0.2' } })
    expect(edits[1].columnIndex).toBe(1)
    expect(() => pasteGridSelection(scope, [[{ mode: 'null' }, { mode: 'null' }]])).toThrow('须与选区')
    expect(() => pasteGridSelection({ ...scope, rectangular: false }, [[{ mode: 'null' }]])).toThrow('矩形')
  })
})
describe('grid edits stage atomically with source snapshots', () => {
  test('multiple edits merge with existing row values and preserve original/raw projection indexes', () => {
    const source = page(), prior: GridEditDraft[] = [{ id: 'existing', row: 0, change: { kind: 'update', original: [...source.rows[0]], values: { name: 'prior' } } }]
    const edits = pasteGridSelection(scope, [[{ mode: 'value', text: '0.2' }, { mode: 'value', text: 'C' }], [{ mode: 'value', text: '9007199254740995' }, { mode: 'value', text: 'D' }]])
    const staged = stageGridCellEdits(source, prior, edits, 'postgres', () => 'next')
    expect(staged).toHaveLength(2); expect(staged[0].id).toBe('existing')
    expect(staged[0].change).toEqual({ kind: 'update', original: [1, 'A', '0.1'], values: { name: 'C', amount: '0.2' } })
    expect(staged[1].change.kind === 'update' && staged[1].change.values.amount).toBe('9007199254740995')
    expect(prior[0].change.kind === 'update' && prior[0].change.values).toEqual({ name: 'prior' })
    expect(source.rows[0]).toEqual([1, 'A', '0.1'])
    expect(gridRowsWithDrafts(source, staged)).toEqual([[1, 'C', '0.2'], [2, 'D', '9007199254740995']])
    source.rows[1][1] = 'new fetched'; expect(staged[1].change.kind === 'update' && staged[1].change.original[1]).toBe('B')
  })
  test('NULL, empty string and restoring one field are explicit and do not replace other row changes', () => {
    const source = page(), staged = stageGridCellEdits(source, [], fillGridSelection({ rows: [0], columns: [1], rectangular: true }, { mode: 'value', text: '' }), 'sqlite', () => 'id')
    expect(staged[0].change.kind === 'update' && staged[0].change.values.name).toBe('')
    const added = stageGridCellEdits(source, staged, [{ rowIndex: 0, columnIndex: 2, input: { mode: 'null' } }], 'sqlite')
    expect(added[0].change.kind === 'update' && added[0].change.values).toEqual({ name: '', amount: null })
    const restored = stageGridCellEdits(source, added, [{ rowIndex: 0, columnIndex: 1, input: { mode: 'restore' } }], 'sqlite')
    expect(restored[0].change.kind === 'update' && restored[0].change.values).toEqual({ amount: null })
    expect(stageGridCellEdits(source, restored, [{ rowIndex: 0, columnIndex: 2, input: { mode: 'restore' } }], 'sqlite')).toEqual([])
    expect(() => stageGridCellEdits(source, [], [{ rowIndex: 0, columnIndex: 0, input: { mode: 'null' } }], 'sqlite')).toThrow('不允许 NULL')
  })
  test('invalid cells, deleted rows, generated columns, nullable unique keys and stale originals block whole batches', () => {
    const source = page(), staged: GridEditDraft[] = [{ id: 'id', row: 0, change: { kind: 'update', original: [...source.rows[0]], values: { name: 'prior' } } }]
    expect(() => stageGridCellEdits(source, staged, [{ rowIndex: 0, columnIndex: 1, input: { mode: 'value', text: 'good' } }, { rowIndex: 1, columnIndex: 2, input: { mode: 'value', text: 'not numeric' } }], 'postgres')).toThrow('十进制')
    expect(staged[0].change.kind === 'update' && staged[0].change.values.name).toBe('prior')
    expect(() => stageGridCellEdits(source, [{ id: 'deleted', row: 0, change: { kind: 'delete', original: source.rows[0] } }], [{ rowIndex: 0, columnIndex: 1, input: { mode: 'null' } }], 'postgres')).toThrow('暂存删除')
    source.columns[1].extra = 'STORED GENERATED'; expect(validateGridEditScope(source, { rows: [0], columns: [1], rectangular: true })).toContain('生成')
    expect(gridGeneratedColumn(column('auto', 'TIMESTAMP', { extra: 'DEFAULT_GENERATED' }))).toBe(false)
    source.columns[0].isPrimaryKey = false; source.columns[1].extra = null; source.columns[1].isUnique = true; source.rows[1][1] = null
    expect(validateGridEditScope(source, { rows: [1], columns: [2], rectangular: true })).toContain('不可定位')
    source.rows[0][1] = 'changed'
    expect(() => stageGridCellEdits(source, staged, [{ rowIndex: 0, columnIndex: 2, input: { mode: 'null' } }], 'postgres')).toThrow('原始行')
  })
  test('bounds/limits are visible and unsafe original numeric values cannot generate a save plan', () => {
    expect(validateGridEditScope(page(), { rows: [100], columns: [1], rectangular: true })).toContain('超出')
    expect(validateGridEditScope(page(), { rows: Array.from({ length: 51 }, (_, index) => index), columns: [1], rectangular: true })).toContain('50 行')
    expect(() => parseGridEditClipboard(Array.from({ length: 101 }, () => 'a').join('\t'), { separator: '\t' })).toThrow('100 个')
    expect(() => stageGridCellEdits(page([[9007199254740992, 'A', '0.1']]), [], [{ rowIndex: 0, columnIndex: 1, input: { mode: 'null' } }], 'postgres')).toThrow('不安全数字')
  })
  test('JSON/decimal/binary/boolean coercion preserves valid values and rejects unsupported precision/arrays', () => {
    expect(coerceGridEditValue('9007199254740993', column('n', 'BIGINT'), 1, 'postgres')).toBe('9007199254740993')
    expect(coerceGridEditValue('0.100000000000000005', column('n', 'DECIMAL'), '0.1', 'postgres')).toBe('0.100000000000000005')
    expect(coerceGridEditValue('false', column('flag', 'BOOLEAN'), true, 'postgres')).toBe(false)
    expect(coerceGridEditValue('true', column('flag', 'tinyint(1)'), 0, 'mysql')).toBe(1)
    expect(coerceGridEditValue('AAE=', column('bytes', 'bytea'), { type: 'binary', base64: '' }, 'postgres')).toEqual({ type: 'binary', base64: 'AAE=' })
    expect(() => coerceGridEditValue('not-base64', column('bytes', 'BLOB'), null, 'sqlite')).toThrow('Base64')
    expect(coerceGridEditValue('{"n":9007199254740991,"v":1.0000000000000000}', column('json', 'JSONB'), {}, 'postgres')).toEqual({ n: 9007199254740991, v: 1 })
    expect(() => coerceGridEditValue('{"n":9007199254740993}', column('json', 'JSONB'), {}, 'postgres')).toThrow('精度')
    expect(() => coerceGridEditValue('{"n":0.100000000000000005}', column('json', 'JSONB'), {}, 'postgres')).toThrow('精度')
    expect(() => coerceGridEditValue('null', column('json', 'JSONB'), {}, 'postgres')).toThrow('区分 JSON null')
    expect(() => coerceGridEditValue('[2]', column('list', 'integer[]'), [1], 'postgres')).toThrow('数组')
    expect(() => coerceGridEditValue('1.1', column('n', 'INTEGER'), 1, 'sqlite')).toThrow('整数')
  })
})
describe('pending history and asynchronous source guards', () => {
  test('batch is one undo frame, redo restores exact snapshot, new edits clear redo and successful reset cannot resurrect commits', () => {
    const source = page(), changes = stageGridCellEdits(source, [], fillGridSelection({ rows: [0, 1], columns: [1], rectangular: true }, { mode: 'value', text: 'C' }), 'postgres', () => 'id')
    let history = reduceGridDraftHistory(initialGridDraftHistory(), { type: 'apply', drafts: changes, label: '填充选区' })
    expect(history.past).toHaveLength(1); expect(history.drafts).toHaveLength(2)
    if (changes[0].change.kind === 'update') changes[0].change.values.name = 'caller mutation'
    expect(history.drafts[0].change.kind === 'update' && history.drafts[0].change.values.name).toBe('C')
    const applied = history.drafts; history = reduceGridDraftHistory(history, { type: 'undo' }); expect(history.drafts).toEqual([])
    history = reduceGridDraftHistory(history, { type: 'redo' }); expect(history.drafts).toEqual(applied)
    history = reduceGridDraftHistory(history, { type: 'undo' }); history = reduceGridDraftHistory(history, { type: 'apply', drafts: changes, label: '新编辑' }); expect(history.future).toEqual([])
    history = reduceGridDraftHistory(history, { type: 'reset' }); expect(history.past).toEqual([]); expect(history.future).toEqual([])
    expect(reduceGridDraftHistory(history, { type: 'undo' })).toBe(history)
  })
  test('no-op does not create history and asynchronous read rejects changed source/provider/selection/revision/lock', () => {
    const initial = initialGridDraftHistory(); expect(reduceGridDraftHistory(initial, { type: 'apply', drafts: [], label: 'noop' })).toBe(initial)
    const source = { page: page(), provider: 'postgres' as const, revision: 1, signature: gridEditScopeSignature(scope) }, current = { ...source, writable: true, disabled: false, alive: true }
    expect(gridEditSourceCurrent(source, current)).toBe(true)
    expect(gridEditSourceCurrent(source, { ...current, page: { ...source.page } })).toBe(false)
    expect(gridEditSourceCurrent(source, { ...current, provider: 'mysql' })).toBe(false)
    expect(gridEditSourceCurrent(source, { ...current, revision: 2 })).toBe(false)
    expect(gridEditSourceCurrent(source, { ...current, signature: 'changed' })).toBe(false)
    expect(gridEditSourceCurrent(source, { ...current, disabled: true })).toBe(false)
    expect(gridEditSourceCurrent(source, { ...current, writable: false })).toBe(false)
    expect(gridEditSourceCurrent(source, { ...current, alive: false })).toBe(false)
  })
  test('keyboard undo/redo requires an explicit grid command and preserves native editor/SQL input', () => {
    expect(gridEditShortcut({ key: 'z', ctrlKey: true })).toBe('undo')
    expect(gridEditShortcut({ key: 'z', metaKey: true, shiftKey: true })).toBe('redo')
    expect(gridEditShortcut({ key: 'y', ctrlKey: true })).toBe('redo')
    expect(gridEditShortcut({ key: 'z', ctrlKey: true, altKey: true })).toBeNull()
    expect(gridEditShortcut({ key: 'z', ctrlKey: true, target: { closest: () => ({}) } as unknown as EventTarget })).toBeNull()
    expect(gridEditShortcut({ key: 'z' })).toBeNull()
  })
})
