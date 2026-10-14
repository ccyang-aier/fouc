'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './import-dialog.messages';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, FileArrowUp, ShieldCheck, Spinner } from '@phosphor-icons/react';
import {
  CONNECTION_CONFIG_LIMITS,
  type ConnectionConfigBundle,
} from '@fouc/shared/connection-config-transfer';
import { decodeConnectionConfigFile } from '@fouc/shared/connection-config-transfer-crypto';
import {
  defaultConnectionImportChoices,
  prepareConnectionImport,
  type ExistingTransferConnection,
  type ImportConnectionChoice,
} from '@fouc/shared/connection-config-transfer-plan';
import { SqlDialog } from '../sql-library-dialog';
import { ConnectionImportReview } from './import-review';
import { runConnectionImport, type ConnectionImportOutcome } from './operations';
import { readTransferConnections, saveTransferredConnection } from './transport';
import common from '../relational.module.css';
import styles from './transfer.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Source = {
  name: string;
  text: string;
  encrypted: boolean;
};
type Review = {
  bundle: ConnectionConfigBundle;
  existing: ExistingTransferConnection[];
  choices: ImportConnectionChoice[];
};
export function ImportConnectionDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [source, setSource] = useState<Source | null>(null),
    [passphrase, setPassphrase] = useState('');
  const [review, setReview] = useState<Review | null>(null),
    [outcomes, setOutcomes] = useState<readonly ConnectionImportOutcome[]>([]);
  const [phase, setPhase] = useState<'idle' | 'read' | 'write'>('idle'),
    [errorStored, setError] = useState<UiMessage>(''),
    [feedbackStored, setFeedback] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  const feedback = uiText(feedbackStored, locale);
  const job = useRef<AbortController | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      job.current?.abort();
    };
  }, []);
  const { plan, planError } = useMemo(() => {
    if (!review) return { plan: null, planError: '' };
    try {
      return {
        plan: prepareConnectionImport(review.bundle, review.existing, review.choices),
        planError: '',
      };
    } catch (reason) {
      return {
        plan: null,
        planError:
          reason instanceof Error ? uiText(reason, locale) : tConnector('invalidImportPlan'),
      };
    }
  }, [review, tConnector, locale]);
  async function readFile(file: File) {
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setPhase('read');
    setSource(null);
    setReview(null);
    setOutcomes([]);
    setError('');
    setFeedback('');
    setPassphrase('');
    try {
      if (file.size > CONNECTION_CONFIG_LIMITS.fileBytes)
        throw connectorUiMessages.error('configurationFilesMustNotExceedMib');
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      } catch {
        throw connectorUiMessages.error('theConfigurationFileMustBeUtfJsonText');
      }
      controller.signal.throwIfAborted();
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw connectorUiMessages.error('theConfigurationFileIsNotValidJson');
      }
      setSource({
        name: file.name,
        text,
        encrypted:
          !!value &&
          typeof value === 'object' &&
          'format' in value &&
          value.format === 'fouc-connection-config-encrypted',
      });
    } catch (reason) {
      if (!controller.signal.aborted && alive.current)
        setError(
          reason instanceof Error
            ? uiFailure(reason)
            : connectorUiMessages.message('couldNotReadTheFile'),
        );
    } finally {
      if (!controller.signal.aborted && alive.current) setPhase('idle');
    }
  }
  async function inspect() {
    if (!source || phase !== 'idle') return;
    const controller = new AbortController();
    job.current = controller;
    setPhase('read');
    setError('');
    setFeedback('');
    try {
      const bundle = await decodeConnectionConfigFile(source.text, passphrase, controller.signal);
      const existing = await readTransferConnections(controller.signal);
      controller.signal.throwIfAborted();
      setReview({
        bundle,
        existing,
        choices: defaultConnectionImportChoices(bundle, existing),
      });
      setPassphrase('');
      setOutcomes([]);
    } catch (reason) {
      if (!controller.signal.aborted && alive.current)
        setError(
          reason instanceof Error
            ? uiFailure(reason)
            : connectorUiMessages.message('configurationValidationFailed'),
        );
    } finally {
      if (!controller.signal.aborted && alive.current) setPhase('idle');
    }
  }
  async function perform() {
    if (!review || !plan || phase !== 'idle' || outcomes.length) return;
    const controller = new AbortController();
    job.current = controller;
    setPhase('write');
    setError('');
    setFeedback('');
    try {
      const result = await runConnectionImport(
        {
          ...review,
          port: {
            list: () => readTransferConnections(controller.signal),
            save: (entry, id) => saveTransferredConnection(entry, id),
          },
          signal: controller.signal,
          onProgress: (next) => {
            if (alive.current) setOutcomes(next);
          },
        },
        locale,
      );
      const saved = result.filter((item) => item.status === 'saved').length,
        failed = result.filter((item) => item.status === 'failed').length,
        cancelled = result.filter((item) => item.status === 'cancelled').length,
        skipped = result.filter((item) => item.status === 'skipped').length;
      if (alive.current)
        setFeedback(
          connectorUiMessages.message('savedFailedSkipped', {
            p0: String(saved),
            p1: String(failed),
            p2: String(skipped),
            p3: cancelled
              ? connectorUiMessages.message('cancelled', { p0: String(cancelled) })
              : '',
          }),
        );
      if (saved) onImported();
    } catch (reason) {
      if (alive.current) {
        if (controller.signal.aborted)
          setFeedback(connectorUiMessages.message('cancelledBeforeSavingAnyConnections'));
        else
          setError(
            reason instanceof Error
              ? uiFailure(reason)
              : connectorUiMessages.message('couldNotImportConfigurations'),
          );
      }
    } finally {
      if (alive.current) setPhase('idle');
    }
  }
  function cancel() {
    job.current?.abort();
    if (phase === 'write')
      setFeedback(
        connectorUiMessages.message(
          'stoppingSubsequentImportsActualResultsWillAppearAfterTheCurrent',
        ),
      );
    else {
      setPhase('idle');
      onClose();
    }
  }
  return (
    <SqlDialog
      title={tConnector('importConnectionConfigurations')}
      busy={phase !== 'idle'}
      className={styles.dialog}
      onClose={onClose}
    >
      <div className={styles.body}>
        <div className={styles.scope}>
          <ShieldCheck size={15} />
          <span>{tConnector('importToTheCurrentDeviceFoucPublicConfigurationsOnlySaving')}</span>
        </div>
        {!review ? (
          <>
            <label className={styles.upload}>
              <FileArrowUp size={25} />
              <strong>{source?.name ?? tConnector('chooseAConnectionConfigurationFile')}</strong>
              <span>{tConnector('publicJsonOrPassphraseEncryptedFoucJsonMaximumMib')}</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={phase !== 'idle'}
                aria-label={tConnector('chooseAConnectionConfigurationFile')}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void readFile(file);
                }}
              />
            </label>
            {source?.encrypted && (
              <label className={styles.field}>
                {tConnector('decryptionPassphrase')}
                <input
                  type="password"
                  autoComplete="off"
                  value={passphrase}
                  disabled={phase !== 'idle'}
                  maxLength={1024}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
            )}
            <p className={styles.hint}>
              {tConnector('supportsPostgresqlMysqlSqliteRedisAndMongodbFormatsAndCredential')}
            </p>
          </>
        ) : (
          <>
            <div className={styles.reviewHead}>
              <div>
                <strong>
                  {review.bundle.connections.length}
                  {tConnector('validatedConnections')}
                </strong>
                <small>
                  {source?.name}
                  {tConnector('eachTypeImportsIntoItsCorrespondingConnectionDirectory')}
                </small>
              </div>
              {!outcomes.length && (
                <button
                  type="button"
                  disabled={phase !== 'idle'}
                  onClick={() => {
                    setReview(null);
                    setError('');
                  }}
                >
                  <ArrowLeft size={13} />
                  {tConnector('chooseAgain')}
                </button>
              )}
            </div>
            <ConnectionImportReview
              {...review}
              disabled={phase !== 'idle' || !!outcomes.length}
              outcomes={outcomes}
              onChange={(index, choice) =>
                setReview((current) =>
                  current
                    ? {
                        ...current,
                        choices: current.choices.map((previous, candidate) =>
                          candidate === index ? choice : previous,
                        ),
                      }
                    : current,
                )
              }
            />
            {!outcomes.length && (
              <p className={styles.hint}>
                {tConnector('newConnectionsAreCreatedByDefaultWithDuplicatesRenamedExisting')}
              </p>
            )}
          </>
        )}
        {phase !== 'idle' && (
          <p className={styles.progress} role="status">
            <Spinner size={15} className={styles.spin} />
            {phase === 'write'
              ? tConnector('savingCompleted', {
                  p0: String(outcomes.filter((item) => item.status !== 'pending').length),
                  p1: String(outcomes.length || review?.bundle.connections.length || 0),
                })
              : tConnector('readingDecryptingAndValidatingConfigurations')}
          </p>
        )}
        {planError && (
          <p className={styles.error} role="alert">
            {planError}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {feedback && (
          <p className={styles.success} role="status">
            <CheckCircle size={15} />
            {feedback}
          </p>
        )}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}>
        <span>
          {plan
            ? tConnector('createUpdateSkip', {
                p0: String(plan.create),
                p1: String(plan.update),
                p2: String(plan.skip),
              })
            : tConnector('doesNotReadDatabaseContents')}
        </span>
        <button type="button" className={common.secondary} onClick={cancel}>
          {phase === 'write'
            ? tConnector('stopSubsequentImports')
            : outcomes.length
              ? tConnector('close')
              : tConnector('cancel')}
        </button>
        {!review ? (
          <button
            type="button"
            className={common.primary}
            disabled={
              !source ||
              phase !== 'idle' ||
              (source.encrypted && Array.from(passphrase).length < 12)
            }
            onClick={() => void inspect()}
          >
            {tConnector('validateAndPreview')}
          </button>
        ) : (
          !outcomes.length && (
            <button
              type="button"
              className={common.primary}
              disabled={phase !== 'idle' || !plan || plan.create + plan.update === 0}
              onClick={() => void perform()}
            >
              {tConnector('confirmImport')}
              {plan ? plan.create + plan.update : 0}
              {tConnector('connections')}
            </button>
          )
        )}
      </footer>
    </SqlDialog>
  );
}
