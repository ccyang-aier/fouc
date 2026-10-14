'use client';
import { uiText, type UiMessage, createUiMessages } from '../../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useEffect, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { TreeStructure } from '@phosphor-icons/react/dist/csr/TreeStructure';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type { RelationalSession } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import { IndexDesigner } from './designer';
import { useIndexEdit } from './use-index-edit';
import styles from './index-edit.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);

interface Props {
  base: string;
  schema: string;
  table: string;
  disabled: boolean;
  onChanged: () => void;
  onWriteAccessChanged?: (session: RelationalSession) => void;
}
export function IndexEditAction(props: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        disabled={props.disabled}
        aria-label={tConnector('manageStandaloneIndexes')}
        onClick={() => setOpen(true)}
      >
        <TreeStructure size={14} />
        <span>{tConnector('manageIndexes')}</span>
      </button>
      {open && (
        <IndexDialog
          key={`${props.base}:${props.schema}:${props.table}`}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
function IndexDialog({
  base,
  schema,
  table,
  onChanged,
  onWriteAccessChanged,
  onClose,
}: Props & {
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const flow = useIndexEdit(base, schema, table, onChanged, onWriteAccessChanged);
  const [confirmed, setConfirmed] = useState(false);
  const [dropName, setDropName] = useState('');
  const [noticeStored, setNotice] = useState<UiMessage>('');
  const notice = uiText(noticeStored, locale);
  const [clock, setClock] = useState(() => Date.now());
  const review = flow.prepared?.review;
  const remaining = flow.prepared
    ? Math.max(0, Math.min(300, Math.ceil((flow.prepared.expiresAt - clock) / 1000)))
    : 0;
  const locked = flow.busy === 'commit' || flow.busy === 'unlock';
  const dropConfirmed = review?.operation !== 'drop' || dropName === review.index;
  useEffect(() => {
    if (!flow.prepared) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [flow.prepared]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(review!.sql);
      setNotice(connectorUiMessages.message('completeIndexDdlCopied'));
    } catch {
      setNotice(
        connectorUiMessages.message('clipboardAccessUnavailableSelectAndCopyTheDdlManually'),
      );
    }
  }
  const feedback = (
    <>
      {flow.error && (
        <div className={styles.error} role="alert">
          <Warning size={15} />
          <span>{flow.error}</span>
          {!review && (
            <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.load()}>
              {tConnector('reload')}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
    </>
  );
  return (
    <SqlDialog
      title={tConnector('nativeIndexManagement')}
      className={styles.dialog}
      busy={locked}
      onClose={onClose}
    >
      <div className={styles.context}>
        <TreeStructure size={17} />
        <div>
          <strong>
            {schema}.{table}
          </strong>
          <span>
            {flow.options?.provider === 'postgres'
              ? 'PostgreSQL'
              : flow.options?.provider === 'mysql'
                ? 'MySQL'
                : flow.options?.provider === 'sqlite'
                  ? 'SQLite'
                  : tConnector('nativeTableIndexes')}
            {tConnector('standaloneIndexes')}
          </span>
        </div>
        <span className={styles.badge}>
          {flow.result
            ? tConnector('executionResults')
            : review
              ? tConnector('readOnlyDdlReview')
              : tConnector('indexDesign')}
        </span>
      </div>
      {!review && flow.options ? (
        <IndexDesigner
          options={flow.options}
          busy={Boolean(flow.busy)}
          onClose={onClose}
          onPreview={async (input) => {
            setConfirmed(false);
            setDropName('');
            setNotice('');
            await flow.preview(input);
          }}
        >
          {feedback}
        </IndexDesigner>
      ) : (
        <>
          <div className={styles.body}>
            {review ? (
              <>
                <div className={styles.reviewHead}>
                  <strong>
                    {review.operation === 'drop' ? tConnector('delete') : tConnector('create')}{' '}
                    {review.index}
                  </strong>
                  <span>
                    {review.transaction === 'atomic'
                      ? tConnector('nativeTransaction')
                      : tConnector('implicitCommit')}{' '}
                    ·{' '}
                    {flow.result
                      ? tConnector('planAlreadyConsumed')
                      : remaining
                        ? tConnector('valid', {
                            p0: String(Math.floor(remaining / 60)),
                            p1: String(String(remaining % 60).padStart(2, '0')),
                          })
                        : tConnector('planInvalidated')}
                  </span>
                  <button
                    type="button"
                    aria-label={tConnector('copyCompleteIndexDdl')}
                    onClick={() => void copy()}
                  >
                    <Copy size={13} />
                    {tConnector('copyDdl')}
                  </button>
                </div>
                <pre className={styles.sql} aria-label={tConnector('completeIndexDdl')}>
                  {review.sql}
                </pre>
                {review.existing?.definition && (
                  <details className={styles.existing}>
                    <summary>{tConnector('viewTheCurrentNativeIndexDefinition')}</summary>
                    <pre>{review.existing.definition}</pre>
                  </details>
                )}
                <ul className={styles.warnings}>
                  {review.warnings.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                {!flow.result && (
                  <div className={styles.confirmation}>
                    {!flow.writable ? (
                      <div className={styles.unlock}>
                        <LockOpen size={17} />
                        <span>
                          {tConnector('theSessionIsReadOnlyDdlReviewDidNotWrite')}
                          <small>
                            {tConnector(
                              'unlockingEnablesWritesOnlySeparateConfirmationBelowIsStillRequired',
                            )}
                          </small>
                        </span>
                        <button
                          type="button"
                          disabled={Boolean(flow.busy)}
                          onClick={() => void flow.unlock()}
                        >
                          {flow.busy === 'unlock'
                            ? tConnector('unlocking')
                            : tConnector('explicitlyUnlockWrites')}
                        </button>
                      </div>
                    ) : (
                      <p className={styles.unlocked}>
                        <CheckCircle size={15} />
                        {tConnector('writesAreUnlockedForTheCurrentSession')}
                      </p>
                    )}
                    {review.operation === 'drop' && (
                      <label className={styles.dropConfirm}>
                        {tConnector('enterTheCompleteIndexNameToConfirmDangerousDeletion')}
                        <input
                          aria-label={tConnector('confirmIndexNameToDelete')}
                          value={dropName}
                          disabled={locked}
                          placeholder={review.index}
                          autoComplete="off"
                          onChange={(event) => setDropName(event.target.value)}
                        />
                      </label>
                    )}
                    <label className={styles.confirmCheck}>
                      <input
                        type="checkbox"
                        aria-label={tConnector('confirmIndexDdl')}
                        checked={confirmed}
                        disabled={locked}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      <span>
                        {tConnector('iHaveReviewedTheTargetCompleteDdlAnd')}
                        {review.operation === 'drop'
                          ? tConnector('irreversibleEffectsOfDeletion')
                          : tConnector('uniquenessAndBuildEffects')}
                        {tConnector('andConfirmExecutionOfThisOneTimePlan')}
                      </span>
                    </label>
                  </div>
                )}
                {flow.result && (
                  <div
                    className={`${styles.result} ${flow.result.outcome === 'created' || flow.result.outcome === 'dropped' ? styles.success : styles.failure}`}
                    role="status"
                  >
                    <strong>
                      {flow.result.outcome === 'created'
                        ? tConnector('indexCreated')
                        : flow.result.outcome === 'dropped'
                          ? tConnector('indexDeleted')
                          : flow.result.outcome === 'unknown'
                            ? tConnector('resultUnconfirmed')
                            : tConnector('executionUnsuccessful')}
                    </strong>
                    <p>{flow.result.message}</p>
                    <small>
                      {flow.result.executionTimeMs.toFixed(0)}
                      {tConnector('msVerifyAgainstTheRefreshedNativeStructure')}
                    </small>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.loading}>
                <SpinnerGap size={17} className="mw-spin" />
                <span>{tConnector('readingActualColumnsIndexesAndNativeCapabilities')}</span>
              </div>
            )}
            {feedback}
          </div>
          <footer className={styles.footer}>
            <button type="button" disabled={locked} onClick={onClose}>
              {flow.result ? tConnector('done') : tConnector('close')}
            </button>
            {review && !flow.result && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setConfirmed(false);
                  setDropName('');
                  setNotice('');
                  void flow.edit();
                }}
              >
                {tConnector('backToEditing')}
              </button>
            )}
            <span />
            {review && !flow.result && (
              <button
                className={review.operation === 'drop' ? styles.destructive : styles.primary}
                type="button"
                disabled={
                  Boolean(flow.busy) ||
                  !flow.writable ||
                  !confirmed ||
                  !dropConfirmed ||
                  remaining === 0
                }
                onClick={() => void flow.commit()}
              >
                {flow.busy === 'commit'
                  ? tConnector('executingNativeChanges')
                  : review.operation === 'drop'
                    ? tConnector('confirmIndexDeletion')
                    : tConnector('confirmIndexCreation')}
              </button>
            )}
          </footer>
        </>
      )}
    </SqlDialog>
  );
}
