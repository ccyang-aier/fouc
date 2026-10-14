import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  output: ['输出', 'Output'],
  sort: ['排序', 'Sort'],
  connect: ['连接', 'Connect'],
  scan: ['扫描', 'Scan'],
  indexes: ['索引', 'Indexes'],
  lookup: ['查找', 'Lookup'],
  intermediateResult: ['中间结果', 'Intermediate result'],
  aggregate: ['聚合', 'Aggregate'],
  parallelDistribution: ['并行分发', 'Parallel distribution'],
  otherOperation: ['其他操作', 'Other operation'],
  thisNodeScansTableDataWhetherAnIndexIsNeeded: [
    '此节点扫描表数据；是否需要索引取决于数据规模与筛选条件。',
    'This node scans table data. Whether an index is needed depends on data size and filters.',
  ],
  thisNodeIncludesAdditionalSortingOrTemporaryResultsConsiderThe: [
    '此节点包含额外排序或临时结果，可结合预计行数进一步判断。',
    'This node includes additional sorting or temporary results. Consider the estimated row count.',
  ],
});
