import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './index-edit-validation.messages';
import { localizedValidationValues } from './values';
const keys = {
  'index-edit-validation.invalidIndexParametersOnlyActualColumnsSortingAnd':
    'invalidIndexParametersOnlyActualColumnsSortingAnd',
  'index-edit-validation.thisIndexNameIsReservedByTheDatabase':
    'thisIndexNameIsReservedByTheDatabase',
  'index-edit-validation.thePrimaryKeyIndexIsManagedByThe': 'thePrimaryKeyIndexIsManagedByThe',
  'index-edit-validation.thisIndexIsManagedByANativeConstraint':
    'thisIndexIsManagedByANativeConstraint',
  'index-edit-validation.thisIndexSLeadingColumnsSupportForeignKeys':
    'thisIndexSLeadingColumnsSupportForeignKeys',
  'index-edit-validation.theIndexTargetMustBeTheNativeTable': 'theIndexTargetMustBeTheNativeTable',
  'index-edit-validation.theCurrentRoleCannotManageIndexesOnThis':
    'theCurrentRoleCannotManageIndexesOnThis',
  'index-edit-validation.targetIndexDoesNotExistRefreshTheStructure':
    'targetIndexDoesNotExistRefreshTheStructure',
  'index-edit-validation.theCurrentTableAlreadyHasAnIndexWith':
    'theCurrentTableAlreadyHasAnIndexWith',
  'index-edit-validation.indexColumnsMustExistAndMustNotRepeat':
    'indexColumnsMustExistAndMustNotRepeat',
  'index-edit-validation.theCurrentNativeVersionOrEngineDoesNot':
    'theCurrentNativeVersionOrEngineDoesNot',
  'index-edit-validation.prefixesApplyOnlyToCharacterOrBinaryColumns':
    'prefixesApplyOnlyToCharacterOrBinaryColumns',
  'index-edit-validation.prefixLengthMustNotExceedColumnLength':
    'prefixLengthMustNotExceedColumnLength',
  'index-edit-validation.jsonSpatialColumnsRequireDedicatedIndexDesignExpression':
    'jsonSpatialColumnsRequireDedicatedIndexDesignExpression',
  'index-edit-validation.mysqlTextBlobIndexesRequireAnExplicitPrefix':
    'mysqlTextBlobIndexesRequireAnExplicitPrefix',
  'index-edit-validation.theCurrentNativeVersionDoesNotSupportInclude':
    'theCurrentNativeVersionDoesNotSupportInclude',
  'index-edit-validation.includedColumnsMustExistAndMustNotDuplicate':
    'includedColumnsMustExistAndMustNotDuplicate',
  'index-edit-validation.nullsNotDistinctAppliesOnlyToPostgresqlUnique':
    'nullsNotDistinctAppliesOnlyToPostgresqlUnique',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
