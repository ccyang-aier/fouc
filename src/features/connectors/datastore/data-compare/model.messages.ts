import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  theLoadedResultsContainRowsOneComparisonSupportsUpTo: [
    '已加载结果共 {p0} 行，单次比较最多 {p1} 行。请缩小查询范围。',
    'The loaded results contain {p0} rows; one comparison supports up to {p1}. Limit your query.',
  ],
  theLoadedResultsExceedCellsReturnFewerRowsOrColumns: [
    '已加载结果超过 1,000,000 个单元格。请在查询中减少返回行或列。',
    'The loaded results exceed 1,000,000 cells. Return fewer rows or columns in the query.',
  ],
  mapAtLeastOnePairOfComparisonColumns: [
    '请至少映射一对比较列。',
    'Map at least one pair of comparison columns.',
  ],
  columnMappingsMustBeOneToOneWithUniqueMapping: [
    '列映射须一对一，且映射标识不能重复。',
    'Column mappings must be one-to-one, with unique mapping identifiers.',
  ],
  aColumnMappingIsOutsideTheCurrentResultRange: [
    '列映射超出当前结果范围。',
    'A column mapping is outside the current result range.',
  ],
  explicitlySelectAtLeastOneMatchingKeySelectMultipleColumns: [
    '请明确选择至少一个匹配键。可选择多个列组成复合键。',
    'Explicitly select at least one matching key. Select multiple columns for a composite key.',
  ],
  matchingKeysMustBelongToTheCurrentColumnMappingsAnd: [
    '匹配键必须属于当前列映射且不能重复。',
    'Matching keys must belong to the current column mappings and must not be duplicated.',
  ],
});
