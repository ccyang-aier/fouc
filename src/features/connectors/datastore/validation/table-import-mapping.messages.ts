import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  columnMappingsSupportAtMostEntries: [
    '字段映射最多 256 项。',
    'Column mappings support at most 256 entries.',
  ],
  sourceColumnDoesNotExist: ['源字段不存在：{p0}', 'Source column does not exist: {p0}'],
  sourceColumnMappedMoreThanOnce: [
    '源字段重复映射：{p0}',
    'Source column mapped more than once: {p0}',
  ],
  targetColumnDoesNotExist: ['目标字段不存在：{p0}', 'Target column does not exist: {p0}'],
  generatedColumnsCannotBeImported: [
    '生成字段不可导入：{p0}',
    'Generated columns cannot be imported: {p0}',
  ],
  targetColumnMappedMoreThanOnce: [
    '目标字段重复映射：{p0}',
    'Target column mapped more than once: {p0}',
  ],
  mapAtLeastOneTargetColumn: ['至少映射一个目标字段。', 'Map at least one target column.'],
  requiredColumnsAreNotMapped: ['必填字段尚未映射：{p0}', 'Required columns are not mapped: {p0}'],
});
