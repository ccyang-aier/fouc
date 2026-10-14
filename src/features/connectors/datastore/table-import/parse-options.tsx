import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './parse-options.messages';
import type {
  TableImportEncoding,
  TableImportFormat,
  TableImportParseOptions,
} from '@fouc/shared/table-import';
import styles from './table-import.module.css';
const FORMATS = (locale?: Locale): Array<[TableImportFormat, string]> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    ['csv', 'CSV'],
    ['tsv', 'TSV'],
    ['delimited', tConnector('customDelimitedText')],
    ['json', tConnector('jsonArray')],
    ['ndjson', 'NDJSON'],
    ['sql', tConnector('insertSqlLiterals')],
  ];
};
export function defaultTableImportOptions(format: TableImportFormat): TableImportParseOptions {
  return {
    format,
    titleRow: ['json', 'ndjson', 'sql'].includes(format) ? 0 : 1,
    dataStartRow: ['json', 'ndjson', 'sql'].includes(format) ? 1 : 2,
    lastDataRow: 0,
    trimValues: false,
    emptyStringAsNull: false,
    nullToken: '\\N',
    jsonShape: 'auto',
    delimiter: ',',
    sqlDialect: 'sqlite',
  };
}
export function TableImportParseControls({
  options,
  onChange,
  encoding,
  onEncoding,
  hasFile,
}: {
  options: TableImportParseOptions;
  onChange: (value: TableImportParseOptions) => void;
  encoding: TableImportEncoding;
  onEncoding: (value: TableImportEncoding) => void;
  hasFile: boolean;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const delimited = ['csv', 'tsv', 'delimited'].includes(options.format);
  return (
    <div className={styles.options} aria-label={tConnector('importParsingSettings')}>
      <div className={styles.optionGrid}>
        <label>
          {tConnector('sourceFormat')}
          <select
            value={options.format}
            onChange={(event) =>
              onChange(defaultTableImportOptions(event.target.value as TableImportFormat))
            }
          >
            {FORMATS(locale).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {hasFile && (
          <label>
            {tConnector('textEncoding')}
            <select
              value={encoding}
              onChange={(event) => onEncoding(event.target.value as TableImportEncoding)}
            >
              <option value="auto">{tConnector('autoDetect')}</option>
              <option value="utf8">UTF-8</option>
              <option value="gbk">GBK / GB18030</option>
              <option value="utf16Le">UTF-16 LE</option>
              <option value="utf16Be">UTF-16 BE</option>
            </select>
          </label>
        )}
        {options.format === 'delimited' && (
          <label>
            {tConnector('delimiter')}
            <input
              value={options.delimiter ?? ','}
              maxLength={2}
              onChange={(event) => onChange({ ...options, delimiter: event.target.value })}
              placeholder={tConnector('oneCharacterOrT')}
            />
          </label>
        )}
        {delimited && (
          <label>
            {tConnector('headerRecord')}
            <input
              type="number"
              min={0}
              value={options.titleRow ?? 1}
              onChange={(event) => onChange({ ...options, titleRow: Number(event.target.value) })}
            />
            <small>{tConnector('meansNoHeader')}</small>
          </label>
        )}
        <label>
          {tConnector('firstDataRecord')}
          <input
            type="number"
            min={1}
            value={options.dataStartRow ?? 1}
            onChange={(event) => onChange({ ...options, dataStartRow: Number(event.target.value) })}
          />
        </label>
        <label>
          {tConnector('lastDataRecord')}
          <input
            type="number"
            min={0}
            value={options.lastDataRow ?? 0}
            onChange={(event) => onChange({ ...options, lastDataRow: Number(event.target.value) })}
          />
          <small>{tConnector('meansEndOfFile')}</small>
        </label>
        {['json', 'ndjson'].includes(options.format) && (
          <label>
            {tConnector('jsonRowStructure')}
            <select
              value={options.jsonShape ?? 'auto'}
              onChange={(event) =>
                onChange({
                  ...options,
                  jsonShape: event.target.value as TableImportParseOptions['jsonShape'],
                })
              }
            >
              <option value="auto">{tConnector('autoDetect3546')}</option>
              <option value="objects">{tConnector('objectRows')}</option>
              <option value="arrays">{tConnector('arrayRows')}</option>
            </select>
          </label>
        )}
        {options.format === 'sql' && (
          <label>
            {tConnector('sourceSqlDialect')}
            <select
              value={options.sqlDialect ?? 'sqlite'}
              onChange={(event) =>
                onChange({
                  ...options,
                  sqlDialect: event.target.value as TableImportParseOptions['sqlDialect'],
                })
              }
            >
              <option value="mysql">MySQL</option>
              <option value="postgres">PostgreSQL</option>
              <option value="sqlite">SQLite</option>
            </select>
          </label>
        )}
        {delimited && (
          <label>
            {tConnector('nullMarker')}
            <input
              value={options.nullToken ?? ''}
              onChange={(event) =>
                onChange({ ...options, nullToken: event.target.value || undefined })
              }
              placeholder={tConnector('unset')}
            />
          </label>
        )}
      </div>
      {delimited && (
        <div className={styles.checks}>
          <label>
            <input
              type="checkbox"
              checked={!!options.trimValues}
              onChange={(event) => onChange({ ...options, trimValues: event.target.checked })}
            />
            {tConnector('trimWhitespaceAroundFields')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!options.emptyStringAsNull}
              onChange={(event) =>
                onChange({ ...options, emptyStringAsNull: event.target.checked })
              }
            />
            {tConnector('convertEmptyStringsToNull')}
          </label>
        </div>
      )}
      <p className={styles.hint}>
        {options.format === 'sql'
          ? tConnector('onlyInsertIntoColumnsValuesLiteralsFromASingleSource')
          : tConnector('recordNumbersCountDataRecordsNewlinesInsideQuotedFieldsDo')}
      </p>
    </div>
  );
}
