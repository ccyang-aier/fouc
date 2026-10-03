import { describe, expect, test } from 'bun:test'
import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared'
import { chartNumeric, chartDecimal, meanChartDecimal } from './numbers'
import { CHART_STORAGE_PREFIX, defaultQueryChartConfig, loadQueryChartConfig, queryChartFields, saveQueryChartConfig, type QueryChartConfig } from './model'
import { transformQueryChart } from './transform'
import { queryChartOption } from './options'

function result(columns: string[], rows: DatabaseCell[][], extra: Partial<DatabaseQueryResult> = {}): DatabaseQueryResult { return { columns, rows, columnTypes: [], columnSortables: [], affectedRows: 0, executionTimeMs: 0, truncated: false, hasMore: false, sessionId: null, messages: [], ...extra } }
function build(source: DatabaseQueryResult, change: Partial<QueryChartConfig> = {}) { const fields = queryChartFields(source), config = { ...defaultQueryChartConfig(fields), ...change }; return { config, data: transformQueryChart(source, config, fields), fields } }
const source = result(['category', 'amount', 'units', 'team'], [['A', '0.1', 2, 'East'], ['A', '0.2', 3, 'East'], ['B', null, 4, 'West'], ['C', '-2.5', 5, 'West']])

describe('query chart precision boundary', () => {
  test('SQL values never silently round, coerce booleans or turn NULL into zero', () => {
    expect(chartNumeric('0.100000000000000005')).toEqual({ reason: 'precision' })
    expect(chartNumeric('9007199254740993')).toEqual({ reason: 'precision' })
    expect(chartNumeric(9007199254740992)).toEqual({ reason: 'precision' })
    expect(chartNumeric('')).toEqual({ reason: 'invalid' })
    expect(chartNumeric('0x10')).toEqual({ reason: 'invalid' })
    expect(chartNumeric(true)).toEqual({ reason: 'invalid' })
    expect(chartNumeric(null)).toEqual({ reason: 'null' })
    expect(chartNumeric(undefined)).toEqual({ reason: 'missing' })
    expect(chartNumeric('1.20e1')).toMatchObject({ numeric: { value: 12, exact: '1.20e1' } })
    expect(chartNumeric('-0.25')).toMatchObject({ numeric: { value: -.25, exact: '-0.25' } })
  })
  test('decimal sums are exact, large aggregate results are refused and means disclose approximation', () => {
    const sum = build(source, { aggregation: 'sum' }).data
    expect(sum.series[0].data.map((point) => point?.exact ?? null)).toEqual(['0.3', null, '-2.5'])
    const unsafe = build(result(['x', 'y'], [['A', '9007199254740991'], ['A', 1]]), { aggregation: 'sum' }).data
    expect(unsafe.series[0].data).toEqual([null]); expect(unsafe.diagnostics[0].code).toBe('aggregate-precision')
    const mean = meanChartDecimal(chartDecimal('1')!, 3)
    expect(mean?.approximate).toBe(true); expect(mean?.exact).toContain('1 / 3'); expect(mean?.value).toBeCloseTo(1 / 3)
    expect(meanChartDecimal(chartDecimal('3e-300')!, 2)?.value).toBe(1.5e-300)
    const invalid = build(result(['x', 'y'], [['A', 2], ['A', '9007199254740993']]), { aggregation: 'sum' }).data
    expect(invalid.series[0].data).toEqual([null]); expect(invalid.diagnostics.some((item) => item.code === 'precision')).toBe(true)
  })
})

describe('query chart field and source mapping', () => {
  test('repeated names have independent keys and the second metric reads its actual column', () => {
    const original = result(['x', 'amount', 'amount'], [['A', 1, 100], ['B', 2, 200]]), fields = queryChartFields(original)
    expect(fields[1].key).not.toBe(fields[2].key); expect(fields[2].label).toBe('amount #3')
    const chart = build(original, { ys: [fields[2].key] }).data
    expect(chart.series[0].data.map((point) => point?.value)).toEqual([100, 200]); expect(original.rows[0][2]).toBe(100)
  })
  test('NULL is a gap by default, zero and row skipping are explicit; missing is never NULL', () => {
    const base = build(source).data
    expect(base.series[0].data.map((point) => point?.value ?? null)).toEqual([.1, .2, null, -2.5])
    expect(build(source, { nulls: 'zero' }).data.series[0].data[2]?.exact).toBe('0')
    expect(build(source, { nulls: 'skip' }).data.categories.map((category) => category.label)).toEqual(['A', 'A', 'C'])
    const missing = build(result(['x', 'y'], [['A', 1], ['B']]), { nulls: 'zero' }).data
    expect(missing.series[0].data[1]).toBeNull(); expect(missing.diagnostics[0].code).toBe('missing')
  })
  test('grouping, composite typed categories, NULL and literal NULL remain distinct', () => {
    const chart = build(source, { aggregation: 'sum', group: queryChartFields(source)[3].key }).data
    expect(chart.series.map((series) => series.label)).toEqual(['East / amount', 'West / amount'])
    expect(chart.series[0].data.map((point) => point?.exact ?? null)).toEqual(['0.3', null, null])
    const typed = build(result(['x', 'y'], [[1, 2], ['1', 3], [null, 4], ['NULL', 5], ['', 6]]), { x: 'x\u00000', ys: ['y\u00000'], aggregation: 'sum' }).data
    expect(typed.categories.map((category) => category.label)).toEqual(['1 · 数值', '1 · 文本', 'NULL', '"NULL"', '空字符串'])
    expect(typed.totalCategories).toBe(5)
  })
  test('aggregation runs on all loaded rows before sorting and display limits', () => {
    const loaded = result(['x', 'y'], [['A', 3], ['B', 2], ['B', 5], ['C', 4]], { truncated: true, hasMore: true })
    const chart = build(loaded, { aggregation: 'sum', sort: 'value-desc', limit: 1 }).data
    expect(chart.categories[0].label).toBe('B'); expect(chart.series[0].data[0]?.exact).toBe('7'); expect(chart.totalCategories).toBe(3); expect(chart.usedRows).toBe(4); expect(chart.limited).toBe(true); expect(chart.partial).toBe(true)
  })
  test('count covers actual source rows, including NULL metrics', () => {
    const chart = build(source, { aggregation: 'count', ys: [] }).data
    expect(chart.series[0].label).toBe('行数 COUNT(*)'); expect(chart.series[0].data.map((point) => point?.value)).toEqual([2, 1, 1])
    expect(chart.error).toBeNull()
  })
  test('pie rejects repeated categories and negative metrics; scatter uses actual numeric X', () => {
    expect(build(source, { type: 'pie' }).data.error).toContain('重复分类')
    expect(build(source, { type: 'pie', aggregation: 'sum' }).data.error).toContain('负值')
    expect(build(source, { type: 'scatter' }).data.error).toContain('X 轴需要数值')
    const numeric = result(['x', 'y'], [[10, 2], [20, 3]]), fields = queryChartFields(numeric)
    const chart = build(numeric, { type: 'scatter', x: fields[0].key, ys: [fields[1].key] }).data
    expect(chart.series[0].data.map((point) => point?.x)).toEqual([10, 20])
  })
  test('invalid fields and bounded-source limits are visible settings errors', () => {
    expect(build(source, { ys: ['missing'] }).data.error).toContain('不存在')
    expect(build(source, { limit: 1001 }).data.error).toContain('设置无效')
    expect(build(result(['x'], Array.from({ length: 10001 }, (_, index) => [index]))).data.error).toContain('10,000')
    const groups = result(['x', 'y', 'g'], Array.from({ length: 25 }, (_, index) => ['A', index, `group-${index}`]))
    expect(build(groups, { aggregation: 'sum', group: queryChartFields(groups)[2].key }).data.error).toContain('24')
  })
  test('plot options preserve negative values and holes; tooltip is rich text rather than HTML', () => {
    const chart = build(source), option = queryChartOption(chart.data, chart.config, { ink: '#111', muted: '#777', line: '#eee', panel: '#fff', accent: '#369', font: 'sans-serif' }, 'category') as { tooltip: { renderMode: string }; series: { data: ({ value: number } | null)[]; connectNulls?: boolean }[] }
    expect(option.tooltip.renderMode).toBe('richText'); expect(option.series[0].data[2]).toBeNull(); expect(option.series[0].data[3]?.value).toBe(-2.5)
    const line = queryChartOption(chart.data, { ...chart.config, type: 'line' }, { ink: '#111', muted: '#777', line: '#eee', panel: '#fff', accent: '#369', font: 'sans-serif' }, 'category') as typeof option
    expect(line.series[0].connectNulls).toBe(false)
  })
})

test('chart configuration isolates workspace/document scopes and restores only the current schema', () => {
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }, config = build(source).config
  expect(saveQueryChartConfig(storage, 'workspace-a/connection/query', config)).toBe(true)
  expect(loadQueryChartConfig(storage, 'workspace-a/connection/query')).toEqual(config)
  expect(loadQueryChartConfig(storage, 'workspace-b/connection/query')).toBeNull()
  expect(saveQueryChartConfig(storage, undefined, config)).toBe(false)
  values.set(CHART_STORAGE_PREFIX + 'broken', JSON.stringify({ version: 1, config: { ...config, ys: [1] } }))
  expect(loadQueryChartConfig(storage, 'broken')).toBeNull()
  expect(saveQueryChartConfig({ setItem: () => { throw new Error('quota') } }, 'a', config)).toBe(false)
})
