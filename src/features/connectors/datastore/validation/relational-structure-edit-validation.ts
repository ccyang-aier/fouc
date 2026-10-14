import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './relational-structure-edit-validation.messages';
import { localizedValidationValues } from './values';
const keys = {
  'relational-structure-edit-validation.namesMustNotBeEmptyOrContainControl':
    'namesMustNotBeEmptyOrContainControl',
  'relational-structure-edit-validation.postgresqlNamesMustNotExceedUtfBytes':
    'postgresqlNamesMustNotExceedUtfBytes',
  'relational-structure-edit-validation.mysqlNamesMustNotExceedCharacters':
    'mysqlNamesMustNotExceedCharacters',
  'relational-structure-edit-validation.sqliteIsAReservedSqliteObjectPrefix':
    'sqliteIsAReservedSqliteObjectPrefix',
  'relational-structure-edit-validation.typesMustNotBeEmptyOrExceedCharacters':
    'typesMustNotBeEmptyOrExceedCharacters',
  'relational-structure-edit-validation.enumSetAcceptOnlySingleQuotedTextMembers':
    'enumSetAcceptOnlySingleQuotedTextMembers',
  'relational-structure-edit-validation.invalidTypeFormatTypeInputMustNotContain':
    'invalidTypeFormatTypeInputMustNotContain',
  'relational-structure-edit-validation.editingTypeIsNotSupportedYetTheExisting':
    'editingTypeIsNotSupportedYetTheExisting',
  'relational-structure-edit-validation.unsignedSupportsOnlyMysqlNumericTypes':
    'unsignedSupportsOnlyMysqlNumericTypes',
  'relational-structure-edit-validation.arrayTypesSupportOnlyPostgresql':
    'arrayTypesSupportOnlyPostgresql',
  'relational-structure-edit-validation.strictTablesAcceptOnlyIntegerIntRealText':
    'strictTablesAcceptOnlyIntegerIntRealText',
  'relational-structure-edit-validation.sqliteTypesDoNotAcceptLengthParameters':
    'sqliteTypesDoNotAcceptLengthParameters',
  'relational-structure-edit-validation.typeParametersAreOutOfRange': 'typeParametersAreOutOfRange',
  'relational-structure-edit-validation.precisionOrScaleExceedsTheNativeDatabaseRange':
    'precisionOrScaleExceedsTheNativeDatabaseRange',
  'relational-structure-edit-validation.lengthParameterIsOutOfRange': 'lengthParameterIsOutOfRange',
  'relational-structure-edit-validation.requiresAnExplicitLength': 'requiresAnExplicitLength',
  'relational-structure-edit-validation.mysqlCharacterOrBinaryLengthIsOutOf':
    'mysqlCharacterOrBinaryLengthIsOutOf',
  'relational-structure-edit-validation.timePrecisionMustBe': 'timePrecisionMustBe',
  'relational-structure-edit-validation.doesNotAcceptTheseTypeParameters':
    'doesNotAcceptTheseTypeParameters',
  'relational-structure-edit-validation.expressionsMustNotBeEmptyOrExceedCharacters':
    'expressionsMustNotBeEmptyOrExceedCharacters',
  'relational-structure-edit-validation.expressionsMustNotContainCommentsParametersUnclosedQuotes':
    'expressionsMustNotContainCommentsParametersUnclosedQuotes',
  'relational-structure-edit-validation.expressionParenthesesDoNotMatch':
    'expressionParenthesesDoNotMatch',
  'relational-structure-edit-validation.expressionsDoNotAcceptCrossObjectOrFunction':
    'expressionsDoNotAcceptCrossObjectOrFunction',
  'relational-structure-edit-validation.expressionFunctionIsOutsideTheLocalEditorS':
    'expressionFunctionIsOutsideTheLocalEditorS',
  'relational-structure-edit-validation.generatedColumnsIndexPredicatesDoNotAcceptNon':
    'generatedColumnsIndexPredicatesDoNotAcceptNon',
  'relational-structure-edit-validation.generatedColumnsDoNotAcceptNonDeterministicTime':
    'generatedColumnsDoNotAcceptNonDeterministicTime',
  'relational-structure-edit-validation.theExpressionReferencesAProhibitedColumnOrKeyword':
    'theExpressionReferencesAProhibitedColumnOrKeyword',
  'relational-structure-edit-validation.postgresqlTextMustNotContainNul':
    'postgresqlTextMustNotContainNul',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
