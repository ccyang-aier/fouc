'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './progress.messages';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { StopCircle } from '@phosphor-icons/react/dist/csr/StopCircle';
import type { DatabaseExportProgress } from '@fouc/shared/database-export';
import styles from './database-export.module.css';
export function exportBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}
export function ExportProgress({ value }: { value: DatabaseExportProgress }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const complete = value.status === 'completed';
  const failed = value.status === 'failed';
  const cancelled = value.status === 'cancelled';
  const active = !complete && !failed && !cancelled;
  const ratio = complete
    ? 100
    : value.totalTables
      ? Math.min(99, (value.completedTables / value.totalTables) * 100)
      : 0;
  const warnings = value.summary?.warnings ?? [
    ...(value.review?.warnings ?? []),
    ...(value.review?.tables.flatMap((table) =>
      table.warnings.map((warning) => `${table.schema}.${table.table}: ${warning}`),
    ) ?? []),
  ];
  const title = {
    preparing: tConnector('confirmingNativeStructureAndReadScope'),
    running: tConnector('readingAndWritingNativeData'),
    finalizing: tConnector('packagingTheManifestAndCompletingFiles'),
    completed: tConnector('nativeDatabaseExportCompleted'),
    cancelled: tConnector('exportCancelledTemporaryFilesRemoved'),
    failed: tConnector('exportIncompleteDownloadIsUnavailable'),
  }[value.status];
  return (
    <div className={styles.progress} aria-live="polite">
      <div className={styles.statusIcon} data-status={value.status}>
        {active ? (
          <span className={styles.spinner} />
        ) : complete ? (
          <CheckCircle size={28} weight="duotone" />
        ) : cancelled ? (
          <StopCircle size={28} weight="duotone" />
        ) : (
          <WarningCircle size={28} weight="duotone" />
        )}
      </div>
      <h2>{title}</h2>
      <p className={styles.current}>
        {value.table
          ? `${value.table.schema}.${value.table.table}`
          : complete
            ? value.artifact?.filename
            : active
              ? tConnector('readOnlySourceConnectionStreamingToTheLocalDevice')
              : tConnector('sourceDataWasNotModified')}
      </p>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={tConnector('completedExportObjects')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value.totalTables ? Math.round(ratio) : undefined}
        data-indeterminate={value.totalTables === null && active}
      >
        <span style={{ width: `${ratio}%` }} />
      </div>
      <div className={styles.statistics}>
        <div>
          <strong>{value.rows.toLocaleString(locale)}</strong>
          <span>{tConnector('rowsActuallyExported')}</span>
        </div>
        <div>
          <strong>{exportBytes(value.bytes)}</strong>
          <span>{tConnector('writtenToDevice')}</span>
        </div>
        <div>
          <strong>
            {value.completedTables}
            <small> / {value.totalTables ?? '—'}</small>
          </strong>
          <span>{tConnector('completedObjects')}</span>
        </div>
      </div>
      <p className={styles.helper}>{tConnector('objectProgressIsNotAPercentageOfFullTableRows')}</p>
      {value.error && (
        <p className={styles.error} role="alert">
          {value.error}
        </p>
      )}
      {value.summary && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <strong>{tConnector('actualExportScope')}</strong>
            <span>
              {value.summary.rowLimit === null
                ? tConnector('allVisibleRowsPerTable')
                : tConnector('upToRowsPerTable', {
                    p0: String(value.summary.rowLimit.toLocaleString(locale)),
                  })}
            </span>
          </div>
          <div className={styles.resultRows}>
            {value.summary.tables.map((table) => (
              <div key={JSON.stringify([table.schema, table.table])}>
                <span>
                  {table.table}
                  <small>
                    {table.schema} ·{' '}
                    {table.pagination === 'keyset' ? tConnector('uniqueKeyCursor') : 'OFFSET'}
                  </small>
                </span>
                <strong>
                  {table.rows.toLocaleString(locale)}
                  {tConnector('row')}
                </strong>
                <small data-limited={table.limited}>
                  {table.limited
                    ? tConnector('moreRowsRemainExplicitLimit')
                    : tConnector('readToTheEndOfTheRange')}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <details className={styles.warnings} open={!active}>
          <summary>
            {tConnector('nativeConsistencyAndFormatInformation')}
            {warnings.length}
          </summary>
          {warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </details>
      )}
    </div>
  );
}
