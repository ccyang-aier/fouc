import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  output: ['输出：{p0}', 'Output: {p0}'],
  commonTableExpressionInTheCurrentStatement: [
    '当前语句的公共表表达式',
    'Common table expression in the current statement',
  ],
  source: ['来源：{p0}', 'Source: {p0}'],
  cteOutputColumnClickToViewItsDefinition: [
    'CTE 输出列；点击查看定义',
    'CTE output column; click to view its definition',
  ],
  cteStarProjectionColumnMetadataIsRequiredToResolveSources: [
    'CTE 星号投影；具体来源需要字段元数据',
    'CTE star projection; column metadata is required to resolve sources',
  ],
  derivedTableAliasInTheCurrentQueryBlock: [
    '当前查询块的派生表别名',
    'Derived table alias in the current query block',
  ],
  sourceAliasInTheCurrentQueryBlock: [
    '当前查询块的来源别名',
    'Source alias in the current query block',
  ],
  databaseFunctionReturningARowSet: [
    '返回行集的数据库函数',
    'Database function returning a row set',
  ],
  tableSourceInTheCurrentQuery: ['当前查询的表来源', 'Table source in the current query'],
});
