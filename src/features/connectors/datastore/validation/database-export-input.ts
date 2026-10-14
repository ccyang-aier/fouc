import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './database-export-input.messages';
import { localizedValidationValues } from './values';
const keys = {
  'database-export-input.databaseExportParametersMustBeAnObject':
    'databaseExportParametersMustBeAnObject',
  'database-export-input.databaseExportContainsUnknownParameters':
    'databaseExportContainsUnknownParameters',
  'database-export-input.invalidExportObjectName': 'invalidExportObjectName',
  'database-export-input.chooseSchemas': 'chooseSchemas',
  'database-export-input.chooseAtMostTablesViews': 'chooseAtMostTablesViews',
  'database-export-input.invalidOrDuplicateTableScope': 'invalidOrDuplicateTableScope',
  'database-export-input.chooseASupportedExportFormat': 'chooseASupportedExportFormat',
  'database-export-input.chooseStructureOrData': 'chooseStructureOrData',
  'database-export-input.nativeStructureScriptsSupportOnlySqlCsvJson':
    'nativeStructureScriptsSupportOnlySqlCsvJson',
  'database-export-input.invalidExportPackagingMethod': 'invalidExportPackagingMethod',
  'database-export-input.eachPackageMustBeMib': 'eachPackageMustBeMib',
  'database-export-input.splitPackagesRequireAZipContainer': 'splitPackagesRequireAZipContainer',
  'database-export-input.readRowsPerPage': 'readRowsPerPage',
  'database-export-input.theExplicitPerTableRowRangeMustBe': 'theExplicitPerTableRowRangeMustBe',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
