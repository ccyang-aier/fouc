import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './generator-options.messages';
import type { DatabaseColumnInfo } from '@fouc/shared';
import { defaultTestDataGenerator, type TestDataGenerator } from '@fouc/shared/test-data';
import styles from './test-data.module.css';
export const TEST_DATA_GENERATOR_LABELS = (
  locale?: Locale,
): Record<TestDataGenerator['kind'], string> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return {
    constant: tConnector('fixedValue'),
    sequence: tConnector('exactSequence'),
    integer: tConnector('randomInteger'),
    decimal: tConnector('exactDecimal'),
    date: tConnector('date'),
    datetime: tConnector('dateAndTime'),
    time: tConnector('time'),
    uuid: 'UUID v4',
    name: tConnector('chineseNames'),
    email: tConnector('email'),
    text: tConnector('randomText'),
    enum: tConnector('enumCandidates'),
  };
};
export function initialGenerator(
  kind: TestDataGenerator['kind'],
  column: DatabaseColumnInfo,
  locale?: Locale,
): TestDataGenerator {
  const tConnector = createTranslator(connectorMessages, locale);
  const native = defaultTestDataGenerator(column);
  if (native.kind === kind) return native;
  switch (kind) {
    case 'constant':
      return { kind, value: column.enumValues?.[0] ?? '' };
    case 'sequence':
      return { kind, start: '1', step: '1' };
    case 'integer':
      return { kind, min: '1', max: '1000' };
    case 'decimal':
      return { kind, min: '0', max: '100', scale: column.numericScale ?? 2 };
    case 'date':
    case 'datetime':
      return { kind, start: '2025-01-01', end: '2025-12-31' };
    case 'time':
      return { kind, start: '09:00:00', end: '18:00:00' };
    case 'email':
      return { kind, domain: 'example.test' };
    case 'text':
      return { kind, length: Math.min(column.characterMaximumLength ?? 24, 24) };
    case 'enum':
      return {
        kind,
        values: column.enumValues?.length
          ? [...column.enumValues]
          : [tConnector('optionA'), tConnector('optionB')],
      };
    default:
      return { kind };
  }
}
export function GeneratorOptions({
  generator,
  onChange,
}: {
  generator: TestDataGenerator;
  onChange: (value: TestDataGenerator) => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const kind = generator.kind;
  return (
    <div className={styles.parameters}>
      {kind === 'constant' && (
        <label>
          {tConnector('fixedContent')}
          <textarea
            aria-label={tConnector('generateFixedContent')}
            value={generator.value}
            maxLength={4096}
            onChange={(event) => onChange({ ...generator, value: event.target.value })}
          />
          <small>{tConnector('emptyContentRepresentsAnEmptyStringUseTheColumnS')}</small>
        </label>
      )}
      {kind === 'sequence' && (
        <>
          <label>
            {tConnector('startValue')}
            <input
              aria-label={tConnector('sequenceStart')}
              value={generator.start}
              onChange={(event) => onChange({ ...generator, start: event.target.value })}
            />
          </label>
          <label>
            {tConnector('increment')}
            <input
              aria-label={tConnector('sequenceIncrement')}
              value={generator.step}
              onChange={(event) => onChange({ ...generator, step: event.target.value })}
            />
          </label>
          <small>{tConnector('incrementsByTheFullRowIndexUsingIntegerScalingTo')}</small>
        </>
      )}
      {(kind === 'integer' || kind === 'decimal') && (
        <>
          <label>
            {tConnector('minimum')}
            <input
              aria-label={tConnector('generationMinimum')}
              value={generator.min}
              onChange={(event) => onChange({ ...generator, min: event.target.value })}
            />
          </label>
          <label>
            {tConnector('maximum')}
            <input
              aria-label={tConnector('generationMaximum')}
              value={generator.max}
              onChange={(event) => onChange({ ...generator, max: event.target.value })}
            />
          </label>
          {kind === 'decimal' && (
            <label>
              {tConnector('decimalPlaces')}
              <input
                aria-label={tConnector('generationDecimalPlaces')}
                type="number"
                min={0}
                max={100}
                value={generator.scale}
                onChange={(event) => onChange({ ...generator, scale: Number(event.target.value) })}
              />
            </label>
          )}
          <small>{tConnector('theRangeIncludesBothEndpointsNumbersUseOriginalDecimalText')}</small>
        </>
      )}
      {(kind === 'date' || kind === 'datetime' || kind === 'time') && (
        <>
          <label>
            {tConnector('start')}
            <input
              aria-label={tConnector('generationStartTime')}
              value={generator.start}
              onChange={(event) => onChange({ ...generator, start: event.target.value })}
            />
          </label>
          <label>
            {tConnector('end')}
            <input
              aria-label={tConnector('generationEndTime')}
              value={generator.end}
              onChange={(event) => onChange({ ...generator, end: event.target.value })}
            />
          </label>
          <small>
            {kind === 'time'
              ? tConnector('hhMmSsOrHhMmSsSssRepresentingUtc')
              : tConnector('yyyyMmDdDatetimesAlsoAcceptYyyyMmDdthhMm')}
          </small>
        </>
      )}
      {kind === 'text' && (
        <label>
          {tConnector('characterCount')}
          <input
            aria-label={tConnector('generatedTextCharacterCount')}
            type="number"
            min={1}
            max={4096}
            value={generator.length}
            onChange={(event) => onChange({ ...generator, length: Number(event.target.value) })}
          />
          <small>{tConnector('usesEnglishLettersAndDigitsValuesExceedingTheColumnLength')}</small>
        </label>
      )}
      {kind === 'email' && (
        <label>
          {tConnector('emailDomain')}
          <input
            aria-label={tConnector('generatedEmailDomain')}
            value={generator.domain}
            onChange={(event) => onChange({ ...generator, domain: event.target.value })}
          />
          <small>{tConnector('defaultsToExampleTestForTestData')}</small>
        </label>
      )}
      {kind === 'enum' && (
        <label>
          {tConnector('candidatesOnePerLine')}
          <textarea
            aria-label={tConnector('generatedEnumCandidates')}
            value={generator.values.join('\n')}
            maxLength={65536}
            onChange={(event) => onChange({ ...generator, values: event.target.value.split('\n') })}
          />
          <small>{tConnector('nativeEnumAcceptsOnlyActualCandidatesEmptyLinesRemainEmpty')}</small>
        </label>
      )}
      {kind === 'uuid' && <p>{tConnector('generatesRfcUuidVValuesFromASeedVersionAnd')}</p>}
      {kind === 'name' && (
        <p>{tConnector('generatesThreeCharacterChineseNamesFromABoundedCandidateSet')}</p>
      )}
    </div>
  );
}
