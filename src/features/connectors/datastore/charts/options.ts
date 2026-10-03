import type { EChartsCoreOption } from 'echarts/core'
import type { QueryChartConfig } from './model'
import type { QueryChartData, QueryChartPoint } from './transform'

export type QueryChartTheme = { ink: string; muted: string; line: string; panel: string; font: string; accent: string }
function tooltip(parameters: unknown): string {
  const entries = Array.isArray(parameters) ? parameters : [parameters]
  return entries.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return []
    const parameter = entry as { name?: string; seriesName?: string; data?: { rawPoint?: QueryChartPoint; categoryLabel?: string } }, point = parameter.data?.rawPoint
    return point ? [`${parameter.data?.categoryLabel ?? parameter.name ?? ''}\n${parameter.seriesName ?? ''}: ${point.exact}\n来源 ${point.sourceRows} 行`] : []
  }).join('\n\n')
}
export function queryChartOption(data: QueryChartData, config: QueryChartConfig, theme: QueryChartTheme, xLabel: string): EChartsCoreOption {
  const colors = [theme.accent, '#359781', '#bd8a3f', '#9b7bc2', '#529bae', '#c37c88', '#788ba3'], categorical = config.type !== 'scatter', pie = config.type === 'pie'
  const common = {
    backgroundColor: 'transparent', color: colors, animation: false,
    textStyle: { color: theme.ink, fontFamily: theme.font, fontSize: 12 },
    tooltip: { trigger: pie || !categorical ? 'item' : 'axis', renderMode: 'richText', confine: true, formatter: tooltip, backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, textStyle: { color: theme.ink, fontSize: 12 }, padding: [10, 12], axisPointer: { type: config.type === 'bar' ? 'shadow' : 'line', lineStyle: { color: theme.muted } } },
    legend: { type: 'scroll', bottom: 2, left: 'center', itemWidth: 11, itemHeight: 7, textStyle: { color: theme.muted, fontSize: 11 }, pageTextStyle: { color: theme.muted } },
  }
  if (pie) return { ...common, series: [{ type: 'pie', name: data.series[0]?.label, radius: ['34%', '65%'], center: ['50%', '45%'], avoidLabelOverlap: true, stillShowZeroSum: false, label: { color: theme.muted, fontSize: 11, overflow: 'truncate', width: 120 }, labelLine: { length: 12, length2: 8, lineStyle: { color: theme.line } }, itemStyle: { borderColor: theme.panel, borderWidth: 2 }, data: (data.series[0]?.data ?? []).flatMap((point, index) => point && point.value > 0 ? [{ name: data.categories[index].label, value: point.value, rawPoint: point, categoryLabel: data.categories[index].label }] : []) }] }
  const zoom = data.categories.length > 30
  return {
    ...common,
    grid: { left: 18, right: 22, top: 26, bottom: zoom ? 86 : 55, containLabel: true },
    xAxis: { type: categorical ? 'category' : 'value', name: xLabel, nameLocation: 'middle', nameGap: 32, nameTextStyle: { color: theme.muted, fontSize: 11 }, ...(categorical ? { data: data.categories.map((category) => category.label), boundaryGap: config.type === 'bar' } : { scale: true }), axisLine: { lineStyle: { color: theme.line } }, axisTick: { show: false }, axisLabel: { color: theme.muted, fontSize: 11, hideOverlap: true, overflow: 'truncate', width: 100 }, splitLine: { show: !categorical, lineStyle: { color: theme.line, type: 'dashed' } } },
    yAxis: { type: 'value', scale: config.type === 'scatter', axisLabel: { color: theme.muted, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: theme.line, type: 'dashed' } } },
    ...(zoom ? { dataZoom: [{ type: 'inside', filterMode: 'none', start: 0, end: Math.min(100, 60 / data.categories.length * 100) }, { type: 'slider', height: 16, bottom: 30, borderColor: theme.line, textStyle: { color: theme.muted, fontSize: 10 }, brushSelect: false, showDetail: false, handleSize: 10, start: 0, end: Math.min(100, 60 / data.categories.length * 100) }] } : {}),
    series: data.series.map((series) => ({
      id: series.key, name: series.label, type: config.type === 'area' ? 'line' : config.type,
      ...(config.type === 'bar' ? { barMaxWidth: 38, barGap: '18%', itemStyle: { borderRadius: [2, 2, 0, 0] } } : { symbol: 'circle', symbolSize: config.type === 'scatter' ? 7 : 5, showSymbol: data.categories.length <= 80, connectNulls: false, smooth: false, lineStyle: { width: 2 }, ...(config.type === 'area' ? { areaStyle: { opacity: .12 } } : {}) }),
      emphasis: { focus: 'series' },
      data: series.data.map((point, index) => point ? { value: categorical ? point.value : [point.x ?? index + 1, point.value], rawPoint: point, categoryLabel: data.categories[index].label } : null),
    })),
  }
}
