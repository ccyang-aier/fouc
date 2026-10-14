'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import type { RelationalSession } from '@fouc/shared';
import { SqlDialog } from '../sql-library-dialog';
import { TableClearReviewContent } from './review';
import { TableClearResultContent } from './result';
import { useTableClear } from './use-table-clear';
import styles from './table-clear.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
export interface TableClearActionProps {
  base: string;
  session: RelationalSession;
  schema: string;
  table: string;
  writable: boolean;
  disabled: boolean;
  onUnlock: () => Promise<void>;
  onCleared: () => void;
  onBusyChange: (busy: boolean) => void;
}
export function TableClearAction(props: TableClearActionProps) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.action}
        aria-label={tConnector('emptyCurrentDataTable')}
        disabled={props.disabled || !props.table}
        onClick={() => setOpen(true)}
      >
        <Trash size={14} />
        <span>{tConnector('emptyTable')}</span>
      </button>
      {open && (
        <TableClearDialog
          key={`${props.base}:${props.schema}:${props.table}`}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
function TableClearDialog({
  base,
  session,
  schema,
  table,
  writable,
  onUnlock,
  onCleared,
  onBusyChange,
  onClose,
}: TableClearActionProps & {
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const flow = useTableClear(base, onCleared, onBusyChange);
  const [identity, setIdentity] = useState(false),
    [triggers, setTriggers] = useState(false);
  const [confirmedName, setConfirmedName] = useState(''),
    [dirty, setDirty] = useState(false);
  const [unlocking, setUnlocking] = useState(false),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const notice = uiText(noticeStored, locale);
  const [clock, setClock] = useState(() => Date.now());
  const body = useRef<HTMLDivElement>(null);
  const input = useMemo(
    () => ({ schema, table, acknowledgeIdentityReset: identity, acknowledgeTriggers: triggers }),
    [schema, table, identity, triggers],
  );
  const { preview } = flow;
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed)
        void preview({
          schema,
          table,
          acknowledgeIdentityReset: false,
          acknowledgeTriggers: false,
        });
    });
    return () => {
      disposed = true;
    };
  }, [preview, schema, table]);
  useEffect(() => {
    if (!flow.prepared || flow.result) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [flow.prepared, flow.result]);
  useEffect(() => {
    if (flow.result && body.current) body.current.scrollTop = 0;
  }, [flow.result]);
  const review = flow.prepared?.review;
  const remaining = flow.prepared
    ? Math.max(0, Math.ceil((flow.prepared.expiresAt - clock) / 1000))
    : 0;
  const committing = flow.busy === 'commit';
  const canCommit = Boolean(
    review &&
    writable &&
    !dirty &&
    !flow.busy &&
    !unlocking &&
    remaining &&
    !review.blockedReasons.length &&
    confirmedName === review.confirmationName,
  );
  async function refresh() {
    setConfirmedName('');
    setNotice('');
    setDirty(false);
    setClock(Date.now());
    await flow.preview(input);
  }
  async function unlock() {
    setUnlocking(true);
    setNotice('');
    setConfirmedName('');
    try {
      await onUnlock();
      await refresh();
      setNotice(connectorUiMessages.message('unlockedAndReviewedAgainInReadOnlyModeEnterThe'));
    } catch (reason) {
      setNotice(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setUnlocking(false);
    }
  }
  async function copy() {
    if (!review) return;
    try {
      await navigator.clipboard.writeText(review.sql);
      setNotice(
        flow.result
          ? connectorUiMessages.message('fullControlledSqlCopied')
          : connectorUiMessages.message('fullControlledSqlCopiedNotExecuted'),
      );
    } catch {
      setNotice(connectorUiMessages.message('copyFailedSelectAndCopyTheSqlManually'));
    }
  }
  return (
    <SqlDialog
      title={tConnector('emptyDataTable')}
      onClose={onClose}
      busy={committing || unlocking}
      className={styles.dialog}
    >
      <div className={styles.body} ref={body}>
        <div className={styles.target}>
          <span>{tConnector('targetNativeTable')}</span>
          <strong>
            {schema}.{table}
          </strong>
          <small>
            {session.provider === 'postgres'
              ? 'PostgreSQL'
              : session.provider === 'mysql'
                ? 'MySQL'
                : 'SQLite'}
            {tConnector('allDataStructurePreserved')}
          </small>
        </div>
        {flow.busy === 'preview' && (
          <div className={styles.loading} role="status">
            <SpinnerGap className="mw-spin" size={18} />
            {tConnector('readingActualStructureReferencesPermissionsAndCurrentlyVisibleRowCount')}
            <small>{tConnector('readOnlyReviewNoDataHasBeenEmptied')}</small>
          </div>
        )}
        {review && (
          <>
            {flow.result && <TableClearResultContent result={flow.result} />}
            <TableClearReviewContent review={review} />
            {!flow.result && (
              <>
                {review.identity === 'reset' && (
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={identity}
                      disabled={Boolean(flow.busy) || unlocking}
                      onChange={(event) => {
                        setIdentity(event.target.checked);
                        setDirty(true);
                        setConfirmedName('');
                      }}
                    />
                    <span>
                      {tConnector('iExplicitlyAcceptResettingMysqlAutoIncrement')}
                      <small>
                        {tConnector('changingThisChoiceRequiresANewReviewResetIsBlocked')}
                      </small>
                    </span>
                  </label>
                )}
                {review.triggers.length > 0 && (
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={triggers}
                      disabled={Boolean(flow.busy) || unlocking}
                      onChange={(event) => {
                        setTriggers(event.target.checked);
                        setDirty(true);
                        setConfirmedName('');
                      }}
                    />
                    <span>
                      {tConnector('iHaveReviewedNativeTriggersAndTheirImpactOnOther')}
                      <small>
                        {tConnector('triggerCodeComesFromTheCurrentDatabaseCatalogAndMay')}
                      </small>
                    </span>
                  </label>
                )}
                {dirty && (
                  <p className={styles.caption} role="status">
                    {tConnector('riskChoicesChangedReadAndReviewAgain')}
                  </p>
                )}
                {!writable && (
                  <div className={styles.unlock}>
                    <LockOpen size={18} />
                    <span>
                      {tConnector('theSessionCurrentlyLocksWritesUnlockingRevokesTheOldPlan')}
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(flow.busy) || unlocking}
                      onClick={() => void unlock()}
                    >
                      {unlocking
                        ? tConnector('unlockingAndReviewingAgain')
                        : tConnector('unlockTableEmptying')}
                    </button>
                  </div>
                )}
                <label className={styles.confirm}>
                  <strong>
                    {tConnector('dangerousActionConfirmationEnterTheFullSchemaTableName')}
                  </strong>
                  <code>{review.confirmationName}</code>
                  <input
                    aria-label={tConnector('fullTableNameForDangerousEmptyTableConfirmation')}
                    autoComplete="off"
                    spellCheck={false}
                    value={confirmedName}
                    disabled={
                      !writable ||
                      committing ||
                      unlocking ||
                      dirty ||
                      !remaining ||
                      Boolean(review.blockedReasons.length)
                    }
                    onChange={(event) => setConfirmedName(event.target.value)}
                    placeholder={review.confirmationName}
                  />
                  <small>{tConnector('confirmationRemovesAllDataInTheTableThisActionIs')}</small>
                </label>
              </>
            )}
          </>
        )}
        {flow.error && (
          <p className={styles.error} role="alert">
            {flow.error}
          </p>
        )}
        {notice && (
          <p className={styles.caption} role="status">
            {notice}
          </p>
        )}
        {committing && (
          <p className={styles.caption} role="status">
            {tConnector('waitingForFinalConfirmationFromTheNativeServer')}
            {session.provider === 'mysql'
              ? tConnector('aCommittedTruncateCannotBeUndone')
              : tConnector('interruptionsBeforeCommitAreHandledByTheTransactionANetwork')}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <button type="button" disabled={committing || unlocking} onClick={onClose}>
          {flow.result ? tConnector('close') : tConnector('cancel')}
        </button>
        <span>
          {flow.result
            ? tConnector('planAlreadyConsumed')
            : flow.prepared
              ? remaining
                ? tConnector('planExpiresIn', {
                    p0: String(Math.floor(remaining / 60)),
                    p1: String(String(remaining % 60).padStart(2, '0')),
                  })
                : tConnector('planExpired')
              : tConnector('reviewWithoutWrites')}
        </span>
        {review && (
          <button
            type="button"
            disabled={committing || unlocking}
            aria-label={tConnector('copyEmptyTableSql')}
            onClick={() => void copy()}
          >
            <Copy size={14} />
          </button>
        )}
        {!flow.result && (
          <>
            <button
              type="button"
              disabled={Boolean(flow.busy) || unlocking}
              onClick={() => void refresh()}
            >
              {flow.busy === 'preview'
                ? tConnector('readOnlyReview')
                : tConnector('readAndReviewAgain')}
            </button>
            <button
              type="button"
              className={styles.danger}
              disabled={!canCommit}
              onClick={() => {
                setNotice('');
                void flow.commit(confirmedName);
              }}
            >
              {committing ? <SpinnerGap className="mw-spin" size={14} /> : <Trash size={14} />}
              {committing
                ? tConnector('waitingForNativeConfirmation')
                : tConnector('confirmEmptyingTheEntireTable')}
            </button>
          </>
        )}
      </footer>
    </SqlDialog>
  );
}
