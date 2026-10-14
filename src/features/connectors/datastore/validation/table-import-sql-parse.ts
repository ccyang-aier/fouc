import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-import-sql-parse.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-import-sql-parse.sqlTableAndColumnNamesMustBeIdentifiers':
    'sqlTableAndColumnNamesMustBeIdentifiers',
  'table-import-sql-parse.sqlIdentifiersSupportAtMostCharactersAndMust':
    'sqlIdentifiersSupportAtMostCharactersAndMust',
  'table-import-sql-parse.signsApplyOnlyToNumericLiterals': 'signsApplyOnlyToNumericLiterals',
  'table-import-sql-parse.datetimeLiteralsMustImmediatelyPrecedeAStringTime':
    'datetimeLiteralsMustImmediatelyPrecedeAStringTime',
  'table-import-sql-parse.onlyNumberStringNullBooleanAndDatetimeLiterals':
    'onlyNumberStringNullBooleanAndDatetimeLiterals',
  'table-import-sql-parse.chooseMysqlPostgresqlOrSqliteAsTheSource':
    'chooseMysqlPostgresqlOrSqliteAsTheSource',
  'table-import-sql-parse.sqlUsesExplicitColumnListsTheHeaderRecord':
    'sqlUsesExplicitColumnListsTheHeaderRecord',
  'table-import-sql-parse.invalidSqlDataRecordRange': 'invalidSqlDataRecordRange',
  'table-import-sql-parse.sqlStringsAndNullRetainTheirOriginalSemantics':
    'sqlStringsAndNullRetainTheirOriginalSemantics',
  'table-import-sql-parse.sqlInputMustNotExceedMib': 'sqlInputMustNotExceedMib',
  'table-import-sql-parse.sqlInputMustNotExceedMibOfUtf': 'sqlInputMustNotExceedMibOfUtf',
  'table-import-sql-parse.oneSqlImportFileMustContainOnlyOne': 'oneSqlImportFileMustContainOnlyOne',
  'table-import-sql-parse.duplicateSqlColumn': 'duplicateSqlColumn',
  'table-import-sql-parse.sqlImportsSupportAtMostColumns': 'sqlImportsSupportAtMostColumns',
  'table-import-sql-parse.everyInsertMustProvideTheSameExplicitColumn':
    'everyInsertMustProvideTheSameExplicitColumn',
  'table-import-sql-parse.valuesHasMoreValuesThanTheExplicitColumn':
    'valuesHasMoreValuesThanTheExplicitColumn',
  'table-import-sql-parse.valuesCountDoesNotMatchTheExplicitColumn':
    'valuesCountDoesNotMatchTheExplicitColumn',
  'table-import-sql-parse.theCompleteSqlInputSupportsAtMostValue':
    'theCompleteSqlInputSupportsAtMostValue',
  'table-import-sql-parse.theSelectedSqlScopeSupportsAtMostRows':
    'theSelectedSqlScopeSupportsAtMostRows',
  'table-import-sql-parse.theSelectedSqlScopeSupportsAtMostCells':
    'theSelectedSqlScopeSupportsAtMostCells',
  'table-import-sql-parse.noImportableInsertLiteralRecordsInTheSelected':
    'noImportableInsertLiteralRecordsInTheSelected',
  'table-import-sql-parse.sourceSqlIsParsedOnlyAsDataIt': 'sourceSqlIsParsedOnlyAsDataIt',
  'table-import-sql-parse.sourceStringsUseTheSpecifiedDialectMysqlUses':
    'sourceStringsUseTheSpecifiedDialectMysqlUses',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
