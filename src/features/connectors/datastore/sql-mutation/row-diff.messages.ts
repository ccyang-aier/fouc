import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  noRowsMatchTheScope: ['范围没有匹配行。', 'No rows match the scope.'],
  sqlOldAndNewValueComparison: ['SQL 旧值与新值对照', 'SQL old and new value comparison'],
  field: ['字段', 'Field'],
  currentValue: ['当前值', 'Current value'],
  afterCommit: ['提交后', 'After commit'],
  addRow: ['新增行', 'Add row'],
  toBeDeleted: ['将删除', 'To be deleted'],
  thisRowHasNoKnownValueChangesTurnOffChanges: [
    '该行没有已知值变化。可取消“仅看变化”查看全部字段。',
    'This row has no known value changes. Turn off “Changes only” to view every column.',
  ],
  databaseGenerated: ['数据库生成', 'Database-generated'],
  emptyString: ['空字符串', 'Empty string'],
});
