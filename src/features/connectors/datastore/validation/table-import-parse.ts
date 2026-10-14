import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-import-parse.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-import-parse.tooManyIssues': 'tooManyIssues',
  'table-import-parse.invalidJsonStringEscape': 'invalidJsonStringEscape',
  'table-import-parse.jsonStringContainsAnUnescapedControlCharacter':
    'jsonStringContainsAnUnescapedControlCharacter',
  'table-import-parse.jsonStringIsNotClosed': 'jsonStringIsNotClosed',
  'table-import-parse.jsonStructureExceedsTheCurrentImportLimitOf':
    'jsonStructureExceedsTheCurrentImportLimitOf',
  'table-import-parse.jsonSupportsAtMostNestingLevels': 'jsonSupportsAtMostNestingLevels',
  'table-import-parse.jsonObjectFieldNamesRequireDoubleQuotes':
    'jsonObjectFieldNamesRequireDoubleQuotes',
  'table-import-parse.sourceFieldNamesSupportAtMostCharactersAnd':
    'sourceFieldNamesSupportAtMostCharactersAnd',
  'table-import-parse.missingColonAfterJsonFieldName': 'missingColonAfterJsonFieldName',
  'table-import-parse.duplicateJsonFieldName': 'duplicateJsonFieldName',
  'table-import-parse.importsSupportAtMostColumns': 'importsSupportAtMostColumns',
  'table-import-parse.missingCommaBetweenJsonElements': 'missingCommaBetweenJsonElements',
  'table-import-parse.jsonDoesNotAllowTrailingCommas': 'jsonDoesNotAllowTrailingCommas',
  'table-import-parse.invalidJsonValue': 'invalidJsonValue',
  'table-import-parse.extraContentAfterTheJsonValue': 'extraContentAfterTheJsonValue',
  'table-import-parse.invalidImportFormat': 'invalidImportFormat',
  'table-import-parse.theHeaderRowMustPrecedeTheFirstData': 'theHeaderRowMustPrecedeTheFirstData',
  'table-import-parse.jsonDataUsesItsOwnFieldNamesThe': 'jsonDataUsesItsOwnFieldNamesThe',
  'table-import-parse.invalidParsingOptions': 'invalidParsingOptions',
  'table-import-parse.invalidJsonRowStructure': 'invalidJsonRowStructure',
  'table-import-parse.nullMarkersSupportAtMostCharacters': 'nullMarkersSupportAtMostCharacters',
  'table-import-parse.theDelimiterMustBeOneCharacterAndCannot':
    'theDelimiterMustBeOneCharacterAndCannot',
  'table-import-parse.importContentMustNotExceedMib': 'importContentMustNotExceedMib',
  'table-import-parse.importContentMustNotExceedMibOfUtf': 'importContentMustNotExceedMibOfUtf',
  'table-import-parse.importsSupportAtMostRowsReduceTheData':
    'importsSupportAtMostRowsReduceTheData',
  'table-import-parse.importsSupportAtMostColumnsAndCells': 'importsSupportAtMostColumnsAndCells',
  'table-import-parse.jsonImportsRequireAnArrayOfObjectRows':
    'jsonImportsRequireAnArrayOfObjectRows',
  'table-import-parse.eachJsonRowMustBeAnObjectOr': 'eachJsonRowMustBeAnObjectOr',
  'table-import-parse.jsonRowsDoNotMatchTheSelectedStructure':
    'jsonRowsDoNotMatchTheSelectedStructure',
  'table-import-parse.jsonObjectRowsAndArrayRowsCannotBe': 'jsonObjectRowsAndArrayRowsCannotBe',
  'table-import-parse.quotedFieldIsNotClosed': 'quotedFieldIsNotClosed',
  'table-import-parse.onlyADelimiterOrNewlineMayFollowA': 'onlyADelimiterOrNewlineMayFollowA',
  'table-import-parse.anUnquotedFieldContainsADoubleQuote': 'anUnquotedFieldContainsADoubleQuote',
  'table-import-parse.thisRecordHasColumnsTheHeaderDefinesColumns':
    'thisRecordHasColumnsTheHeaderDefinesColumns',
  'table-import-parse.noColumnsInTheSelectedScope': 'noColumnsInTheSelectedScope',
  'table-import-parse.noDataRowsInTheSelectedScope': 'noDataRowsInTheSelectedScope',
  'table-import-parse.someFieldsAreMissingImportsOmitThoseFields':
    'someFieldsAreMissingImportsOmitThoseFields',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
