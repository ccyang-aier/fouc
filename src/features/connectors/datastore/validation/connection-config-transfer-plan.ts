import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './connection-config-transfer-plan.messages';
import { localizedValidationValues } from './values';
const keys = {
  'connection-config-transfer-plan.tooManyConnectionsHaveTheSameNameEnter':
    'tooManyConnectionsHaveTheSameNameEnter',
  'connection-config-transfer-plan.importSelectionDoesNotMatchTheValidatedConfiguration':
    'importSelectionDoesNotMatchTheValidatedConfiguration',
  'connection-config-transfer-plan.itemHasAnInvalidUpdateTargetOrIts':
    'itemHasAnInvalidUpdateTargetOrIts',
  'connection-config-transfer-plan.oneExistingConnectionCannotBeUpdatedRepeatedlyIn':
    'oneExistingConnectionCannotBeUpdatedRepeatedlyIn',
  'connection-config-transfer-plan.itemHasAnInvalidImportName': 'itemHasAnInvalidImportName',
  'connection-config-transfer-plan.connectionStillHasANameConflictSkipIt':
    'connectionStillHasANameConflictSkipIt',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
