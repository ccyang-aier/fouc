'use client';
import { uiText, uiFailure, createUiMessages, type UiMessage } from '../../i18n/ui-message';
import { getLocale, type Locale } from '@/lib/i18n';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './dialog.messages';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Copy,
  DownloadSimple,
  FileCode,
  SpinnerGap,
  Table,
} from '@phosphor-icons/react';
import type { DatabaseQueryResult, RelationalProvider } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import common from '../relational.module.css';
import styles from './export.module.css';
import {
  copyResultExport,
  downloadResultExport,
  exportQueryResult,
  previewQueryResult,
} from './export';
import {
  DEFAULT_RESULT_EXPORT_OPTIONS,
  RESULT_EXPORT_FORMATS,
  resultExportFilename,
  type ResultExportOptions,
  type ResultExportPreview,
  type ResultExportProgress,
  type ResultExportTarget,
} from './model';
export interface ResultExportDialogProps {
  result: DatabaseQueryResult;
  provider: RelationalProvider;
  title?: string;
  target?: ResultExportTarget;
  selectedRows?: readonly number[];
  selectedColumns?: readonly number[];
  initialFormat?: import('./model').ResultExportFormat;
  onClose: () => void;
}
const providerNames: Record<RelationalProvider, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};
const count = (value: number, locale?: Locale) => value.toLocaleString(locale ?? getLocale());
function bytes(value: number) {
  return value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KiB`
      : `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
const connectorUiMessages = createUiMessages(connectorMessages);
function errorText(error: unknown) {
  return uiFailure(error);
}
export function ResultExportDialog({
  result,
  provider,
  title: titleProvided,
  target,
  selectedRows,
  selectedColumns,
  initialFormat,
  onClose,
}: ResultExportDialogProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const title = titleProvided === undefined ? tConnector('queryResults') : titleProvided;
  const [options, setOptions] = useState<ResultExportOptions>(() => ({
    ...DEFAULT_RESULT_EXPORT_OPTIONS,
    ...(initialFormat ? { format: initialFormat } : {}),
    target: target ?? { table: '' },
  }));
  const [filename, setFilename] = useState(title);
  const [rowScope, setRowScope] = useState<'all' | 'selected'>(
    selectedRows?.length ? 'selected' : 'all',
  );
  const [columns, setColumns] = useState<number[]>(() =>
    selectedColumns ? [...new Set(selectedColumns)] : result.columns.map((_, index) => index),
  );
  const [preview, setPreview] = useState<ResultExportPreview | null>(null);
  const [previewErrorStored, setPreviewError] = useState<UiMessage>('');
  const previewError = uiText(previewErrorStored, locale);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [action, setAction] = useState<'copy' | 'download' | null>(null);
  const [progress, setProgress] = useState<ResultExportProgress | null>(null);
  const [feedbackStored, setFeedback] = useState<{
    kind: 'success' | 'error';
    text: UiMessage;
  } | null>(null);
  const feedback = feedbackStored && {
    ...feedbackStored,
    text: uiText(feedbackStored.text, locale),
  };
  const previewController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const selected = useMemo(
    () => ({
      selectedRows: rowScope === 'selected' ? (selectedRows ?? []) : undefined,
      selectedColumns: columns,
    }),
    [rowScope, selectedRows, columns],
  );
  const totalRows = rowScope === 'selected' ? new Set(selectedRows).size : result.rows.length;
  const format = RESULT_EXPORT_FORMATS(locale).find((entry) => entry.value === options.format)!;
  const dsv = options.format === 'csv' || options.format === 'tsv';
  const plainTable = dsv || options.format === 'markdown';
  const busy = action !== null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewController.current?.abort();
      actionController.current?.abort();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    previewController.current?.abort();
    previewController.current = controller;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError('');
      void previewQueryResult(result, provider, options, { ...selected, signal: controller.signal })
        .then((next) => {
          if (!controller.signal.aborted) setPreview(next);
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setPreview(null);
            setPreviewError(errorText(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 80);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [result, provider, options, selected]);
  function update<K extends keyof ResultExportOptions>(key: K, value: ResultExportOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
    setFeedback(null);
    setPreviewLoading(true);
  }
  function close() {
    previewController.current?.abort();
    actionController.current?.abort();
    onClose();
  }
  function cancelGeneration() {
    actionController.current?.abort();
    setAction(null);
    setFeedback({ kind: 'success', text: connectorUiMessages.message('generationCancelled') });
  }
  async function run(nextAction: 'copy' | 'download') {
    const controller = new AbortController();
    actionController.current?.abort();
    actionController.current = controller;
    setAction(nextAction);
    setProgress({ completedRows: 0, totalRows, byteLength: 0 });
    setFeedback(null);
    try {
      const artifact = await exportQueryResult(
        result,
        provider,
        options,
        {
          ...selected,
          signal: controller.signal,
          onProgress: (value) => {
            if (mounted.current && !controller.signal.aborted) setProgress(value);
          },
        },
        locale,
      );
      controller.signal.throwIfAborted();
      if (nextAction === 'copy') await copyResultExport(artifact);
      else
        downloadResultExport(artifact, resultExportFilename(filename, artifact.extension, locale));
      if (mounted.current && !controller.signal.aborted)
        setFeedback({
          kind: 'success',
          text:
            nextAction === 'copy'
              ? connectorUiMessages.message('copiedCompleteResultsForRows', {
                  p0: String(count(artifact.rowCount, locale)),
                })
              : connectorUiMessages.message('downloadedRows', {
                  p0: String(count(artifact.rowCount, locale)),
                  p1: String(bytes(artifact.byteLength)),
                }),
        });
    } catch (error) {
      if (mounted.current && !controller.signal.aborted)
        setFeedback({ kind: 'error', text: errorText(error) });
    } finally {
      if (mounted.current && actionController.current === controller) setAction(null);
    }
  }
  function toggleColumn(index: number) {
    setColumns((current) =>
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index].sort((a, b) => a - b),
    );
    setPreviewLoading(true);
    setFeedback(null);
  }
  return (
    <SqlDialog title={tConnector('exportQueryResults')} className={styles.dialog} onClose={close}>
      <div className={styles.scopeNote}>
        <Table size={16} />
        <span>{tConnector('exportCurrentlyLoadedResultsOnly')}</span>
        <strong>
          {count(result.rows.length, locale)}
          {tConnector('rows')}
          {count(result.columns.length, locale)}
          {tConnector('columns')}
        </strong>
        {(result.hasMore || result.truncated) && (
          <small>{tConnector('moreDataRemainsUnloadedAndIsNotIncluded')}</small>
        )}
      </div>
      <div className={styles.body}>
        <aside className={styles.settings} aria-label={tConnector('exportConfiguration')}>
          <fieldset disabled={busy}>
            <legend>{tConnector('fileFormat')}</legend>
            <div className={styles.formats}>
              {RESULT_EXPORT_FORMATS(locale).map((entry) => (
                <button
                  type="button"
                  key={entry.value}
                  aria-pressed={options.format === entry.value}
                  onClick={() => update('format', entry.value)}
                >
                  <strong>{entry.label}</strong>
                  <small>{entry.detail}</small>
                </button>
              ))}
            </div>
            <label className={styles.field}>
              {tConnector('filename')}
              <div className={styles.filename}>
                <input
                  aria-label={tConnector('exportFilename')}
                  value={filename}
                  maxLength={160}
                  onChange={(event) => setFilename(event.target.value)}
                />
                <span>.{format.extension}</span>
              </div>
            </label>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>{tConnector('dataScope')}</legend>
            <label className={styles.field}>
              {tConnector('exportRows')}
              <select
                aria-label={tConnector('exportRowScope')}
                value={rowScope}
                onChange={(event) => {
                  setRowScope(event.target.value as 'all' | 'selected');
                  setPreviewLoading(true);
                  setFeedback(null);
                }}
              >
                <option value="all">
                  {tConnector('allLoadedRows')}
                  {count(result.rows.length, locale)}）
                </option>
                <option value="selected" disabled={!selectedRows?.length}>
                  {tConnector('selectedRowsOnly')}
                  {count(new Set(selectedRows).size, locale)}）
                </option>
              </select>
            </label>
            <div className={styles.columnHead}>
              <span>
                {tConnector('exportColumns')}
                <small>
                  {columns.length}/{result.columns.length}
                </small>
              </span>
              <button
                type="button"
                onClick={() => {
                  setColumns(result.columns.map((_, index) => index));
                  setPreviewLoading(true);
                }}
              >
                {tConnector('selectAll')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setColumns([]);
                  setPreviewLoading(true);
                }}
              >
                {tConnector('clear')}
              </button>
            </div>
            <div className={styles.columns} role="group" aria-label={tConnector('exportColumns')}>
              {result.columns.map((name, index) => (
                <label key={index}>
                  <input
                    type="checkbox"
                    checked={columns.includes(index)}
                    onChange={() => toggleColumn(index)}
                  />
                  <span title={name}>
                    {name || tConnector('column', { p0: String(index + 1) })}
                  </span>
                  <small>{index + 1}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>{tConnector('formatSettings')}</legend>
            {dsv && (
              <>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={options.includeHeader}
                    onChange={(event) => update('includeHeader', event.target.checked)}
                  />
                  {tConnector('includeColumnHeaderRow')}
                </label>
                <label className={styles.field}>
                  {tConnector('quotingPolicy')}
                  <select
                    aria-label={tConnector('exportQuotingPolicy')}
                    value={options.quoteMode}
                    onChange={(event) =>
                      update('quoteMode', event.target.value as 'all' | 'necessary')
                    }
                  >
                    <option value="all">{tConnector('quoteAllNonNullValues')}</option>
                    <option value="necessary">{tConnector('quoteOnlyWhenEscapingIsNeeded')}</option>
                  </select>
                </label>
              </>
            )}
            {plainTable && (
              <>
                <label className={styles.field}>
                  {tConnector('nullDisplay')}
                  <select
                    aria-label={tConnector('nullExportPolicy')}
                    value={options.nullMode}
                    onChange={(event) =>
                      update('nullMode', event.target.value as 'empty' | 'literal' | 'custom')
                    }
                  >
                    <option value="empty">{tConnector('emptyField')}</option>
                    <option value="literal">{tConnector('nullMarker')}</option>
                    <option value="custom">{tConnector('customMarker')}</option>
                  </select>
                </label>
                {options.nullMode === 'custom' && (
                  <input
                    className={styles.standaloneInput}
                    aria-label={tConnector('customNullMarker')}
                    value={options.nullText}
                    maxLength={64}
                    onChange={(event) => update('nullText', event.target.value)}
                    placeholder={tConnector('exampleN')}
                  />
                )}
                <label className={styles.field}>
                  {tConnector('binaryDisplay')}
                  <select
                    aria-label={tConnector('binaryExportRepresentation')}
                    value={options.binaryFormat}
                    onChange={(event) =>
                      update('binaryFormat', event.target.value as 'hex' | 'base64')
                    }
                  >
                    <option value="hex">{tConnector('hexadecimalX')}</option>
                    <option value="base64">Base64（base64:…）</option>
                  </select>
                </label>
              </>
            )}
            {options.format === 'json' && (
              <>
                <label className={styles.field}>
                  {tConnector('jsonStructure')}
                  <select
                    aria-label={tConnector('jsonExportStructure')}
                    value={options.jsonShape}
                    onChange={(event) =>
                      update('jsonShape', event.target.value as 'matrix' | 'records')
                    }
                  >
                    <option value="matrix">{tConnector('columnNamesRowMatrix')}</option>
                    <option value="records">{tConnector('objectArray')}</option>
                  </select>
                </label>
                <p className={styles.help}>
                  {tConnector(
                    'theMatrixPreservesDuplicateColumnNamesNumbersRetainOriginalPrecision',
                  )}
                </p>
              </>
            )}
            {options.format === 'sql' && (
              <>
                <div className={styles.nativeLabel}>
                  <FileCode size={15} />
                  {providerNames[provider]} INSERT
                </div>
                <label className={styles.field}>
                  {provider === 'mysql'
                    ? tConnector('targetDatabaseOptional')
                    : tConnector('targetSchemaOptional')}
                  <input
                    aria-label={tConnector('sqlExportTargetSchema')}
                    value={options.target?.schema ?? ''}
                    onChange={(event) =>
                      update('target', { ...options.target!, schema: event.target.value })
                    }
                    placeholder={
                      provider === 'postgres' ? 'public' : tConnector('keepCurrentDatabase')
                    }
                  />
                </label>
                <label className={styles.field}>
                  {tConnector('targetTableName')}
                  <input
                    aria-label={tConnector('sqlExportTargetTableName')}
                    value={options.target?.table ?? ''}
                    onChange={(event) =>
                      update('target', { ...options.target!, table: event.target.value })
                    }
                    placeholder={tConnector('enterTheActualTableName')}
                  />
                </label>
                <label className={styles.field}>
                  {tConnector('insertMode')}
                  <select
                    aria-label={tConnector('sqlInsertMode')}
                    value={options.sqlInsertMode}
                    onChange={(event) =>
                      update('sqlInsertMode', event.target.value as 'batch' | 'single')
                    }
                  >
                    <option value="batch">{tConnector('bulkValues')}</option>
                    <option value="single">{tConnector('oneInsertPerRow')}</option>
                  </select>
                </label>
                {options.sqlInsertMode === 'batch' && (
                  <label className={styles.field}>
                    {tConnector('rowsPerBatch')}
                    <input
                      type="number"
                      aria-label={tConnector('sqlRowsPerBatch')}
                      min={1}
                      max={1000}
                      value={options.sqlBatchSize}
                      onChange={(event) => update('sqlBatchSize', Number(event.target.value))}
                    />
                  </label>
                )}
                <p className={styles.help}>
                  {tConnector(
                    'statementsUseOriginalColumnNamesAdjustSelectedAliasesCalculatedColumns',
                  )}
                </p>
              </>
            )}
            <label className={styles.field}>
              {tConnector('lineEnding')}
              <select
                aria-label={tConnector('exportLineEnding')}
                value={options.newline}
                onChange={(event) => update('newline', event.target.value as 'lf' | 'crlf')}
              >
                <option value="lf">LF（\n）</option>
                <option value="crlf">CRLF（\r\n）</option>
              </select>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={options.bom}
                onChange={(event) => update('bom', event.target.checked)}
              />
              UTF-8 BOM<small>{tConnector('helpsExcelRecognizeChineseText')}</small>
            </label>
          </fieldset>
        </aside>
        <section className={styles.preview} aria-label={tConnector('exportPreviewPanel')}>
          <header>
            <div>
              <FileCode size={16} />
              <strong>{tConnector('livePreview')}</strong>
              <span>{format.label}</span>
            </div>
            <small>
              {count(totalRows, locale)}
              {tConnector('rows')}
              {columns.length}
              {tConnector('columns')}
            </small>
          </header>
          <div className={styles.previewContent} aria-busy={previewLoading}>
            {previewError ? (
              <div className={styles.previewEmpty} role="alert">
                <FileCode size={25} />
                <strong>{tConnector('adjustConfigurationToPreview')}</strong>
                <p>{previewError}</p>
              </div>
            ) : preview ? (
              <pre tabIndex={0} aria-label={tConnector('exportPreview')}>
                {preview.text || tConnector('noDataRowsInTheCurrentScope')}
              </pre>
            ) : (
              <div className={styles.previewEmpty}>
                <SpinnerGap size={24} className={styles.spin} />
                <p>{tConnector('generatingPreview')}</p>
              </div>
            )}
            {previewLoading && preview && (
              <div className={styles.previewUpdating}>
                <SpinnerGap size={13} className={styles.spin} />
                {tConnector('updatePreview')}
              </div>
            )}
          </div>
          <footer>
            <span>
              UTF-8 · {options.newline === 'crlf' ? 'CRLF' : 'LF'}
              {options.bom ? tConnector('fileIncludesBom') : ''}
            </span>
            <small>
              {preview?.truncated
                ? tConnector('previewFirstRowsUpToKib', { p0: String(preview.rowCount) })
                : preview
                  ? tConnector('previewRows', { p0: String(preview.rowCount) })
                  : tConnector('previewUpToRows')}
            </small>
          </footer>
          <p className={styles.previewHint}>
            {tConnector('downloadingAndCopyingGenerateTheCompleteSelectedScopePreviewingDoes')}
          </p>
        </section>
      </div>
      {feedback && (
        <div
          className={feedback.kind === 'error' ? styles.error : styles.success}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.kind === 'success' && <CheckCircle size={15} />}
          {feedback.text}
        </div>
      )}
      {busy && (
        <div className={styles.progress} role="status" aria-live="polite">
          <SpinnerGap size={14} className={styles.spin} />
          <span>
            {action === 'copy' ? tConnector('prepareToCopy') : tConnector('generateFile')} ·{' '}
            {count(progress?.completedRows ?? 0, locale)}/{count(totalRows, locale)}
            {tConnector('rows')}
            {bytes(progress?.byteLength ?? 0)}
          </span>
          <button type="button" onClick={cancelGeneration}>
            {tConnector('cancelGeneration')}
          </button>
        </div>
      )}
      <footer className={`${common.dialogFooter} ${styles.footer}`}>
        <button type="button" className={common.secondary} onClick={close}>
          {tConnector('cancel')}
        </button>
        <span />
        <button
          type="button"
          className={common.secondary}
          disabled={busy || previewLoading || !!previewError || !columns.length}
          onClick={() => void run('copy')}
        >
          <Copy size={15} />
          {tConnector('copyContents')}
        </button>
        <button
          type="button"
          className={common.primary}
          disabled={busy || previewLoading || !!previewError || !columns.length || !filename.trim()}
          onClick={() => void run('download')}
        >
          <DownloadSimple size={15} />
          {action === 'download'
            ? tConnector('generating')
            : tConnector('download', { p0: String(format.extension) })}
        </button>
      </footer>
    </SqlDialog>
  );
}
