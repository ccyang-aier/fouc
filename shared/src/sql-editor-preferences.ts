import {
  validationIssue,
  validationValue,
  ValidationError,
  type ValidationIssue,
  type ValidationValue,
} from './validation-issue';
import {
  DEFAULT_SQL_FORMATTER_SETTINGS,
  isCompleteSqlFormatterSettings,
  type SqlFormatterSettings,
} from './sql-formatter-config';
import { defaultSqlSnippets, validateSqlSnippets, type SqlSnippet } from './sql-snippets';
export const SQL_EDITOR_PREFERENCES_MAX_BYTES = 1024 * 1024;
/** Editor settings belong to one device connection, independent of live query results. */
export type SqlEditorPreferences = {
  version: string | null;
  updatedAt: number | null;
  formatter: SqlFormatterSettings;
  formatOnSave: boolean;
  snippets: SqlSnippet[];
};
export type SqlEditorPreferencesUpdate = Omit<SqlEditorPreferences, 'updatedAt'>;
export function defaultSqlEditorPreferences(): SqlEditorPreferences {
  return {
    version: null,
    updatedAt: null,
    formatter: structuredClone(DEFAULT_SQL_FORMATTER_SETTINGS),
    formatOnSave: false,
    snippets: defaultSqlSnippets(),
  };
}
/** PUT is a complete snapshot; invalid options cannot silently restore defaults. */
export function validateSqlEditorPreferencesUpdate(value: unknown): SqlEditorPreferencesUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ValidationError(
      validationIssue('sql-editor-preferences.invalidSqlEditorSettings', 'SQL 编辑器设置无效'),
    );
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 4 ||
    !Object.keys(input).every((key) =>
      ['version', 'formatter', 'formatOnSave', 'snippets'].includes(key),
    )
  ) {
    throw new ValidationError(
      validationIssue(
        'sql-editor-preferences.submitCompleteSqlEditorSettings',
        '请提交完整的 SQL 编辑器设置',
      ),
    );
  }
  if (
    input.version !== null &&
    (typeof input.version !== 'string' ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(input.version))
  ) {
    throw new ValidationError(
      validationIssue(
        'sql-editor-preferences.invalidSqlEditorSettingsVersion',
        'SQL 编辑器设置版本无效',
      ),
    );
  }
  if (!isCompleteSqlFormatterSettings(input.formatter))
    throw new ValidationError(
      validationIssue(
        'sql-editor-preferences.invalidSqlFormattingSettingsCheckEveryOption',
        'SQL 格式化设置无效，请核对全部选项',
      ),
    );
  if (typeof input.formatOnSave !== 'boolean')
    throw new ValidationError(
      validationIssue('sql-editor-preferences.invalidFormatOnSaveSetting', '保存时格式化设置无效'),
    );
  const snapshot: SqlEditorPreferencesUpdate = {
    version: input.version as string | null,
    formatter: structuredClone(input.formatter),
    formatOnSave: input.formatOnSave,
    snippets: validateSqlSnippets(input.snippets),
  };
  if (
    new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > SQL_EDITOR_PREFERENCES_MAX_BYTES
  ) {
    throw new ValidationError(
      validationIssue(
        'sql-editor-preferences.completeSqlEditorSettingsMustNotExceedMib',
        '完整 SQL 编辑器设置最多 1 MiB，请减少代码片段内容',
      ),
    );
  }
  return snapshot;
}
