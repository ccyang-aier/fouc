import type { DatabaseCell, DatabaseQueryResult } from '@fouc/shared'
import { addChartDecimals, chartDecimalText, chartNumeric, compareChartDecimals, meanChartDecimal, plotDecimal, type ChartDecimal, type ChartNumeric } from './numbers'
import { CHART_MAX_CELLS, CHART_MAX_POINTS, CHART_MAX_ROWS, CHART_MAX_SERIES, validQueryChartConfig, type ChartField, type QueryChartConfig } from './model'

export type QueryChartPoint = { value: number; exact: string; sourceRows: number; approximate: boolean; x?: number }
export type QueryChartCategory = { key: string; label: string; raw: DatabaseCell; ordinal: number }
export type QueryChartSeries = { key: string; label: string; data: (QueryChartPoint | null)[] }
export type QueryChartDiagnostic = { code: string; message: string; count: number; examples: string[] }
export type QueryChartData = { categories: QueryChartCategory[]; series: QueryChartSeries[]; diagnostics: QueryChartDiagnostic[]; error: string | null; sourceRows: number; usedRows: number; totalCategories: number; limited: boolean; partial: boolean; approximate: number }
type Bucket = { count: number; rows: number; sum: ChartDecimal; min: ChartNumeric | null; max: ChartNumeric | null; first: ChartNumeric | null; invalid: boolean; x?: number }
const zero = { coefficient: 0n, scale: 0 }
function scalar(value: DatabaseCell | undefined): value is string | number | boolean | null { return value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)) }
function token(value: DatabaseCell) { return value === null ? 'null' : `${typeof value}:${String(value).length}:${String(value)}` }
function caption(value: DatabaseCell) { return value === null ? 'NULL' : value === '' ? '空字符串' : value === 'NULL' ? '"NULL"' : String(value) }
function typeCaption(value: DatabaseCell) { return value === null ? 'NULL' : typeof value === 'string' ? '文本' : typeof value === 'number' ? '数值' : '布尔' }
function compareCategories(a: QueryChartCategory, b: QueryChartCategory) {
  if (a.raw === null) return b.raw === null ? 0 : 1
  if (b.raw === null) return -1
  if (typeof a.raw === 'number' && typeof b.raw === 'number') return a.raw - b.raw
  return String(a.raw).localeCompare(String(b.raw), 'zh-CN', { numeric: false }) || typeCaption(a.raw).localeCompare(typeCaption(b.raw))
}

/** Pure, bounded conversion. Rendering limits are applied after full-source aggregation and sorting. */
export function transformQueryChart(result: DatabaseQueryResult, config: QueryChartConfig, fields: readonly ChartField[]): QueryChartData {
  const output: QueryChartData = { categories: [], series: [], diagnostics: [], error: null, sourceRows: result.rows.length, usedRows: 0, totalCategories: 0, limited: false, partial: result.truncated || result.hasMore, approximate: 0 }
  const fail = (message: string) => { output.error = message; return output }
  if (!validQueryChartConfig(config)) return fail('图表设置无效，请重置设置或调整点数限制（1–1,000）。')
  if (result.rows.length > CHART_MAX_ROWS || result.rows.length * result.columns.length > CHART_MAX_CELLS || result.rows.some((row) => row.length > result.columns.length)) return fail('图表最多处理 10,000 行、1,000,000 个单元格。请在查询中缩小结果范围。')
  const fieldMap = new Map(fields.map((field) => [field.key, field])), x = config.x === null ? null : fieldMap.get(config.x), group = config.group === null ? null : fieldMap.get(config.group)
  if (config.x !== null && !x || config.group !== null && !group || config.ys.some((key) => !fieldMap.has(key))) return fail('已保存的字段在当前结果中不存在，请重新选择字段或重置设置。')
  if (config.group !== null && config.group === config.x) return fail('X 轴与分组字段不能相同。')
  if (new Set(config.ys).size !== config.ys.length) return fail('指标字段重复，请重新选择。')
  const metrics = config.aggregation === 'count' ? [{ key: '$count', index: -1, label: '行数 COUNT(*)', numeric: true }] : config.ys.map((key) => fieldMap.get(key)!)
  if (!metrics.length) return fail('请选择至少一个数值指标，或使用“行数 COUNT(*)”统计分类。')
  if (metrics.some((metric) => metric.key === config.x || metric.key === config.group)) return fail('X 轴、分组与指标应选择不同的字段。')
  if (config.type === 'pie' && (metrics.length !== 1 || group)) return fail('饼图需要单个指标，且不支持额外分组。')
  if (config.type === 'pie' && !x) return fail('饼图需要分类字段，请选择 X 轴。')
  if (config.type === 'scatter' && x && !x.numeric) return fail('散点图的 X 轴需要数值字段；也可选择“结果行号”。')
  if (config.aggregation !== 'none' && !x) return fail('聚合需要分类字段，请选择 X 轴。')
  const diagnostics = new Map<string, QueryChartDiagnostic>()
  const record = (code: string, message: string, example = '') => { const diagnostic = diagnostics.get(code) ?? { code, message, count: 0, examples: [] }; diagnostic.count++; if (example && diagnostic.examples.length < 3) diagnostic.examples.push(example); diagnostics.set(code, diagnostic) }
  const categories = new Map<string, QueryChartCategory>(), groups = new Map<string, { label: string; raw: DatabaseCell }>(), buckets = new Map<string, Map<string, Bucket>>(), occurrences = new Map<string, number>()
  let duplicatePie = false
  for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex++) {
    const row = result.rows[rowIndex], rawX = x ? row[x.index] : rowIndex + 1, rawGroup = group ? row[group.index] : ''
    if (!scalar(rawX) || !scalar(rawGroup)) { record('dimension', 'X 轴或分组中的缺失值、对象、二进制及不安全数值已排除', `第 ${rowIndex + 1} 行`); continue }
    let numericX: number | undefined
    if (config.type === 'scatter') { const parsed = chartNumeric(rawX); if (!('numeric' in parsed)) { record('scatter-x', '散点 X 轴的 NULL、非数值或不安全精度已排除', `第 ${rowIndex + 1} 行`); continue } numericX = parsed.numeric.value }
    const parsed = metrics.map((metric) => metric.index < 0 ? chartNumeric(1) : chartNumeric(row[metric.index]))
    if (config.nulls === 'skip' && parsed.some((value) => 'reason' in value && value.reason === 'null')) { record('null-skipped', '根据设置，含 NULL 指标的行已跳过', `第 ${rowIndex + 1} 行`); continue }
    const groupKey = token(rawGroup), baseCategory = token(rawX), occurrenceKey = `${groupKey}\u0000${baseCategory}`, occurrence = occurrences.get(occurrenceKey) ?? 0
    occurrences.set(occurrenceKey, occurrence + 1)
    if (config.type === 'pie' && config.aggregation === 'none' && occurrence > 0) duplicatePie = true
    const categoryKey = config.aggregation === 'none' ? `${baseCategory}\u0000${occurrence}` : baseCategory
    if (!categories.has(categoryKey)) categories.set(categoryKey, { key: categoryKey, label: caption(rawX), raw: rawX, ordinal: categories.size })
    if (!groups.has(groupKey)) groups.set(groupKey, { label: caption(rawGroup), raw: rawGroup })
    if (groups.size * metrics.length > CHART_MAX_SERIES) return fail(`分组与指标组合超过 ${CHART_MAX_SERIES} 条系列，请减少指标或在 SQL 中缩小分组范围。`)
    output.usedRows++
    for (let metricIndex = 0; metricIndex < metrics.length; metricIndex++) {
      const metric = metrics[metricIndex], seriesKey = `${groupKey}\u0000${metric.key}`, seriesBuckets = buckets.get(seriesKey) ?? new Map<string, Bucket>(), bucket = seriesBuckets.get(categoryKey) ?? { count: 0, rows: 0, sum: zero, min: null, max: null, first: null, invalid: false, x: numericX }
      bucket.rows++
      let value = parsed[metricIndex]
      if ('reason' in value) {
        const example = `第 ${rowIndex + 1} 行 · ${metric.label}`
        if (value.reason === 'null') { record('null', config.nulls === 'zero' ? '根据设置，NULL 指标显式按 0 处理' : 'NULL 指标保留为空白；聚合忽略 NULL', example); if (config.nulls === 'zero') value = chartNumeric(0) }
        else { bucket.invalid = true; record(value.reason, value.reason === 'precision' ? '不安全大整数或高精度小数未转换为近似数值；所在聚合点已保留空白' : value.reason === 'missing' ? '缺失指标未作为 NULL 或 0 处理；所在聚合点保留空白' : '非数值指标未参与绘图；所在聚合点保留空白', example) }
      }
      if ('numeric' in value) { const number = value.numeric; bucket.count++; bucket.sum = addChartDecimals(bucket.sum, number.decimal); bucket.first ??= number; if (!bucket.min || compareChartDecimals(number.decimal, bucket.min.decimal) < 0) bucket.min = number; if (!bucket.max || compareChartDecimals(number.decimal, bucket.max.decimal) > 0) bucket.max = number }
      seriesBuckets.set(categoryKey, bucket); buckets.set(seriesKey, seriesBuckets)
    }
  }
  if (duplicatePie) return fail('饼图存在重复分类。请选择 SUM、AVG 或行数等聚合，避免重复类别被隐式合并。')
  // Captions remain unambiguous even when numeric 1 and text "1" coexist.
  const captions = new Map<string, Set<string>>()
  for (const category of categories.values()) { const entries = captions.get(category.label) ?? new Set<string>(); entries.add(token(category.raw)); captions.set(category.label, entries) }
  const allCategories = [...categories.values()].map((category) => captions.get(category.label)!.size > 1 ? { ...category, label: `${category.label} · ${typeCaption(category.raw)}` } : category)
  const pointMaps = new Map<string, Map<string, QueryChartPoint | null>>()
  for (const [seriesKey, seriesBuckets] of buckets) {
    const points = new Map<string, QueryChartPoint | null>()
    for (const [categoryKey, bucket] of seriesBuckets) {
      let numeric: ChartNumeric | null = null
      if (!bucket.invalid && bucket.count) {
        numeric = config.aggregation === 'sum' || config.aggregation === 'count' ? plotDecimal(bucket.sum) : config.aggregation === 'avg' ? meanChartDecimal(bucket.sum, bucket.count) : config.aggregation === 'min' ? bucket.min : config.aggregation === 'max' ? bucket.max : bucket.first
        if (!numeric) record('aggregate-precision', '聚合结果超出可安全绘图的精度，未四舍五入', chartDecimalText(bucket.sum))
      }
      if (numeric?.approximate) output.approximate++
      if (config.type === 'pie' && numeric && numeric.value < 0) return fail('饼图无法表达负值，请改用柱状图、折线图或调整指标。')
      points.set(categoryKey, numeric ? { value: numeric.value, exact: numeric.exact, approximate: !!numeric.approximate, sourceRows: bucket.rows, x: bucket.x } : null)
    }
    pointMaps.set(seriesKey, points)
  }
  const firstSeries = pointMaps.values().next().value as Map<string, QueryChartPoint | null> | undefined
  if (config.sort !== 'source') allCategories.sort((a, b) => {
    if (config.sort.startsWith('x-')) return compareCategories(a, b) * (config.sort === 'x-desc' ? -1 : 1) || a.ordinal - b.ordinal
    const left = firstSeries?.get(a.key), right = firstSeries?.get(b.key)
    if (!left || !right) return left ? -1 : right ? 1 : a.ordinal - b.ordinal
    return (left.value - right.value) * (config.sort === 'value-desc' ? -1 : 1) || a.ordinal - b.ordinal
  })
  output.totalCategories = allCategories.length
  const limit = Math.min(config.limit, Math.max(1, Math.floor(CHART_MAX_POINTS / Math.max(1, buckets.size))))
  output.categories = allCategories.slice(0, limit); output.limited = output.categories.length < allCategories.length
  for (const [groupKey, groupValue] of groups) for (const metric of metrics) {
    const key = `${groupKey}\u0000${metric.key}`, map = pointMaps.get(key)
    if (!map) continue
    const repeatedGroupLabel = [...groups.values()].filter((value) => value.label === groupValue.label).length > 1
    const groupLabel = `${groupValue.label}${repeatedGroupLabel ? ` · ${typeCaption(groupValue.raw)}` : ''}`
    output.series.push({ key, label: group ? `${groupLabel} / ${metric.label}` : metric.label, data: output.categories.map((category) => map.get(category.key) ?? null) })
  }
  output.diagnostics = [...diagnostics.values()]
  if (config.type === 'pie') { const zeros = output.series[0]?.data.filter((point) => point?.value === 0).length ?? 0; if (zeros) output.diagnostics.push({ code: 'pie-zero', message: '值为 0 的类别不占扇区面积', count: zeros, examples: [] }) }
  return output
}
