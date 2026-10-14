import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  categoriesInspectOriginalValuesInChartData: [
    '{p0} · {p1} · {p2} 个分类；可在绘图数据中核对原始数值',
    '{p0} · {p1} · {p2} categories; inspect original values in chart data',
  ],
  loadingChart: ['正在加载图表', 'Loading chart'],
  theRenderingModuleLoadsOnlyWhenAChartIsUsed: [
    '仅在使用图表时加载绘图模块',
    'The rendering module loads only when a chart is used',
  ],
  couldNotLoadTheChartRenderer: ['绘图模块加载失败', 'Could not load the chart renderer'],
  queryResultsAndChartSettingsAreRetained: [
    '查询结果与图表设置已保留。',
    'Query results and chart settings are retained.',
  ],
  reload: ['重新加载', 'Reload'],
});
