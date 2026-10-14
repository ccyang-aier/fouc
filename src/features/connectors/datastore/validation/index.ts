import { isValidationIssue, type ValidationIssue } from '@fouc/shared';
import type { Locale } from '@/lib/i18n';
import { translateIssue as translateSqlSnippetsIssue } from './sql-snippets';
import { translateIssue as translateSqlEditorPreferencesIssue } from './sql-editor-preferences';
import { translateIssue as translateDatabaseExportInputIssue } from './database-export-input';
import { translateIssue as translateIndexEditValidationIssue } from './index-edit-validation';
import { translateIssue as translateTableCreateValidationIssue } from './table-create-validation';
import { translateIssue as translateTableTransferTypesIssue } from './table-transfer-types';
import { translateIssue as translateTableImportEncodingIssue } from './table-import-encoding';
import { translateIssue as translateTableImportParseIssue } from './table-import-parse';
import { translateIssue as translateTableImportSqlParseIssue } from './table-import-sql-parse';
import { translateIssue as translateTableImportSqlLexerIssue } from './table-import-sql-lexer';
import { translateIssue as translateTableImportMappingIssue } from './table-import-mapping';
import { translateIssue as translateTestDataValidationIssue } from './test-data-validation';
import { translateIssue as translateTestDataModelIssue } from './test-data-model';
import { translateIssue as translateTestDataGenerateIssue } from './test-data-generate';
import { translateIssue as translateTestDataRandomIssue } from './test-data-random';
import { translateIssue as translateRelationalStructureEditValidationIssue } from './relational-structure-edit-validation';
import { translateIssue as translateConnectionOptionsUrlIssue } from './connection-options-url';
import { translateIssue as translateConnectionConfigTransferIssue } from './connection-config-transfer';
import { translateIssue as translateConnectionConfigTransferCryptoIssue } from './connection-config-transfer-crypto';
import { translateIssue as translateConnectionConfigTransferPlanIssue } from './connection-config-transfer-plan';
import { translateIssue as translateDatabaseDocsValidationIssue } from './database-docs-validation';
import { translateIssue as translateDatabaseDocsExportIssue } from './database-docs-export';
import { translateIssue as translateDatabaseExportValuesIssue } from './database-export-values';

const translators = [
  translateSqlSnippetsIssue,
  translateSqlEditorPreferencesIssue,
  translateDatabaseExportInputIssue,
  translateIndexEditValidationIssue,
  translateTableCreateValidationIssue,
  translateTableTransferTypesIssue,
  translateTableImportEncodingIssue,
  translateTableImportParseIssue,
  translateTableImportSqlParseIssue,
  translateTableImportSqlLexerIssue,
  translateTableImportMappingIssue,
  translateTestDataValidationIssue,
  translateTestDataModelIssue,
  translateTestDataGenerateIssue,
  translateTestDataRandomIssue,
  translateRelationalStructureEditValidationIssue,
  translateConnectionOptionsUrlIssue,
  translateConnectionConfigTransferIssue,
  translateConnectionConfigTransferCryptoIssue,
  translateConnectionConfigTransferPlanIssue,
  translateDatabaseDocsValidationIssue,
  translateDatabaseDocsExportIssue,
  translateDatabaseExportValuesIssue,
];

/** Stable domain codes choose explicit catalogs; user content is never translated. */
export function formatValidationIssue(issue: ValidationIssue, locale?: Locale): string {
  for (const translate of translators) {
    const message = translate(issue, locale);
    if (message !== null) return message;
  }
  return issue.message;
}

export function validationErrorText(error: unknown, locale?: Locale): string {
  if (isValidationIssue(error)) return formatValidationIssue(error, locale);
  if (error && typeof error === 'object' && 'issue' in error && isValidationIssue(error.issue)) {
    return formatValidationIssue(error.issue, locale);
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message;
  return error instanceof Error ? error.message : String(error);
}
