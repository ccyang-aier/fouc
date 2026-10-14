import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './database-docs-validation.messages';
import { localizedValidationValues } from './values';
const keys = {
  'database-docs-validation.databaseDocumentationParametersMustBeAnObject':
    'databaseDocumentationParametersMustBeAnObject',
  'database-docs-validation.databaseDocumentationParametersContainUnknownFields':
    'databaseDocumentationParametersContainUnknownFields',
  'database-docs-validation.name': 'name',
  'database-docs-validation.invalid': 'invalid',
  'database-docs-validation.markdownNotesMustNotExceedKibOrContain':
    'markdownNotesMustNotExceedKibOrContain',
  'database-docs-validation.invalidDatabaseDocumentationNoteFormat':
    'invalidDatabaseDocumentationNoteFormat',
  'database-docs-validation.databaseDocumentationGroupTableNoteCountExceedsThe':
    'databaseDocumentationGroupTableNoteCountExceedsThe',
  'database-docs-validation.groupId': 'groupId',
  'database-docs-validation.invalidOrDuplicateGroupId': 'invalidOrDuplicateGroupId',
  'database-docs-validation.groupHueMustBe': 'groupHueMustBe',
  'database-docs-validation.groupName': 'groupName',
  'database-docs-validation.table': 'table',
  'database-docs-validation.duplicateTableNoteTarget': 'duplicateTableNoteTarget',
  'database-docs-validation.theTableReferencesAGroupThatDoesNot':
    'theTableReferencesAGroupThatDoesNot',
  'database-docs-validation.invalidColumnNotes': 'invalidColumnNotes',
  'database-docs-validation.column': 'column',
  'database-docs-validation.columnNotesSupportAtMostEntries': 'columnNotesSupportAtMostEntries',
  'database-docs-validation.documentTitle': 'documentTitle',
  'database-docs-validation.localDocumentationNotesMustNotExceedMib':
    'localDocumentationNotesMustNotExceedMib',
  'database-docs-validation.noteVersion': 'noteVersion',
  'database-docs-validation.chooseSchemas': 'chooseSchemas',
  'database-docs-validation.selectedTableCountExceedsTheLimit': 'selectedTableCountExceedsTheLimit',
  'database-docs-validation.theTableIsOutsideTheSelectedSchemaScope':
    'theTableIsOutsideTheSelectedSchemaScope',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
