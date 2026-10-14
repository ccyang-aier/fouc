import { defineMessages } from '@/lib/i18n';
export const messages = defineMessages({
  invalidSqlEditorSettings: ['SQL 编辑器设置无效', 'Invalid SQL editor settings'],
  submitCompleteSqlEditorSettings: [
    '请提交完整的 SQL 编辑器设置',
    'Submit complete SQL editor settings',
  ],
  invalidSqlEditorSettingsVersion: [
    'SQL 编辑器设置版本无效',
    'Invalid SQL editor settings version',
  ],
  invalidSqlFormattingSettingsCheckEveryOption: [
    'SQL 格式化设置无效，请核对全部选项',
    'Invalid SQL formatting settings. Check every option',
  ],
  invalidFormatOnSaveSetting: ['保存时格式化设置无效', 'Invalid format-on-save setting'],
  completeSqlEditorSettingsMustNotExceedMib: [
    '完整 SQL 编辑器设置最多 1 MiB，请减少代码片段内容',
    'Complete SQL editor settings must not exceed 1 MiB. Reduce snippet content',
  ],
});
