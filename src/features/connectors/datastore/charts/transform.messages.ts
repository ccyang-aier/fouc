import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  emptyString: ['空字符串', 'Empty string'],
  text: ['文本', 'Text'],
  numeric: ['数值', 'Numeric'],
  boolean: ['布尔', 'Boolean'],
  invalidChartSettingsResetThemOrAdjustThePointLimit: [
    '图表设置无效，请重置设置或调整点数限制（1–1,000）。',
    'Invalid chart settings. Reset them or adjust the point limit to 1–1,000.',
  ],
  chartsSupportUpToRowsAndCellsLimitTheResult: [
    '图表最多处理 10,000 行、1,000,000 个单元格。请在查询中缩小结果范围。',
    'Charts support up to 10,000 rows and 1,000,000 cells. Limit the result set in your query.',
  ],
  savedFieldsAreMissingFromTheCurrentResultsSelectFields: [
    '已保存的字段在当前结果中不存在，请重新选择字段或重置设置。',
    'Saved fields are missing from the current results. Select fields again or reset the settings.',
  ],
  theXAxisAndGroupingFieldMustBeDifferent: [
    'X 轴与分组字段不能相同。',
    'The X axis and grouping field must be different.',
  ],
  metricFieldsAreDuplicatedSelectThemAgain: [
    '指标字段重复，请重新选择。',
    'Metric fields are duplicated. Select them again.',
  ],
  rowCountCount: ['行数 COUNT(*)', 'Row count COUNT(*)'],
  selectAtLeastOneNumericMetricOrUseRowCount: [
    '请选择至少一个数值指标，或使用“行数 COUNT(*)”统计分类。',
    'Select at least one numeric metric, or use Row count COUNT(*) to count categories.',
  ],
  useDifferentFieldsForTheXAxisGroupingAndMetrics: [
    'X 轴、分组与指标应选择不同的字段。',
    'Use different fields for the X axis, grouping and metrics.',
  ],
  pieChartsRequireOneMetricAndDoNotSupportAdditional: [
    '饼图需要单个指标，且不支持额外分组。',
    'Pie charts require one metric and do not support additional grouping.',
  ],
  pieChartsRequireACategoryFieldSelectAnXAxis: [
    '饼图需要分类字段，请选择 X 轴。',
    'Pie charts require a category field. Select an X axis.',
  ],
  scatterPlotsRequireANumericXAxisResultRowNumber: [
    '散点图的 X 轴需要数值字段；也可选择“结果行号”。',
    'Scatter plots require a numeric X axis; Result row number is also available.',
  ],
  aggregationRequiresACategoryFieldSelectAnXAxis: [
    '聚合需要分类字段，请选择 X 轴。',
    'Aggregation requires a category field. Select an X axis.',
  ],
  missingValuesObjectsBinaryValuesAndUnsafeNumbersInThe: [
    'X 轴或分组中的缺失值、对象、二进制及不安全数值已排除',
    'Missing values, objects, binary values and unsafe numbers in the X axis or grouping field were excluded',
  ],
  row: ['第 {p0} 行', 'Row {p0}'],
  nullNonNumericOrUnsafePrecisionScatterXValuesWere: [
    '散点 X 轴的 NULL、非数值或不安全精度已排除',
    'NULL, non-numeric or unsafe-precision scatter X values were excluded',
  ],
  rowsContainingNullMetricsWereSkippedAccordingToTheSettings: [
    '根据设置，含 NULL 指标的行已跳过',
    'Rows containing NULL metrics were skipped according to the settings',
  ],
  groupingAndMetricsProduceMoreThanSeriesReduceMetricsOr: [
    '分组与指标组合超过 {p0} 条系列，请减少指标或在 SQL 中缩小分组范围。',
    'Grouping and metrics produce more than {p0} series. Reduce metrics or limit grouping in SQL.',
  ],
  row377: ['第 {p0} 行 · {p1}', 'Row {p0} · {p1}'],
  nullMetricsWereExplicitlyTreatedAsZeroAccordingToThe: [
    '根据设置，NULL 指标显式按 0 处理',
    'NULL metrics were explicitly treated as zero according to the settings',
  ],
  nullMetricsRemainGapsAggregationIgnoresNull: [
    'NULL 指标保留为空白；聚合忽略 NULL',
    'NULL metrics remain gaps; aggregation ignores NULL',
  ],
  unsafeLargeIntegersAndHighPrecisionDecimalsWereNotApproximated: [
    '不安全大整数或高精度小数未转换为近似数值；所在聚合点已保留空白',
    'Unsafe large integers and high-precision decimals were not approximated; their aggregated points remain blank',
  ],
  missingMetricsWereNotTreatedAsNullOrZeroTheir: [
    '缺失指标未作为 NULL 或 0 处理；所在聚合点保留空白',
    'Missing metrics were not treated as NULL or zero; their aggregated points remain blank',
  ],
  nonNumericMetricsWereNotPlottedTheirAggregatedPointsRemain: [
    '非数值指标未参与绘图；所在聚合点保留空白',
    'Non-numeric metrics were not plotted; their aggregated points remain blank',
  ],
  thePieChartContainsDuplicateCategoriesChooseAnAggregationSuch: [
    '饼图存在重复分类。请选择 SUM、AVG 或行数等聚合，避免重复类别被隐式合并。',
    'The pie chart contains duplicate categories. Choose an aggregation such as SUM, AVG or Row count to prevent implicit merging.',
  ],
  aggregatedValuesExceedSafePlottingPrecisionAndWereNotRounded: [
    '聚合结果超出可安全绘图的精度，未四舍五入',
    'Aggregated values exceed safe plotting precision and were not rounded',
  ],
  pieChartsCannotRepresentNegativeValuesUseABarOr: [
    '饼图无法表达负值，请改用柱状图、折线图或调整指标。',
    'Pie charts cannot represent negative values. Use a bar or line chart, or adjust the metrics.',
  ],
  zeroValueCategoriesOccupyNoSectorArea: [
    '值为 0 的类别不占扇区面积',
    'Zero-value categories occupy no sector area',
  ],
});
