import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './sql-editor-preferences.messages';
import { localizedValidationValues } from './values';
const keys = {
  'sql-editor-preferences.invalidSqlEditorSettings': 'invalidSqlEditorSettings',
  'sql-editor-preferences.submitCompleteSqlEditorSettings': 'submitCompleteSqlEditorSettings',
  'sql-editor-preferences.invalidSqlEditorSettingsVersion': 'invalidSqlEditorSettingsVersion',
  'sql-editor-preferences.invalidSqlFormattingSettingsCheckEveryOption':
    'invalidSqlFormattingSettingsCheckEveryOption',
  'sql-editor-preferences.invalidFormatOnSaveSetting': 'invalidFormatOnSaveSetting',
  'sql-editor-preferences.completeSqlEditorSettingsMustNotExceedMib':
    'completeSqlEditorSettingsMustNotExceedMib',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
