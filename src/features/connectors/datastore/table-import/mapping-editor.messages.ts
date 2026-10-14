import { defineMessages } from '@/lib/i18n';

export const messages = defineMessages({
  importColumnMapping: ['导入字段映射', 'Import column mapping'],
  mapSourceColumnsToTheTargetTable: [
    '将源字段映射到目标表',
    'Map source columns to the target table',
  ],
  unmappedColumnsAreSkippedTargetDefaultsApplyOnlyToMissing: [
    '未映射的字段会跳过。目标默认值只用于缺失字段。',
    'Unmapped columns are skipped. Target defaults apply only to missing columns.',
  ],
  autoMatch: ['自动匹配', 'Auto-match'],
  sourceColumn: ['源字段', 'Source column'],
  targetColumn: ['的目标字段', 'target column'],
  skipThisColumn: ['跳过此字段', 'Skip this column'],
  generatedAutomatically: [' · 自动生成', ' · Generated automatically'],
  required: [' · 必填', ' · Required'],
  hasDefault: [' · 有默认值', ' · Has default'],
  nullable: [' · 可空', ' · Nullable'],
  willNotBeWrittenToTheTargetTable: ['不会写入目标表', 'Will not be written to the target table'],
});
