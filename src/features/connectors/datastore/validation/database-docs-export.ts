import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './database-docs-export.messages';
import { localizedValidationValues } from './values';
const keys = {
  'database-docs-export.theDefaultExpressionContainsBackticksThatDbmlCannot':
    'theDefaultExpressionContainsBackticksThatDbmlCannot',
  'database-docs-export.currentDbmlPreservesNativeTypeNamesEnumValues':
    'currentDbmlPreservesNativeTypeNamesEnumValues',
  'database-docs-export.dbmlCannotFullyExpressColumnCollationsCharacterSets':
    'dbmlCannotFullyExpressColumnCollationsCharacterSets',
  'database-docs-export.dbmlDoesNotFullySupportIndexExpressionsPredicates':
    'dbmlDoesNotFullySupportIndexExpressionsPredicates',
  'database-docs-export.nativeCheckExcludeConstraintsRemainInTheStructure':
    'nativeCheckExcludeConstraintsRemainInTheStructure',
  'database-docs-export.originalTriggerDefinitionsRemainInTheStructureDocument':
    'originalTriggerDefinitionsRemainInTheStructureDocument',
  'database-docs-export.dbmlDisplaysViewColumnsUsingTableNativeView':
    'dbmlDisplaysViewColumnsUsingTableNativeView',
  'database-docs-export.foreignKeyHasAnUnknownOrUnsupportedDbml':
    'foreignKeyHasAnUnknownOrUnsupportedDbml',
  'database-docs-export.unknown': 'unknown',
  'database-docs-export.nativeDatabaseComments': 'nativeDatabaseComments',
  'database-docs-export.deviceLocalMarkdownNotes': 'deviceLocalMarkdownNotes',
  'database-docs-export.databaseCollectedAt': 'databaseCollectedAt',
  'database-docs-export.metadataWarnings': 'metadataWarnings',
  'database-docs-export.group': 'group',
  'database-docs-export.color': 'color',
  'database-docs-export.nativeType': 'nativeType',
  'database-docs-export.columns': 'columns',
  'database-docs-export.columnNativeTypeNullablePrimaryKeyDefaultDatabase':
    'columnNativeTypeNullablePrimaryKeyDefaultDatabase',
  'database-docs-export.yes': 'yes',
  'database-docs-export.no': 'no',
  'database-docs-export.bidirectionalForeignKeyRelationships':
    'bidirectionalForeignKeyRelationships',
  'database-docs-export.targetUnconfirmed': 'targetUnconfirmed',
  'database-docs-export.noRelatedForeignKeysRecordedInTheNative':
    'noRelatedForeignKeysRecordedInTheNative',
  'database-docs-export.index': 'index',
  'database-docs-export.methodUniquePrimaryKey': 'methodUniquePrimaryKey',
  'database-docs-export.constraint': 'constraint',
  'database-docs-export.trigger': 'trigger',
  'database-docs-export.originalStructureDefinition': 'originalStructureDefinition',
  'database-docs-export.source': 'source',
  'database-docs-export.nativeProperties': 'nativeProperties',
  'database-docs-export.noteTargetsNotFoundInThisSnapshot': 'noteTargetsNotFoundInThisSnapshot',
  'database-docs-export.notePreservedDeletionIsNotInferred': 'notePreservedDeletionIsNotInferred',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
