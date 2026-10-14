'use client';

import { uiText, type UiMessage, uiFailure } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './panel.messages';
import { useMemo, useState } from 'react';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import type { RelationalTableStructure } from '@fouc/shared';
import {
  defaultTestDataConfig,
  generateTestDataPreview,
  validateTestDataConfig,
  TEST_DATA_LIMITS,
  type TestDataConfig,
  type TestDataPreview,
} from '@fouc/shared/test-data';
import { TableImportPreviewGrid } from '../table-import/preview-grid';
import { TestDataColumnEditor } from './column-editor';
import { useTestDataPlan } from './use-test-data-plan';
import styles from './test-data.module.css';
export interface TestDataPanelProps {
  base: string;
  structure: RelationalTableStructure;
  writable: boolean;
  onUnlock: () => Promise<void>;
  onBusyChange: (value: boolean) => void;
  onImported: () => void;
  onClose: () => void;
}
export function TestDataPanel(props: TestDataPanelProps) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const { structure, writable, onUnlock, onBusyChange, onClose } = props;
  const [config, setConfig] = useState<TestDataConfig>(() => defaultTestDataConfig(structure));
  const [selected, setSelected] = useState(
    () => config.columns.find((item) => item.enabled)?.column ?? config.columns[0]?.column ?? '',
  );
  const [sample, setSample] = useState<TestDataPreview | null>(null);
  const [sampleErrorStored, setSampleError] = useState<UiMessage>('');
  const sampleError = uiText(sampleErrorStored, locale);
  const [confirmed, setConfirmed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const validation = useMemo(() => validateTestDataConfig(structure, config), [structure, config]);
  const workflow = useTestDataPlan(props);
  const step = workflow.summary ? 2 : workflow.plan ? 1 : 0;
  function change(value: TestDataConfig) {
    setConfig(value);
    setSample(null);
    setSampleError('');
    setConfirmed(false);
  }
  function preview() {
    setSampleError('');
    try {
      setSample(generateTestDataPreview(structure, config));
    } catch (reason) {
      setSampleError(reason instanceof Error ? uiFailure(reason) : String(reason));
    }
  }
  async function unlock() {
    setUnlocking(true);
    onBusyChange(true);
    setSampleError('');
    try {
      await onUnlock();
    } catch (reason) {
      setSampleError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setUnlocking(false);
      onBusyChange(false);
    }
  }
  return (
    <section
      className={styles.panel}
      aria-label={tConnector('generateTestData')}
      aria-busy={!!workflow.busy || unlocking}
    >
      <header className={styles.heading}>
        <div>
          <h2>{structure.table}</h2>
          <p>
            <span>{structure.provider.toUpperCase()}</span>
            <ArrowRight size={10} />
            <span>{structure.schema}</span>
            <span className={styles.badge}>{tConnector('appendOnlyPreserveOriginalTable')}</span>
          </p>
        </div>
        <div className={styles.limits}>
          {tConnector('upTo')}
          {TEST_DATA_LIMITS.rows.toLocaleString(locale)}
          {tConnector('row')}
          <strong>{tConnector('mibCells')}</strong>
        </div>
      </header>
      <ol className={styles.steps} aria-label={tConnector('testDataGenerationProgress')}>
        {[
          tConnector('configurationAndSamples'),
          tConnector('nativeReview'),
          tConnector('appendComplete'),
        ].map((label, index) => (
          <li
            key={label}
            data-active={index === step}
            data-complete={index < step}
            aria-current={index === step ? 'step' : undefined}
          >
            <span>{index < step ? <Check size={12} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className={styles.content}>
        {(workflow.error || sampleError) && (
          <div className={styles.error} role="alert">
            <WarningCircle size={16} />
            <span>{workflow.error || sampleError}</span>
          </div>
        )}
        {workflow.summary ? (
          <div className={styles.success} role="status">
            <span>
              <Check size={27} />
            </span>
            <h3>{tConnector('testDataAppended')}</h3>
            <p>
              {tConnector('nativeTransactionReturned')}
              <strong>
                {workflow.summary.rowsImported.toLocaleString(locale)}
                {tConnector('row')}
              </strong>
              {tConnector('imported')}
            </p>
            <small>
              {workflow.summary.elapsedMs.toLocaleString(locale)} ms · {structure.schema}.
              {structure.table}
            </small>
            <p>{tConnector('targetTableRefreshedOriginalStructureAndExistingRecordsPreserved')}</p>
          </div>
        ) : workflow.plan ? (
          <>
            <div className={styles.reviewHeading}>
              <span>
                <Check size={20} />
              </span>
              <div>
                <h3>{tConnector('nativePreviewCompleteAwaitingConfirmation')}</h3>
                <p>{tConnector('thisStepDidNotInitiateWritesTheOneTimePlan')}</p>
              </div>
            </div>
            <div className={styles.stats}>
              <div>
                <span>{tConnector('rowsToAppend')}</span>
                <strong>{workflow.plan.review.rowsToImport.toLocaleString(locale)}</strong>
              </div>
              <div>
                <span>{tConnector('mappedColumns')}</span>
                <strong>{workflow.plan.review.validation.mappedColumns.length}</strong>
              </div>
              <div>
                <span>{tConnector('generatedSourceSize')}</span>
                <strong>
                  {(workflow.plan.review.parsed.sizeBytes / 1024).toFixed(1)}
                  <small> KiB</small>
                </strong>
              </div>
            </div>
            <div className={styles.mapping}>
              {workflow.plan.review.mappings.map((mapping) => (
                <span key={mapping.sourceColumn}>
                  {mapping.sourceColumn}
                  <ArrowRight size={11} />
                  {mapping.targetColumn}
                </span>
              ))}
            </div>
            <TableImportPreviewGrid parsed={workflow.plan.review.parsed} />
            <div className={styles.warnings}>
              {[
                ...new Set([...validation.warnings, ...workflow.plan.review.validation.warnings]),
              ].map((warning) => (
                <p key={warning.code}>
                  <WarningCircle size={12} />
                  {uiText(warning, locale)}
                </p>
              ))}
            </div>
            <label className={styles.confirmation}>
              <input
                type="checkbox"
                aria-label={tConnector('confirmAppendingGeneratedTestData')}
                checked={confirmed}
                disabled={!!workflow.busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                {tConnector('iConfirmAppendingTo')}
                <strong>
                  {structure.schema}.{structure.table}
                </strong>
                {tConnector('appended')}
                {workflow.plan.review.rowsToImport}
                {tConnector('rowsOfTestDataAndAcceptTheNativeBehaviorOf')}
              </span>
            </label>
            {!writable && (
              <div className={styles.error} role="alert">
                {tConnector('writePermissionsAreLockedReturnToConfigurationExplicitlyUnlockThen')}
              </div>
            )}
          </>
        ) : (
          <>
            <fieldset className={styles.configuration} disabled={!!workflow.busy || unlocking}>
              <div className={styles.tableOptions}>
                <label>
                  {tConnector('rowsToGenerate')}
                  <input
                    aria-label={tConnector('testDataRowCount')}
                    type="number"
                    min={1}
                    max={TEST_DATA_LIMITS.rows}
                    value={config.rowCount}
                    onChange={(event) =>
                      change({ ...config, rowCount: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  {tConnector('reproducibleSeed')}
                  <input
                    aria-label={tConnector('testDataSeed')}
                    value={config.seed}
                    maxLength={200}
                    onChange={(event) => change({ ...config, seed: event.target.value })}
                  />
                </label>
                <p>
                  {tConnector('theSameStructureSeedAndColumnConfigurationProduceTheSame')}
                  <br />
                  {tConnector('samplesGenerateOnlyTheFirst')}
                  {TEST_DATA_LIMITS.sampleRows}
                  {tConnector('rowsWithoutReadingOrWritingTargetData')}
                </p>
              </div>
              <TestDataColumnEditor
                structure={structure}
                config={config}
                selected={selected}
                onSelect={setSelected}
                onChange={change}
              />
            </fieldset>
            {validation.errors.length > 0 && (
              <div className={styles.issues} role="alert">
                <strong>{tConnector('correctTheConfigurationFirst')}</strong>
                <ul>
                  {validation.errors.slice(0, 12).map((issue, index) => (
                    <li key={index}>
                      {issue.column && <code>{issue.column}：</code>}
                      {uiText(issue, locale)}
                    </li>
                  ))}
                </ul>
                {validation.errors.length > 12 && (
                  <span>
                    {tConnector('another')}
                    {validation.errors.length - 12}
                    {tConnector('issues')}
                  </span>
                )}
              </div>
            )}
            <div className={styles.sampleBar}>
              <div>
                <strong>{tConnector('localReadOnlySample')}</strong>
                <span>{tConnector('showsAtMostTheFirstRowsTheFullBatchIs')}</span>
              </div>
              <button
                type="button"
                className={styles.secondary}
                disabled={!validation.valid || !!workflow.busy || unlocking}
                onClick={preview}
              >
                {sample ? tConnector('regenerateSample') : tConnector('viewSample')}
              </button>
            </div>
            {sample && <TableImportPreviewGrid parsed={sample.parsed} />}
            <details className={styles.boundaries}>
              <summary>{tConnector('generationScopeAndConstraints')}</summary>
              {validation.warnings.map((warning) => (
                <p key={warning.code}>{uiText(warning, locale)}</p>
              ))}
              <p>{tConnector('currentlySupportsBoundedAppendToOneTableForeignKeySampling')}</p>
            </details>
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {workflow.busy ? (
            <>
              <SpinnerGap className={styles.spinner} size={14} />
              {workflow.busy === 'generate'
                ? tConnector('generatingLocally', {
                    p0: String(workflow.progress),
                    p1: String(config.rowCount),
                  })
                : workflow.busy === 'preview'
                  ? tConnector('nativeColumnAndTypeReview')
                  : tConnector('nativeAppendTransactionRunning')}
            </>
          ) : writable ? (
            <>
              <LockOpen size={13} />
              {tConnector('writesUnlockedCommitStillRequiresExplicitConfirmation')}
            </>
          ) : (
            tConnector('readOnlyLocalSamplesAvailable')
          )}
        </span>
        <div>
          {workflow.busy ? (
            <button type="button" className={styles.secondary} onClick={workflow.cancel}>
              {tConnector('cancelRequest')}
            </button>
          ) : workflow.summary ? (
            <>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  workflow.back();
                  setConfirmed(false);
                }}
              >
                {tConnector('continueConfiguration')}
              </button>
              <button type="button" className={styles.primary} onClick={onClose}>
                {tConnector('done')}
              </button>
            </>
          ) : workflow.plan ? (
            <>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  workflow.back();
                  setConfirmed(false);
                }}
              >
                {tConnector('backToConfiguration')}
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={!confirmed || !writable}
                onClick={() => void workflow.append(confirmed)}
              >
                {tConnector('confirmAppend')}
                {workflow.plan.review.rowsToImport}
                {tConnector('row')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondary}
                disabled={unlocking}
                onClick={onClose}
              >
                {tConnector('close')}
              </button>
              {!writable ? (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!validation.valid || unlocking}
                  onClick={() => void unlock()}
                >
                  <LockOpen size={14} />
                  {unlocking ? tConnector('unlocking') : tConnector('unlockWritesForThisSession')}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!validation.valid || unlocking}
                  onClick={() => void workflow.prepare(config)}
                >
                  {tConnector('generateFullBatchAndReview')}
                  <ArrowRight size={13} />
                </button>
              )}
            </>
          )}
        </div>
      </footer>
    </section>
  );
}
