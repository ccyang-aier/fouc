import { createTranslator, type Locale } from '@/lib/i18n';
import type { ValidationIssue } from '@fouc/shared';
import { messages } from './test-data-validation.messages';
import { localizedValidationValues } from './values';
const keys = {
  'test-data-validation.invalidSchemaValue': 'invalidSchemaValue',
  'test-data-validation.timeMustBe': 'timeMustBe',
  'test-data-validation.theDateMustBeAnActualCalendarDate': 'theDateMustBeAnActualCalendarDate',
  'test-data-validation.useAYyyyMmDdDateOrA': 'useAYyyyMmDdDateOrA',
  'test-data-validation.utcTimeIsOutsideTheValidRange': 'utcTimeIsOutsideTheValidRange',
  'test-data-validation.valueExceedsTheRange': 'valueExceedsTheRange',
  'test-data-validation.decimalPlacesExceedTheColumnSScaleOf':
    'decimalPlacesExceedTheColumnSScaleOf',
  'test-data-validation.valueExceedsTheColumnSDecimalPrecision':
    'valueExceedsTheColumnSDecimalPrecision',
  'test-data-validation.floatingPointValuesMustBeFinite': 'floatingPointValuesMustBeFinite',
  'test-data-validation.generatedNumbersSupportAtMostDigits': 'generatedNumbersSupportAtMostDigits',
  'test-data-validation.integerColumnsMustHaveZeroDecimalPlaces':
    'integerColumnsMustHaveZeroDecimalPlaces',
  'test-data-validation.numericGeneratorsApplyOnlyToNumericColumns':
    'numericGeneratorsApplyOnlyToNumericColumns',
  'test-data-validation.textGeneratorsApplyOnlyToTextUuidColumns':
    'textGeneratorsApplyOnlyToTextUuidColumns',
  'test-data-validation.chooseUuidOrAValidFixedValueFor': 'chooseUuidOrAValidFixedValueFor',
  'test-data-validation.theTemporalGeneratorMustMatchTheColumnS':
    'theTemporalGeneratorMustMatchTheColumnS',
  'test-data-validation.sequenceIncrementsForUniqueColumnsMustNotBe':
    'sequenceIncrementsForUniqueColumnsMustNotBe',
  'test-data-validation.theMinimumMustNotExceedTheMaximum': 'theMinimumMustNotExceedTheMaximum',
  'test-data-validation.theNumericRangeCannotHoldAFullBatch': 'theNumericRangeCannotHoldAFullBatch',
  'test-data-validation.startTimeMustNotBeAfterTheEnd': 'startTimeMustNotBeAfterTheEnd',
  'test-data-validation.theDateTimeRangeCannotHoldAFull': 'theDateTimeRangeCannotHoldAFull',
  'test-data-validation.mysqlTimestampUsesThePortableRange': 'mysqlTimestampUsesThePortableRange',
  'test-data-validation.enterAValidEmailDomainSuchAsExample': 'enterAValidEmailDomainSuchAsExample',
  'test-data-validation.fixedValueEnumCandidatesAreInsufficientForA':
    'fixedValueEnumCandidatesAreInsufficientForA',
  'test-data-validation.booleanCandidatesMustBeTrueFalse': 'booleanCandidatesMustBeTrueFalse',
  'test-data-validation.enterAValidUuid': 'enterAValidUuid',
  'test-data-validation.theCandidateIsNotANativeDatabaseEnum':
    'theCandidateIsNotANativeDatabaseEnum',
  'test-data-validation.fixedValueEnumExceedsTheColumnCharacterLength':
    'fixedValueEnumExceedsTheColumnCharacterLength',
  'test-data-validation.generatedValueExceedsTheColumnSMaximumOf':
    'generatedValueExceedsTheColumnSMaximumOf',
  'test-data-validation.uniquenessIsCheckedOnlyWithinThisGeneratedBatch':
    'uniquenessIsCheckedOnlyWithinThisGeneratedBatch',
  'test-data-validation.thisStageSupportsAppendGenerationOnlyForActual':
    'thisStageSupportsAppendGenerationOnlyForActual',
  'test-data-validation.columnConfigurationMustCorrespondOneToOneWith':
    'columnConfigurationMustCorrespondOneToOneWith',
  'test-data-validation.columnDoesNotExistOrIsDuplicated': 'columnDoesNotExistOrIsDuplicated',
  'test-data-validation.nonNullColumnsCannotGenerateNull': 'nonNullColumnsCannotGenerateNull',
  'test-data-validation.nativeUniqueColumnsMustKeepUniquenessChecksEnabled':
    'nativeUniqueColumnsMustKeepUniquenessChecksEnabled',
  'test-data-validation.aBatchSupportsAtMostGeneratedCellsReduce':
    'aBatchSupportsAtMostGeneratedCellsReduce',
  'test-data-validation.foreignKeyColumnsDoNotGenerateRandomReferences':
    'foreignKeyColumnsDoNotGenerateRandomReferences',
  'test-data-validation.theTableHasNativeTriggersCommittingMayCause':
    'theTableHasNativeTriggersCommittingMayCause',
  'test-data-validation.nullSemanticsForUniqueColumnsAreDeterminedBy':
    'nullSemanticsForUniqueColumnsAreDeterminedBy',
  'test-data-validation.timesAreGeneratedInUtcColumnsWithoutTime':
    'timesAreGeneratedInUtcColumnsWithoutTime',
  'test-data-validation.nativeFloatingPointColumnsStoreValuesUsingDatabase':
    'nativeFloatingPointColumnsStoreValuesUsingDatabase',
  'test-data-validation.sqliteNumericRealAffinityMayConvertAndRound':
    'sqliteNumericRealAffinityMayConvertAndRound',
} satisfies Record<string, keyof typeof messages>;
export function translateIssue(issue: ValidationIssue, locale?: Locale) {
  const key = Object.hasOwn(keys, issue.code) ? keys[issue.code as keyof typeof keys] : undefined;
  return key
    ? createTranslator(messages, locale)(key, localizedValidationValues(issue.values, locale))
    : null;
}
