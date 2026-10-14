import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './table-transfer-types.messages';
import { localizedValidationValues } from './values';
const keys = {
  'table-transfer-types.explicitTextBinaryEncodingAppliesOnlyToTarget':
    'explicitTextBinaryEncodingAppliesOnlyToTarget',
  'table-transfer-types.binaryEncodingRequiresABinarySourceColumn':
    'binaryEncodingRequiresABinarySourceColumn',
  'table-transfer-types.mappingBinaryToTextRequiresAnExplicitHex':
    'mappingBinaryToTextRequiresAnExplicitHex',
  'table-transfer-types.binaryMapsDirectlyOnlyToBinaryColumnsChoose':
    'binaryMapsDirectlyOnlyToBinaryColumnsChoose',
  'table-transfer-types.arraysMapDirectlyOnlyToSameTypePostgresql':
    'arraysMapDirectlyOnlyToSameTypePostgresql',
  'table-transfer-types.timesWithAndWithoutTimeZonesCannotConvert':
    'timesWithAndWithoutTimeZonesCannotConvert',
  'table-transfer-types.thisNativeTypeHasNoPreciseCrossDatabase':
    'thisNativeTypeHasNoPreciseCrossDatabase',
  'table-transfer-types.sqliteNumericCannotGuaranteeArbitraryDecimalPrecisionMap':
    'sqliteNumericCannotGuaranteeArbitraryDecimalPrecisionMap',
  'table-transfer-types.jsonAcceptsOnlyNativeJsonOrValidJson':
    'jsonAcceptsOnlyNativeJsonOrValidJson',
  'table-transfer-types.jsonCannotConvertImplicitlyToNonJsonNon':
    'jsonCannotConvertImplicitlyToNonJsonNon',
  'table-transfer-types.theTargetNumericColumnDoesNotAcceptThis':
    'theTargetNumericColumnDoesNotAcceptThis',
  'table-transfer-types.incompatibleDateTimeTypesTimesOrTimeZones':
    'incompatibleDateTimeTypesTimesOrTimeZones',
  'table-transfer-types.incompatibleColumnTypes': 'incompatibleColumnTypes',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
