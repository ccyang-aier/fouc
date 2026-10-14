import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-create-validation.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-create-validation.columnValidation': 'columnValidation',
  'table-create-validation.namesMustNotBeEmptyOrContainSurrounding':
    'namesMustNotBeEmptyOrContainSurrounding',
  'table-create-validation.mysqlNamesSupportAtMostBmpCharacters':
    'mysqlNamesSupportAtMostBmpCharacters',
  'table-create-validation.mysqlDatabaseTableNamesMustNotContainDots':
    'mysqlDatabaseTableNamesMustNotContainDots',
  'table-create-validation.tablesCannotBeCreatedInMysqlSystemDatabases':
    'tablesCannotBeCreatedInMysqlSystemDatabases',
  'table-create-validation.postgresqlNamesSupportAtMostUtfBytes':
    'postgresqlNamesSupportAtMostUtfBytes',
  'table-create-validation.tablesCannotBeCreatedInPostgresqlSystemSchemas':
    'tablesCannotBeCreatedInPostgresqlSystemSchemas',
  'table-create-validation.thisNameIsAPostgresqlSystemColumn': 'thisNameIsAPostgresqlSystemColumn',
  'table-create-validation.sqliteSupportsOnlyTheCurrentMainDatabase':
    'sqliteSupportsOnlyTheCurrentMainDatabase',
  'table-create-validation.sqliteIsAReservedSqliteObjectPrefix':
    'sqliteIsAReservedSqliteObjectPrefix',
  'table-create-validation.thisDesignerLimitsSqliteNamesToUtfBytes':
    'thisDesignerLimitsSqliteNamesToUtfBytes',
  'table-create-validation.defaultValuesMustNotContainNulOrInvalid':
    'defaultValuesMustNotContainNulOrInvalid',
  'table-create-validation.integerDefaultsMustBeDecimalIntegerLiterals':
    'integerDefaultsMustBeDecimalIntegerLiterals',
  'table-create-validation.theDefaultExceedsTheNativeSignedIntegerRange':
    'theDefaultExceedsTheNativeSignedIntegerRange',
  'table-create-validation.exactNumericDefaultsMustBeBoundedDecimalLiterals':
    'exactNumericDefaultsMustBeBoundedDecimalLiterals',
  'table-create-validation.theDefaultExceedsColumnPrecisionOrScaleSilent':
    'theDefaultExceedsColumnPrecisionOrScaleSilent',
  'table-create-validation.floatingPointDefaultsMustBeFiniteNumericLiterals':
    'floatingPointDefaultsMustBeFiniteNumericLiterals',
  'table-create-validation.booleanDefaultsAcceptOnlyTrueOrFalse':
    'booleanDefaultsAcceptOnlyTrueOrFalse',
  'table-create-validation.binaryDefaultsUseAnEvenNumberOfHexadecimal':
    'binaryDefaultsUseAnEvenNumberOfHexadecimal',
  'table-create-validation.theCurrentMysqlDesignerDoesNotSetBlob':
    'theCurrentMysqlDesignerDoesNotSetBlob',
  'table-create-validation.theCurrentMysqlDesignerDoesNotSetJson':
    'theCurrentMysqlDesignerDoesNotSetJson',
  'table-create-validation.theJsonDefaultIsNotValidJson': 'theJsonDefaultIsNotValidJson',
  'table-create-validation.invalidUuidDefaultFormat': 'invalidUuidDefaultFormat',
  'table-create-validation.theCurrentMysqlDesignerDoesNotSetText':
    'theCurrentMysqlDesignerDoesNotSetText',
  'table-create-validation.defaultTextExceedsTheColumnLength': 'defaultTextExceedsTheColumnLength',
  'table-create-validation.timestampDefaultsRequireACompleteUtcTimeEnding':
    'timestampDefaultsRequireACompleteUtcTimeEnding',
  'table-create-validation.mysqlTimestampDefaultsUseThePortableRange':
    'mysqlTimestampDefaultsUseThePortableRange',
  'table-create-validation.invalidTableCreationParametersNamesColumnsTypeParameters':
    'invalidTableCreationParametersNamesColumnsTypeParameters',
  'table-create-validation.mysqlSqliteSupportOnlyOneAutoIncrementColumn':
    'mysqlSqliteSupportOnlyOneAutoIncrementColumn',
  'table-create-validation.duplicateColumnIdOrName': 'duplicateColumnIdOrName',
  'table-create-validation.thisTypeIsOutsideTheCurrentDriverS':
    'thisTypeIsOutsideTheCurrentDriverS',
  'table-create-validation.invalidLengthParameter': 'invalidLengthParameter',
  'table-create-validation.invalidNumericPrecisionScale': 'invalidNumericPrecisionScale',
  'table-create-validation.thisTypeDoesNotSupportLengthOrPrecision':
    'thisTypeDoesNotSupportLengthOrPrecision',
  'table-create-validation.primaryKeyColumnsMustBeNotNull': 'primaryKeyColumnsMustBeNotNull',
  'table-create-validation.autoIncrementIdentityRequiresANonNullInteger':
    'autoIncrementIdentityRequiresANonNullInteger',
  'table-create-validation.postgresqlUsesByDefaultAlwaysIdentity':
    'postgresqlUsesByDefaultAlwaysIdentity',
  'table-create-validation.thisDriverAcceptsOnlyAutoAutoIncrement':
    'thisDriverAcceptsOnlyAutoAutoIncrement',
  'table-create-validation.aMysqlAutoIncrementColumnMustBeThe':
    'aMysqlAutoIncrementColumnMustBeThe',
  'table-create-validation.sqliteAutoincrementSupportsOnlyASingleIntegerPrimary':
    'sqliteAutoincrementSupportsOnlyASingleIntegerPrimary',
  'table-create-validation.nonNullColumnsCannotDefaultToNull': 'nonNullColumnsCannotDefaultToNull',
  'table-create-validation.thisTypeDoesNotAcceptTheSelectedDefault':
    'thisTypeDoesNotAcceptTheSelectedDefault',
  'table-create-validation.mysqlTextBlobJsonDoNotSupportThis': 'mysqlTextBlobJsonDoNotSupportThis',
  'table-create-validation.untitledColumn': 'untitledColumn',
  'table-create-validation.tableDesignExceedsTheKibLimit': 'tableDesignExceedsTheKibLimit',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
