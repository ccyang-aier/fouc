import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  resultRowNumber: ['结果行号', 'Result row number'],
  chartSettingsSaved: ['图表设置已保存', 'Chart settings saved'],
  chartSettingsCouldNotBeSavedTheCurrentSettingsRemain: [
    '图表设置未能保存，当前设置仍可用',
    'Chart settings could not be saved; the current settings remain available',
  ],
  queryChartBuilder: ['查询图表构建器', 'Query chart builder'],
  defaultChartSettingsRestored: ['已恢复默认图表设置', 'Default chart settings restored'],
  adjustChartSettings: ['调整图表设置', 'Adjust chart settings'],
  viewSettings: ['查看设置', 'View settings'],
  noRecordsToPlot: ['没有可绘制的记录', 'No records to plot'],
  theCurrentlyLoadedResultsAreEmpty: [
    '当前已加载结果为空。',
    'The currently loaded results are empty.',
  ],
  noValuesCanBePlottedSafely: ['没有可安全绘制的数值', 'No values can be plotted safely'],
  selectAnotherMetricOrUseCount: [
    '请选择其他指标或使用 COUNT(*)。',
    'Select another metric or use COUNT(*).',
  ],
  adjustMetrics: ['调整指标', 'Adjust metrics'],
  plotLoadedRowsOnly: ['仅绘制已加载范围', 'Plot loaded rows only'],
  chartDataInformation: ['绘图数据提示', 'Chart data information'],
  reflectsOnlyTheLoaded: ['仅反映已加载的', 'Reflects only the loaded '],
  rows: ['行。', ' rows.'],
  showing: ['显示', 'Showing '],
  categoriesTheCategoryLimitHasBeenApplied: [
    '个分类，已应用分类上限。',
    ' categories; the category limit has been applied.',
  ],
  items: ['项', ' items'],
  nonTerminatingAveragesAreMarkedHoverDetailsAndChartData: [
    '无法有限表达的平均值以 ≈ 标记；悬停与绘图数据保留精确合计和有效值数量。',
    'Non-terminating averages are marked ≈. Hover details and chart data retain exact sums and valid-value counts.',
  ],
  readingChartSettings: ['正在读取图表设置…', 'Reading chart settings…'],
});
