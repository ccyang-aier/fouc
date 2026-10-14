'use client';

import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';

import { createTranslator, type Locale, useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './table-import-panel.messages';
import { useEffect, useRef, useState } from 'react';
import type { DatabaseColumnInfo, RelationalProvider } from '@fouc/shared';
import {
  autoMapTableImportColumns,
  decodeTableImportBytes,
  parseTableImport,
  TABLE_IMPORT_LIMITS,
  validateTableImportMappings,
  type TableImportAppendSummary,
  type TableImportEncoding,
  type TableImportFormat,
  type TableImportInput,
  type TableImportIssue,
  type TableImportMapping,
  type TableImportParsed,
  type TableImportPlan,
  type TableImportReview,
} from '@fouc/shared/table-import';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { FileArrowUp } from '@phosphor-icons/react/dist/csr/FileArrowUp';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { backendFetch } from '@/lib/backend';
import { TableImportMappingEditor } from './mapping-editor';
import { defaultTableImportOptions, TableImportParseControls } from './parse-options';
import { TableImportPreviewGrid } from './preview-grid';
import styles from './table-import.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export type TableImportPanelProps = {
  provider: RelationalProvider;
  sessionId: string;
  /** Scoped session resource URL, including its session ID. */
  base: string;
  schema: string;
  table: string;
  columns: DatabaseColumnInfo[];
  onPreview?: (input: TableImportInput, signal?: AbortSignal) => Promise<TableImportPlan>;
  onAppend?: (planId: string, signal?: AbortSignal) => Promise<TableImportAppendSummary>;
  onDiscard?: (planId: string) => Promise<void>;
  onImported?: (summary: TableImportAppendSummary) => void;
  onClose?: () => void;
};
type Step = 'source' | 'mapping' | 'review' | 'done';
const STEPS = (locale?: Locale): Array<[Step, string]> => {
  const tConnector = createTranslator(connectorMessages, locale);
  return [
    ['source', tConnector('sourceAndParsing')],
    ['mapping', tConnector('columnMapping')],
    ['review', tConnector('reviewImport')],
    ['done', tConnector('done')],
  ];
};
function formatForName(name: string): TableImportFormat {
  return /\.sql$/i.test(name)
    ? 'sql'
    : /\.tsv$/i.test(name)
      ? 'tsv'
      : /\.json$/i.test(name)
        ? 'json'
        : /\.(ndjson|jsonl)$/i.test(name)
          ? 'ndjson'
          : /\.(txt|psv)$/i.test(name)
            ? 'delimited'
            : 'csv';
}
function Issues({ issues }: { issues: TableImportIssue[] }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return issues.length ? (
    <div className={styles.issues} role="alert">
      <div>
        <WarningCircle size={15} />
        <strong>{tConnector('correctTheIssuesAndPreviewAgain')}</strong>
      </div>
      <ul>
        {issues.slice(0, 20).map((issue, index) => (
          <li key={index}>
            {issue.record ? tConnector('record', { p0: String(issue.record) }) : ''}
            {issue.line
              ? tConnector('lineColumn', { p0: String(issue.line), p1: String(issue.column) })
              : ''}
            {issue.targetColumn ? `${issue.targetColumn}：` : ''}
            {uiText(issue, locale)}
          </li>
        ))}
      </ul>
      {issues.length > 20 && (
        <span>
          {tConnector('another')}
          {issues.length - 20}
          {tConnector('issues')}
        </span>
      )}
    </div>
  ) : null;
}
export function TableImportPanel(props: TableImportPanelProps) {
  return (
    <TableImportWorkflow
      key={`${props.base}\0${props.sessionId}\0${props.schema}\0${props.table}`}
      {...props}
    />
  );
}
function TableImportWorkflow({
  provider,
  base,
  schema,
  table,
  columns,
  onPreview,
  onAppend,
  onDiscard,
  onImported,
  onClose,
}: TableImportPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [step, setStep] = useState<Step>('source'),
    [sourceMode, setSourceMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<{
      name: string;
      bytes: Uint8Array;
    } | null>(null),
    [paste, setPaste] = useState('');
  const [options, setOptions] = useState(defaultTableImportOptions('csv')),
    [encoding, setEncoding] = useState<TableImportEncoding>('auto');
  const [source, setSource] = useState<{
      text: string;
      parsed: TableImportParsed;
    } | null>(null),
    [mappings, setMappings] = useState<TableImportMapping[]>([]);
  const [targets, setTargets] = useState(columns),
    [plan, setPlan] = useState<TableImportPlan | null>(null),
    [serverReview, setServerReview] = useState<TableImportReview | null>(null);
  const [busy, setBusy] = useState<'file' | 'preview' | 'commit' | null>(null),
    [errorStored, setError] = useState<UiMessage>(''),
    [summary, setSummary] = useState<TableImportAppendSummary | null>(null);
  const error = uiText(errorStored, locale);
  const request = useRef<AbortController | null>(null),
    token = useRef<string | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    discardCallback = useRef(onDiscard);
  useEffect(() => {
    discardCallback.current = onDiscard;
  }, [onDiscard]);
  useEffect(
    () => () => {
      request.current?.abort();
      const current = token.current;
      token.current = null;
      if (current)
        void (
          discardCallback.current
            ? discardCallback.current(current)
            : backendFetch(`${base}/table-import/plans/${encodeURIComponent(current)}`, {
                method: 'DELETE',
              })
        ).catch(() => undefined);
    },
    [base],
  );
  function discard() {
    const current = token.current;
    token.current = null;
    setPlan(null);
    if (current)
      void (
        onDiscard
          ? onDiscard(current)
          : backendFetch(`${base}/table-import/plans/${encodeURIComponent(current)}`, {
              method: 'DELETE',
            })
      ).catch(() => undefined);
  }
  function invalidate() {
    request.current?.abort();
    request.current = null;
    discard();
    setServerReview(null);
    setError('');
    setBusy(null);
  }
  async function loadFile(selected: File) {
    invalidate();
    setSource(null);
    setFile(null);
    if (/\.(xls[xm]?|parquet|orc|zip)$/i.test(selected.name)) {
      setError(connectorUiMessages.message('thisFormatIsNotSupportedYetConvertItToCsv'));
      return;
    }
    if (selected.size > TABLE_IMPORT_LIMITS.bytes) {
      setError(connectorUiMessages.message('filesMustNotExceedMibSplitTheFileBeforeImporting'));
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy('file');
    try {
      const bytes = new Uint8Array(await selected.arrayBuffer());
      if (request.current !== controller || controller.signal.aborted) return;
      setFile({ name: selected.name, bytes });
      setOptions({
        ...defaultTableImportOptions(formatForName(selected.name)),
        sqlDialect: provider,
      });
      setStep('source');
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (request.current === controller && !controller.signal.aborted) setBusy(null);
    }
  }
  function parseSource() {
    invalidate();
    try {
      const text =
        sourceMode === 'file'
          ? file
            ? decodeTableImportBytes(file.bytes, encoding).text
            : ''
          : paste;
      if (!text) throw connectorUiMessages.error('selectAFileOrPasteDataFirst');
      const parsed = parseTableImport(text, options);
      setSource({ text, parsed });
      if (!parsed.errors.length) {
        setMappings(autoMapTableImportColumns(parsed.columns, targets));
        setStep('mapping');
      }
    } catch (reason) {
      setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    }
  }
  async function review() {
    if (!source) return;
    invalidate();
    const controller = new AbortController();
    request.current = controller;
    setBusy('preview');
    const input: TableImportInput = { schema, table, text: source.text, options, mappings };
    try {
      const response = onPreview
        ? await onPreview(input, controller.signal)
        : await backendFetch<TableImportPlan>(`${base}/table-import/plans`, {
            method: 'POST',
            body: JSON.stringify(input),
            signal: controller.signal,
          });
      if (request.current !== controller || controller.signal.aborted) {
        void (
          onDiscard
            ? onDiscard(response.planId)
            : backendFetch(`${base}/table-import/plans/${encodeURIComponent(response.planId)}`, {
                method: 'DELETE',
              })
        ).catch(() => undefined);
        return;
      }
      setServerReview(response.review);
      setTargets(response.review.targetColumns);
      if (response.review.validation.valid) {
        token.current = response.planId;
        setPlan(response);
        setStep('review');
      } else
        void (
          onDiscard
            ? onDiscard(response.planId)
            : backendFetch(`${base}/table-import/plans/${encodeURIComponent(response.planId)}`, {
                method: 'DELETE',
              })
        ).catch(() => undefined);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      if (request.current === controller && !controller.signal.aborted) setBusy(null);
    }
  }
  async function commit() {
    if (!plan || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy('commit');
    setError('');
    let completed: TableImportAppendSummary | undefined;
    try {
      const response = onAppend
        ? await onAppend(plan.planId, controller.signal)
        : await backendFetch<TableImportAppendSummary>(
            `${base}/table-import/plans/${encodeURIComponent(plan.planId)}/commit`,
            { method: 'POST', body: JSON.stringify({ confirm: true }), signal: controller.signal },
          );
      if (request.current !== controller || controller.signal.aborted) return;
      completed = response;
      token.current = null;
      setPlan(null);
      setSummary(response);
      setStep('done');
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? uiFailure(reason) : String(reason));
        discard();
        setStep('mapping');
      }
    } finally {
      if (request.current === controller && !controller.signal.aborted) setBusy(null);
    }
    if (completed) onImported?.(completed);
  }
  function cancel() {
    const committing = busy === 'commit';
    invalidate();
    if (committing) {
      setStep('mapping');
      setError(
        connectorUiMessages.message('requestCancelledNoCommitOutcomeReceivedRefreshTheTargetTable'),
      );
    }
  }
  function back() {
    invalidate();
    setStep(step === 'review' ? 'mapping' : 'source');
  }
  const localValidation = source
    ? validateTableImportMappings(source.parsed.columns, mappings, targets, provider)
    : null;
  const issues = [
    ...(source?.parsed.errors ?? []),
    ...(serverReview?.validation.errors ?? localValidation?.errors ?? []),
  ];
  const warnings = [
    ...new Set([...(source?.parsed.warnings ?? []), ...(serverReview?.validation.warnings ?? [])]),
  ];
  return (
    <section className={styles.panel} aria-label={tConnector('tableDataImport')} aria-busy={!!busy}>
      <header className={styles.heading}>
        <span className={styles.headingIcon}>
          <FileArrowUp size={20} />
        </span>
        <div>
          <h2>{tConnector('importTableData')}</h2>
          <p>
            <span>{schema}</span>
            <ArrowRight size={10} />
            <strong>{table}</strong>
            <span className={styles.appendBadge}>{tConnector('appendOnly')}</span>
          </p>
        </div>
        <span className={styles.limit}>{tConnector('mibRows')}</span>
      </header>
      <ol className={styles.steps} aria-label={tConnector('importProgress')}>
        {STEPS(locale).map(([value, label], index) => (
          <li
            key={value}
            data-active={step === value}
            data-complete={STEPS(locale).findIndex(([item]) => item === step) > index}
            aria-current={step === value ? 'step' : undefined}
          >
            <span>
              {STEPS(locale).findIndex(([item]) => item === step) > index ? (
                <Check size={12} />
              ) : (
                index + 1
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div className={styles.content}>
        {error && (
          <div className={styles.error} role="alert">
            <WarningCircle size={15} />
            <span>{error}</span>
          </div>
        )}
        {step === 'source' && (
          <>
            <div className={styles.sourceTabs}>
              <button
                type="button"
                data-active={sourceMode === 'file'}
                onClick={() => {
                  invalidate();
                  setSource(null);
                  setSourceMode('file');
                }}
              >
                {tConnector('chooseFile')}
              </button>
              <button
                type="button"
                data-active={sourceMode === 'text'}
                onClick={() => {
                  invalidate();
                  setSource(null);
                  setSourceMode('text');
                }}
              >
                {tConnector('pasteText')}
              </button>
            </div>
            {sourceMode === 'file' ? (
              <div
                className={styles.dropzone}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const selected = event.dataTransfer.files[0];
                  if (selected) void loadFile(selected);
                }}
              >
                <FileArrowUp size={29} />
                <strong>{file ? file.name : tConnector('dropAFileOrChooseALocalFile')}</strong>
                <p>
                  {file
                    ? tConnector('kibFileReadLocally', {
                        p0: String((file.bytes.byteLength / 1024).toFixed(1)),
                      })
                    : tConnector('csvTsvDelimitedTextJsonNdjsonAndInsertSql')}
                </p>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={busy === 'file'}
                  onClick={() => fileInput.current?.click()}
                >
                  {busy === 'file'
                    ? tConnector('reading')
                    : file
                      ? tConnector('changeFile')
                      : tConnector('chooseFile')}
                </button>
                <input
                  className={styles.fileInput}
                  ref={fileInput}
                  type="file"
                  accept=".csv,.tsv,.txt,.psv,.json,.jsonl,.ndjson,.sql"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) void loadFile(selected);
                    event.target.value = '';
                  }}
                />
              </div>
            ) : (
              <textarea
                className={styles.paste}
                value={paste}
                onChange={(event) => {
                  invalidate();
                  setSource(null);
                  setPaste(event.target.value);
                }}
                placeholder={'id,name\n1,Ada\n2,Grace'}
                aria-label={tConnector('pasteDataToImport')}
                spellCheck={false}
              />
            )}
            <TableImportParseControls
              options={options}
              encoding={encoding}
              hasFile={sourceMode === 'file'}
              onEncoding={(value) => {
                invalidate();
                setSource(null);
                setEncoding(value);
              }}
              onChange={(value) => {
                invalidate();
                setSource(null);
                setOptions(value);
              }}
            />
            <Issues issues={source?.parsed.errors ?? []} />
          </>
        )}
        {step === 'mapping' && source && (
          <>
            <TableImportMappingEditor
              parsed={source.parsed}
              targets={targets}
              mappings={mappings}
              provider={provider}
              onChange={(value) => {
                invalidate();
                setMappings(value);
              }}
            />
            <Issues issues={issues} />
            {warnings.length > 0 && (
              <div className={styles.warnings}>
                {warnings.map((warning) => (
                  <p key={warning.code}>
                    <WarningCircle size={13} />
                    {uiText(warning, locale)}
                  </p>
                ))}
              </div>
            )}
            <TableImportPreviewGrid parsed={source.parsed} />
          </>
        )}
        {step === 'review' && plan && (
          <>
            <div className={styles.reviewHeading}>
              <span>
                <Check size={20} />
              </span>
              <div>
                <strong>{tConnector('theServerValidatedThisImport')}</strong>
                <p>{tConnector('confirmationAppendsDataToTheCurrentTableAllBatchesShare')}</p>
              </div>
            </div>
            <div className={styles.reviewStats}>
              <div>
                <span>{tConnector('appendRecords')}</span>
                <strong>{plan.review.rowsToImport}</strong>
              </div>
              <div>
                <span>{tConnector('mappedColumns')}</span>
                <strong>{plan.review.validation.mappedColumns.length}</strong>
              </div>
              <div>
                <span>{tConnector('writeMethod')}</span>
                <strong>INSERT</strong>
              </div>
            </div>
            <div className={styles.reviewMapping}>
              {plan.review.mappings
                .filter((mapping) => mapping.targetColumn)
                .map((mapping) => (
                  <span key={mapping.sourceColumn}>
                    {mapping.sourceColumn}
                    <ArrowRight size={11} />
                    {mapping.targetColumn}
                  </span>
                ))}
            </div>
            {warnings.length > 0 && (
              <div className={styles.warnings}>
                {warnings.map((warning) => (
                  <p key={warning.code}>
                    <WarningCircle size={13} />
                    {uiText(warning, locale)}
                  </p>
                ))}
              </div>
            )}
            <TableImportPreviewGrid parsed={plan.review.parsed} />
            <p className={styles.hint}>
              {tConnector('thisReviewIsBoundToTheCurrentSessionTargetAnd')}
            </p>
          </>
        )}
        {step === 'done' && summary && (
          <div className={styles.success} role="status">
            <span>
              <Check size={29} />
            </span>
            <h3>{tConnector('importComplete')}</h3>
            <p>
              {tConnector('to')}
              <strong>
                {schema}.{table}
              </strong>
              {tConnector('appended')}
              <strong>{summary.rowsImported}</strong>
              {tConnector('rows')}
            </p>
            <small>
              {tConnector('transactionCommitted')}
              {summary.elapsedMs} ms
            </small>
          </div>
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {busy === 'commit' ? (
            <>
              <SpinnerGap size={13} className={styles.spinner} />
              {tConnector('appendingWaitingForTransactionCommit')}
            </>
          ) : busy === 'preview' ? (
            <>
              <SpinnerGap size={13} className={styles.spinner} />
              {tConnector('validatingTargetMetadataAndFieldValues')}
            </>
          ) : step === 'review' ? (
            tConnector('originalTableDataPreservedNoTableCreationNoTableEmptying')
          ) : (
            tConnector('fullScopeUpToColumnsCells')
          )}
        </span>
        <div>
          {busy && (
            <button type="button" className={styles.secondary} onClick={cancel}>
              {tConnector('cancelRequest')}
            </button>
          )}
          {!busy && step !== 'source' && step !== 'done' && (
            <button type="button" className={styles.secondary} onClick={back}>
              {tConnector('backToEditing')}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                cancel();
                onClose();
              }}
            >
              {step === 'done' ? tConnector('done') : tConnector('close')}
            </button>
          )}
          {step === 'source' && (
            <button
              type="button"
              className={styles.primary}
              disabled={!!busy || (sourceMode === 'file' ? !file : !paste)}
              onClick={parseSource}
            >
              {tConnector('previewAndMap')}
              <ArrowRight size={13} />
            </button>
          )}
          {step === 'mapping' && (
            <button
              type="button"
              className={styles.primary}
              disabled={!!busy || !localValidation?.valid || !!source?.parsed.errors.length}
              onClick={() => void review()}
            >
              {tConnector('serverReview')}
              <ArrowRight size={13} />
            </button>
          )}
          {step === 'review' && (
            <button
              type="button"
              className={styles.primary}
              disabled={!!busy || !plan}
              onClick={() => void commit()}
            >
              {tConnector('confirmAppend')}
              {plan?.review.rowsToImport}
              {tConnector('row')}
            </button>
          )}
          {step === 'done' && !onClose && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                invalidate();
                setSummary(null);
                setStep('source');
              }}
            >
              {tConnector('importMore')}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}
