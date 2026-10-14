'use client';
import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './options.messages';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { useState } from 'react';
import type {
  DatabaseExportFormat,
  DatabaseExportInput,
  DatabaseExportTableTarget,
} from '@fouc/shared/database-export';
import styles from './database-export.module.css';
export interface ExportOptionsProps {
  value: DatabaseExportInput;
  schemas: string[];
  tables?: DatabaseExportTableTarget[];
  selectedMode: boolean;
  disabled: boolean;
  onChange(value: DatabaseExportInput): void;
  onSelectedMode(value: boolean): void;
}
const formats = (
  locale?: Locale,
): Array<{
  value: DatabaseExportFormat;
  label: string;
  detail: string;
}> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    { value: 'sql', label: 'SQL', detail: tConnector('nativeDdlInsert') },
    { value: 'csv', label: 'CSV', detail: tConnector('delimitedTextWithHeaders') },
    { value: 'ndjson', label: 'NDJSON', detail: tConnector('oneJsonObjectPerLine') },
    { value: 'json', label: 'JSON', detail: tConnector('aStandaloneCompleteJsonArray') },
  ];
};
export function ExportOptions({
  value,
  schemas,
  tables,
  selectedMode,
  disabled,
  onChange,
  onSelectedMode,
}: ExportOptionsProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [search, setSearch] = useState('');
  const change = (patch: Partial<DatabaseExportInput>) => onChange({ ...value, ...patch });
  const visible =
    tables?.filter(
      (table) =>
        value.schemas.includes(table.schema) &&
        `${table.schema}.${table.table}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    ) ?? [];
  const keys = new Set(value.tables.map((table) => JSON.stringify([table.schema, table.table])));
  return (
    <div className={styles.options}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.step}>01</span>
          <div>
            <h3>{tConnector('selectNativeObjectScope')}</h3>
            <p>{tConnector('collectOnlyCatalogEntriesAndDataReadableThroughTheCurrent')}</p>
          </div>
        </div>
        <div className={styles.schemas} role="group" aria-label={tConnector('exportSchemaScope')}>
          {schemas.map((schema) => (
            <label key={schema}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={value.schemas.includes(schema)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...value.schemas, schema]
                    : value.schemas.filter((item) => item !== schema);
                  change({
                    schemas: next,
                    tables: value.tables.filter((table) => next.includes(table.schema)),
                  });
                }}
              />
              <span>{schema}</span>
            </label>
          ))}
        </div>
        <>
          <div
            className={styles.segment}
            role="group"
            aria-label={tConnector('exportObjectSelectionMode')}
          >
            <button
              disabled={disabled}
              data-active={!selectedMode}
              onClick={() => onSelectedMode(false)}
            >
              {tConnector('allObjectsInSelectedSchemas')}
            </button>
            <button
              disabled={disabled}
              data-active={selectedMode}
              onClick={() => onSelectedMode(true)}
            >
              {tConnector('specificTablesViews')}
            </button>
          </div>
          {selectedMode && (
            <div className={styles.targets}>
              <label className={styles.search}>
                <MagnifyingGlass size={14} />
                <input
                  value={search}
                  disabled={disabled}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tConnector('searchTablesViews')}
                  aria-label={tConnector('searchExportObjects')}
                />
              </label>
              <div className={styles.targetList}>
                {visible.map((table) => {
                  const key = JSON.stringify([table.schema, table.table]);
                  return (
                    <label key={key}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={keys.has(key)}
                        onChange={(event) =>
                          change({
                            tables: event.target.checked
                              ? [...value.tables, table]
                              : value.tables.filter(
                                  (item) => JSON.stringify([item.schema, item.table]) !== key,
                                ),
                          })
                        }
                      />
                      <span>
                        {table.table}
                        <small>{table.schema}</small>
                      </span>
                    </label>
                  );
                })}
                {!visible.length && <p>{tConnector('noMatchingNativeObjects')}</p>}
              </div>
              <div className={styles.targetFooter}>
                {tConnector('selected')}
                {value.tables.length}
                {tConnector('objects')}
                <button
                  disabled={disabled || !visible.length}
                  onClick={() =>
                    change({
                      tables: [
                        ...new Map(
                          [...value.tables, ...visible].map((table) => [
                            JSON.stringify([table.schema, table.table]),
                            table,
                          ]),
                        ).values(),
                      ],
                    })
                  }
                >
                  {tConnector('selectSearchResults')}
                </button>
              </div>
            </div>
          )}
        </>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.step}>02</span>
          <div>
            <h3>{tConnector('formatAndDataContents')}</h3>
            <p>{tConnector('preserveOriginalNumericTextBinaryDataAndNullToAvoid')}</p>
          </div>
        </div>
        <div
          className={styles.formats}
          role="group"
          aria-label={tConnector('databaseExportFormat')}
        >
          {formats(locale).map((format) => (
            <button
              key={format.value}
              disabled={disabled}
              data-active={value.format === format.value}
              onClick={() =>
                change({
                  format: format.value,
                  includeStructure: format.value === 'sql' ? value.includeStructure : false,
                  includeData: format.value !== 'sql' || value.includeData,
                })
              }
            >
              <strong>{format.label}</strong>
              <small>{format.detail}</small>
            </button>
          ))}
        </div>
        {value.format === 'sql' ? (
          <div className={styles.checks}>
            <label>
              <input
                type="checkbox"
                checked={value.includeStructure}
                disabled={disabled}
                onChange={(event) => change({ includeStructure: event.target.checked })}
              />
              {tConnector('structureDdl')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={value.includeData}
                disabled={disabled}
                onChange={(event) => change({ includeData: event.target.checked })}
              />
              {tConnector('tableDataInsert')}
            </label>
          </div>
        ) : (
          <p className={styles.helper}>
            {value.format === 'csv'
              ? tConnector('nullUsesUnquotedNEmptyStringsAndLiteralNText')
              : tConnector('nativeJsonAndArrayColumnsRemainRawTextBinaryValues')}
          </p>
        )}
        <div className={styles.fieldGrid}>
          <label>
            <span>{tConnector('actualRowRange')}</span>
            <select
              disabled={disabled}
              value={value.rowLimit === null ? 'all' : 'limited'}
              onChange={(event) => change({ rowLimit: event.target.value === 'all' ? null : 5000 })}
            >
              <option value="all">{tConnector('allRowsInEachTable')}</option>
              <option value="limited">
                {tConnector('explicitlyLimitToTheFirstNRowsPerTable')}
              </option>
            </select>
          </label>
          {value.rowLimit !== null && (
            <label>
              <span>{tConnector('maximumRowsPerTable')}</span>
              <input
                type="number"
                min={1}
                max={100000000}
                disabled={disabled}
                value={value.rowLimit}
                onChange={(event) => change({ rowLimit: event.target.valueAsNumber })}
              />
            </label>
          )}
          <label>
            <span>{tConnector('pageBuffer')}</span>
            <select
              disabled={disabled}
              value={value.pageSize}
              onChange={(event) => change({ pageSize: Number(event.target.value) })}
            >
              <option value={100}>{tConnector('rowsPage')}</option>
              <option value={500}>{tConnector('rowsPage882')}</option>
              <option value={1000}>{tConnector('rowsPage883')}</option>
            </select>
          </label>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.step}>03</span>
          <div>
            <h3>{tConnector('filesAndChunks')}</h3>
            <p>{tConnector('deviceStreamingOutputDownloadWhenCompleteMaximumGibPerExport')}</p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <label>
            <span>{tConnector('packaging')}</span>
            <select
              disabled={disabled}
              value={value.packaging}
              onChange={(event) =>
                change({
                  packaging: event.target.value as DatabaseExportInput['packaging'],
                  partMiB: event.target.value === 'file' ? null : 64,
                })
              }
            >
              <option value="zip">{tConnector('zipTypeRangeManifest')}</option>
              <option value="file">{tConnector('singleFile')}</option>
            </select>
          </label>
          {value.packaging === 'zip' && (
            <label>
              <span>{tConnector('targetChunkSize')}</span>
              <select
                disabled={disabled}
                value={value.partMiB ?? 'none'}
                onChange={(event) =>
                  change({
                    partMiB: event.target.value === 'none' ? null : Number(event.target.value),
                  })
                }
              >
                <option value={16}>16 MiB</option>
                <option value={64}>64 MiB</option>
                <option value={128}>128 MiB</option>
                <option value={256}>256 MiB</option>
                <option value="none">{tConnector('doNotSplitTablesIntoChunks')}</option>
              </select>
            </label>
          )}
        </div>
        <p className={styles.helper}>
          {value.packaging === 'zip'
            ? tConnector('standardZipStoreWithoutCompressionEachJsonChunkIsIndependently')
            : tConnector('aSingleCsvJsonNdjsonFileSupportsOneObjectOnly')}
        </p>
      </section>
    </div>
  );
}
