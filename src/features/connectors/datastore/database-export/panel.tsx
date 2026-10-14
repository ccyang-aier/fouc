'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useEffect, useRef, useState } from 'react';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Stop } from '@phosphor-icons/react/dist/csr/Stop';
import type { RelationalProvider } from '@fouc/shared';
import {
  DEFAULT_DATABASE_EXPORT_INPUT,
  validateDatabaseExportInput,
  type DatabaseExportInput,
  type DatabaseExportTableTarget,
} from '@fouc/shared/database-export';
import { downloadDatabaseExport } from './download';
import { ExportOptions } from './options';
import { ExportProgress, exportBytes } from './progress';
import { databaseExportActive, useDatabaseExportJob } from './use-export-job';
import { useDatabaseExportCatalogue } from './use-export-catalogue';
import styles from './database-export.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface DatabaseExportPanelProps {
  base: string;
  provider: RelationalProvider;
  database: string;
  schemas: string[];
  tables?: DatabaseExportTableTarget[];
  initialSchemas?: string[];
  initialTables?: DatabaseExportTableTarget[];
  onClose?(): void;
}
export function DatabaseExportPanel(props: DatabaseExportPanelProps) {
  return <Panel key={`${props.base}:${JSON.stringify(props.schemas)}`} {...props} />;
}
function Panel({
  base,
  provider,
  database,
  schemas,
  tables,
  initialSchemas,
  initialTables,
  onClose,
}: DatabaseExportPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [input, setInput] = useState<DatabaseExportInput>(() => ({
    ...DEFAULT_DATABASE_EXPORT_INPUT,
    schemas: initialSchemas?.filter((schema) => schemas.includes(schema)) ?? [...schemas],
    tables: initialTables?.map((table) => ({ ...table })) ?? [],
  }));
  const [selectedMode, setSelectedMode] = useState(Boolean(initialTables?.length));
  const [inputErrorStored, setInputError] = useState<UiMessage | null>(null);
  const inputError = inputErrorStored === null ? null : uiText(inputErrorStored, locale);
  const [downloading, setDownloading] = useState(false);
  const [downloadBytes, setDownloadBytes] = useState(0);
  const [downloadFeedbackStored, setDownloadFeedback] = useState<UiMessage | null>(null);
  const downloadFeedback =
    downloadFeedbackStored === null ? null : uiText(downloadFeedbackStored, locale);
  const [downloadErrorStored, setDownloadError] = useState<UiMessage | null>(null);
  const downloadError = downloadErrorStored === null ? null : uiText(downloadErrorStored, locale);
  const downloadController = useRef<AbortController | null>(null);
  const resource = useDatabaseExportJob(base);
  const catalogue = useDatabaseExportCatalogue(
    base,
    input.schemas,
    tables,
    selectedMode && !resource.progress,
  );
  const active = databaseExportActive(resource.progress);
  const busy =
    active || resource.starting || downloading || resource.loadingRecent || catalogue.loading;
  useEffect(() => () => downloadController.current?.abort(), []);
  function start() {
    try {
      if (selectedMode && !input.tables.length)
        throw connectorUiMessages.error('selectAtLeastOneTableOrViewInSpecificObject');
      const request = validateDatabaseExportInput({
        ...input,
        tables: selectedMode ? input.tables : [],
      });
      setInputError(null);
      setDownloadFeedback(null);
      setDownloadError(null);
      void resource.start(request);
    } catch (error) {
      setInputError(error instanceof Error ? uiFailure(error) : String(error));
    }
  }
  function returnToSettings() {
    const previous = resource.progress?.review?.input;
    if (previous) {
      setInput(previous);
      setSelectedMode(previous.tables.length > 0);
    }
    setInputError(null);
    setDownloadError(null);
    setDownloadFeedback(null);
    resource.select(null);
  }
  async function download() {
    if (!resource.progress?.artifact || !resource.artifactUrl) return;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(true);
    setDownloadBytes(0);
    setDownloadFeedback(null);
    setDownloadError(null);
    try {
      const artifact = resource.progress.artifact;
      const method = await downloadDatabaseExport(
        resource.artifactUrl,
        artifact.filename,
        artifact.bytes,
        controller.signal,
        setDownloadBytes,
        undefined,
      );
      setDownloadFeedback(
        method === 'disk'
          ? connectorUiMessages.message('theCompleteFileWasSavedToTheSelectedLocation')
          : connectorUiMessages.message('theCompleteFileWasHandedToTheBrowserForDownload'),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        setDownloadFeedback(
          connectorUiMessages.message('fileDownloadCancelledSaveItAgainWhenReady'),
        );
      else setDownloadError(error instanceof Error ? uiFailure(error) : String(error));
    } finally {
      setDownloading(false);
    }
  }
  return (
    <section className={styles.panel} aria-label={tConnector('nativeDatabaseStreamingExport')}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headerIcon}>
            <Database size={21} weight="duotone" />
          </span>
          <div>
            <span className={styles.eyebrow}>{tConnector('nativeDatabaseExport')}</span>
            <h2>{tConnector('databaseExport')}</h2>
            <p>
              {provider} <span>·</span> {database}
            </p>
          </div>
        </div>
        <span className={styles.readOnlyBadge}>{tConnector('readOnlySource')}</span>
      </header>
      <main className={styles.body}>
        {resource.recent.length > 0 && (
          <div className={styles.recent}>
            <label>
              <span>{tConnector('currentSessionJobs')}</span>
              <select
                aria-label={tConnector('restoreDatabaseExportJob')}
                disabled={downloading || resource.starting}
                value={resource.progress?.id ?? ''}
                onChange={(event) => resource.select(event.target.value || null)}
              >
                <option value="">{tConnector('newExportJob')}</option>
                {resource.recent.map((job) => (
                  <option key={job.id} value={job.id}>
                    {new Date(job.startedAt).toLocaleTimeString(locale)} ·{' '}
                    {job.review?.input.format.toUpperCase() ?? tConnector('preparing')} ·{' '}
                    {
                      {
                        preparing: tConnector('preparing691'),
                        running: tConnector('running'),
                        finalizing: tConnector('packaging'),
                        completed: tConnector('readyToDownload'),
                        cancelled: tConnector('cancelled'),
                        failed: tConnector('failed'),
                      }[job.status]
                    }{' '}
                    · {job.rows.toLocaleString(locale)}
                    {tConnector('row')}
                  </option>
                ))}
              </select>
            </label>
            {resource.progress && !active && (
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() =>
                  void resource
                    .discard()
                    .catch((error) =>
                      setInputError(error instanceof Error ? uiFailure(error) : String(error)),
                    )
                }
              >
                {tConnector('deleteDeviceFile')}
              </button>
            )}
          </div>
        )}
        {resource.loadingRecent ? (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            <span>{tConnector('restoringExportJobsForTheCurrentSession')}</span>
          </div>
        ) : resource.progress ? (
          <ExportProgress value={resource.progress} />
        ) : (
          <>
            {catalogue.error && (
              <p className={styles.error} role="alert">
                {tConnector('couldNotReadTheNativeObjectCatalog')}
                {catalogue.error}{' '}
                <button className={styles.secondary} onClick={catalogue.retry}>
                  {tConnector('retryCatalog')}
                </button>
              </p>
            )}
            {catalogue.loading && (
              <p className={styles.helper} role="status">
                {tConnector('readingNativeObjectsInTheSelectedSchemas')}
              </p>
            )}
            <ExportOptions
              value={input}
              schemas={schemas}
              tables={catalogue.tables}
              selectedMode={selectedMode}
              disabled={busy}
              onChange={setInput}
              onSelectedMode={setSelectedMode}
            />
          </>
        )}
      </main>
      {(inputError || resource.error || downloadError) && (
        <div className={styles.errorBar} role="alert">
          {inputError ?? resource.error ?? downloadError}
        </div>
      )}
      {downloadFeedback && (
        <div className={styles.feedback} role="status">
          {downloadFeedback}
        </div>
      )}
      <footer className={styles.footer}>
        <div className={styles.footerNote}>
          {downloading
            ? tConnector('saving', {
                p0: String(exportBytes(downloadBytes)),
                p1: String(exportBytes(resource.progress?.artifact?.bytes ?? 0)),
              })
            : resource.progress?.status === 'completed'
              ? tConnector('reopenToResumeTheDownloadDeviceFilesAreCleanedUp')
              : active
                ? tConnector('theJobContinuesAfterThisPanelClosesCancellingStopsReads')
                : tConnector('temporaryFileBudgetGibPerSessionGibPerDevice')}
        </div>
        <div className={styles.footerActions}>
          {onClose && (
            <button
              className={styles.secondary}
              disabled={resource.starting || downloading}
              onClick={onClose}
            >
              {tConnector('close')}
            </button>
          )}
          {downloading ? (
            <button
              className={styles.secondary}
              onClick={() => downloadController.current?.abort()}
            >
              <Stop size={13} />
              {tConnector('cancelDownload')}
            </button>
          ) : active ? (
            <button
              className={styles.secondary}
              disabled={resource.cancelling}
              onClick={() => void resource.cancel()}
            >
              <Stop size={13} />
              {resource.cancelling ? tConnector('cancelling') : tConnector('cancelExport')}
            </button>
          ) : resource.progress ? (
            <>
              <button className={styles.secondary} disabled={busy} onClick={returnToSettings}>
                {resource.progress.status === 'failed'
                  ? tConnector('adjustSettingsAndRetry')
                  : tConnector('newExport')}
              </button>
              {resource.progress.status === 'completed' && (
                <button className={styles.primary} onClick={() => void download()}>
                  <DownloadSimple size={15} />
                  {tConnector('saveFile')}
                </button>
              )}
            </>
          ) : (
            <button className={styles.primary} disabled={busy || !schemas.length} onClick={start}>
              {resource.starting ? tConnector('preparing924') : tConnector('startNativeExport')}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
