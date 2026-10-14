'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useEffect, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type { RelationalSession } from '@fouc/shared';
import { schemaCreateNameError } from '@fouc/shared/schema-create';
import { SqlDialog } from '../sql-library-dialog';
import { useSchemaCreate } from './use-schema-create';
import styles from './schema-create.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
interface Props {
  session: RelationalSession;
  base: string;
  writable: boolean;
  disabled: boolean;
  onUnlock: () => Promise<void>;
  onCreated: (name: string) => void;
  onBusyChange: (busy: boolean) => void;
}
export function SchemaCreateAction(props: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  const supported = props.session.provider !== 'sqlite';
  const label =
    props.session.provider === 'postgres'
      ? tConnector('newSchema')
      : props.session.provider === 'mysql'
        ? tConnector('newDatabase')
        : tConnector('sqliteDoesNotSupportCreatingResources');
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        disabled={props.disabled || !supported}
        title={
          supported ? label : tConnector('sqliteUsesTheCurrentDatabaseFileOnlyAndCannotCreate')
        }
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <Plus size={14} />
        <span>{supported ? label : tConnector('newResource')}</span>
      </button>
      {open && <CreateDialog key={props.base} {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
function CreateDialog({
  session,
  base,
  writable,
  onUnlock,
  onCreated,
  onBusyChange,
  onClose,
}: Props & {
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const flow = useSchemaCreate(base, onCreated, onBusyChange);
  const [name, setName] = useState('');
  const [charset, setCharset] = useState('');
  const [collation, setCollation] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockErrorStored, setUnlockError] = useState<UiMessage>('');
  const unlockError = uiText(unlockErrorStored, locale);
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const mysql = session.provider === 'mysql';
  const title = mysql ? tConnector('newDatabase') : tConnector('newSchema');
  const selectedCharset = flow.options?.charsets.find((item) => item.name === charset);
  const nameError = schemaCreateNameError(session.provider, name);
  const remaining = flow.prepared
    ? Math.max(0, Math.min(5 * 60, Math.ceil((flow.prepared.expiresAt - clock) / 1000)))
    : 0;
  const locked = flow.busy === 'commit' || unlocking;
  useEffect(() => {
    if (!flow.prepared) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [flow.prepared]);
  async function unlock() {
    setUnlocking(true);
    setUnlockError('');
    try {
      await onUnlock();
    } catch (reason) {
      setUnlockError(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setUnlocking(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(flow.prepared!.review.sql);
      setCopied(true);
    } catch {
      setUnlockError(
        connectorUiMessages.message('clipboardWritingUnavailableSelectAndCopySqlManually'),
      );
    }
  }
  function back() {
    setConfirmed(false);
    setCopied(false);
    void flow.edit();
  }
  const review = flow.prepared?.review;
  return (
    <SqlDialog title={title} className={styles.dialog} busy={locked} onClose={onClose}>
      <div className={styles.context}>
        <Database size={17} />
        <div>
          <strong>{session.info.productName}</strong>
          <span>
            {tConnector('currentConnection')}
            {session.database}
          </span>
        </div>
        <span className={styles.scope}>
          {mysql ? tConnector('databaseLevelResource') : tConnector('insideTheCurrentDatabase')}
        </span>
      </div>
      <div className={styles.steps} aria-label={tConnector('creationFlow')}>
        <span className={!review ? styles.active : ''}>{tConnector('configure')}</span>
        <i />
        <span className={review && !flow.result ? styles.active : ''}>
          {tConnector('reviewAndConfirm')}
        </span>
        <i />
        <span className={flow.result ? styles.active : ''}>{tConnector('results')}</span>
      </div>
      <div className={styles.body}>
        {!review ? (
          <>
            <label className={styles.field}>
              {mysql ? tConnector('databaseName') : tConnector('schemaName')}
              <input
                aria-label={tConnector('newResourceName')}
                value={name}
                disabled={Boolean(flow.busy)}
                autoFocus
                maxLength={128}
                placeholder={
                  mysql ? tConnector('exampleResearchData') : tConnector('exampleResearch')
                }
                onChange={(event) => setName(event.target.value)}
              />
              <small>
                {name && nameError
                  ? nameError
                  : mysql
                    ? tConnector('upToCharactersNamesAreQuotedSafelyWithTheirOriginal')
                    : tConnector('upToUtfBytesCaseAndSpecialCharactersAreRetained')}
              </small>
            </label>
            {mysql && (
              <div className={styles.options}>
                <label className={styles.field}>
                  {tConnector('characterSet')}
                  <select
                    aria-label={tConnector('newDatabaseCharacterSet')}
                    value={charset}
                    disabled={!flow.options || Boolean(flow.busy)}
                    onChange={(event) => {
                      setCharset(event.target.value);
                      setCollation('');
                    }}
                  >
                    <option value="">{tConnector('inheritServerDefault')}</option>
                    {flow.options?.charsets.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                        {item.description ? ` · ${item.description}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  {tConnector('collation')}
                  <select
                    aria-label={tConnector('newDatabaseCollation')}
                    value={collation}
                    disabled={!charset || Boolean(flow.busy)}
                    onChange={(event) => setCollation(event.target.value)}
                  >
                    <option value="">
                      {tConnector('characterSetDefault')}
                      {selectedCharset?.defaultCollation
                        ? ` · ${selectedCharset.defaultCollation}`
                        : ''}
                    </option>
                    {selectedCharset?.collations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {flow.busy === 'options' ? (
              <p className={styles.notice} role="status">
                <SpinnerGap size={15} className="mw-spin" />
                {tConnector('readingNativeCreationOptionsAndPermissions')}
              </p>
            ) : flow.options?.permission === 'denied' ? (
              <p className={styles.error} role="alert">
                {tConnector('theCurrentRoleCannotCreateSchemasInThisDatabaseReconnect')}
              </p>
            ) : (
              <div className={styles.notice}>
                <Warning size={16} />
                <span>
                  {mysql
                    ? tConnector('createsOneEmptyDatabaseOnlyMysqlDdlImplicitlyCommitsThe')
                    : tConnector('createsOneEmptySchemaInTheCurrentDatabaseOwnedBy')}
                  <small>
                    {tConnector('reviewDoesNotExecuteCreateUnlockWritesAndExplicitlyConfirm')}
                  </small>
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <dl className={styles.target}>
              <div>
                <dt>{tConnector('creationTarget')}</dt>
                <dd>
                  {review.target === 'database'
                    ? tConnector('mysqlDatabase')
                    : tConnector('postgresqlSchema')}
                </dd>
              </div>
              <div>
                <dt>{tConnector('name')}</dt>
                <dd>{review.name}</dd>
              </div>
              <div>
                <dt>
                  {mysql
                    ? tConnector('currentConnectionDatabase')
                    : tConnector('containingDatabase')}
                </dt>
                <dd>{review.database}</dd>
              </div>
              <div>
                <dt>{tConnector('planValidity')}</dt>
                <dd>
                  {flow.result
                    ? tConnector('consumedCannotBeReplayed')
                    : remaining
                      ? tConnector('minSec', {
                          p0: String(Math.floor(remaining / 60)),
                          p1: String(remaining % 60),
                        })
                      : tConnector('invalidatedReviewAgain')}
                </dd>
              </div>
            </dl>
            <div className={styles.sql}>
              <header>
                <span>{tConnector('nativeDdlToExecute')}</span>
                <button
                  type="button"
                  onClick={() => void copy()}
                  aria-label={tConnector('copyCreationSql')}
                >
                  <Copy size={14} />
                  {copied ? tConnector('copied') : tConnector('copy')}
                </button>
              </header>
              <pre>{review.sql}</pre>
            </div>
            <ul className={styles.warnings}>
              {review.warnings.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            {flow.result ? (
              <div
                className={`${styles.result} ${flow.result.outcome === 'created' ? styles.success : styles.uncertain}`}
                role={flow.result.outcome === 'created' ? 'status' : 'alert'}
              >
                {flow.result.outcome === 'created' ? (
                  <CheckCircle size={22} />
                ) : (
                  <Warning size={22} />
                )}
                <div>
                  <strong>
                    {flow.result.outcome === 'created'
                      ? tConnector('creationConfirmed')
                      : flow.result.outcome === 'unknown'
                        ? tConnector('resultUnconfirmed')
                        : tConnector('creationIncomplete')}
                  </strong>
                  <p>{flow.result.message}</p>
                  {flow.result.executionTimeMs > 0 && (
                    <small>
                      {tConnector('nativeExecution')}
                      {flow.result.executionTimeMs.toFixed(0)} ms
                    </small>
                  )}
                </div>
              </div>
            ) : (
              <>
                {!writable && (
                  <div className={styles.unlock}>
                    <LockOpen size={17} />
                    <span>
                      {tConnector('writesAreLockedForTheCurrentSessionExplicitlyUnlockThem')}
                    </span>
                    <button
                      type="button"
                      disabled={unlocking || !remaining}
                      onClick={() => void unlock()}
                    >
                      {unlocking ? tConnector('unlocking') : tConnector('unlockResourceCreation')}
                    </button>
                  </div>
                )}
                <label className={styles.confirm}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={!writable || locked || !remaining}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    {tConnector('iHaveReviewedTheDdlAboveAndConfirmCreation')}
                    <strong>{review.name}</strong>。
                    {mysql && (
                      <small>
                        {tConnector('iUnderstandThatCreatingAMysqlDatabaseCannotBeUndone')}
                      </small>
                    )}
                  </span>
                </label>
              </>
            )}
          </>
        )}
        {(flow.error || unlockError) && (
          <p role="alert" className={styles.error}>
            {flow.error || unlockError}
            {!flow.options && (
              <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.load()}>
                {tConnector('reloadOptions')}
              </button>
            )}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <button type="button" disabled={locked} onClick={onClose}>
          {flow.result ? tConnector('close') : tConnector('cancel')}
        </button>
        <span />
        {review && !flow.result && (
          <button type="button" disabled={locked || Boolean(flow.busy)} onClick={back}>
            {tConnector('backToConfiguration')}
          </button>
        )}
        {!review ? (
          <button
            type="button"
            className={styles.primary}
            disabled={
              Boolean(flow.busy) ||
              !flow.options?.supported ||
              flow.options.permission === 'denied' ||
              Boolean(nameError)
            }
            onClick={() => {
              setConfirmed(false);
              setClock(Date.now());
              void flow.preview({ name, charset: charset || null, collation: collation || null });
            }}
          >
            {flow.busy === 'preview' ? <SpinnerGap size={14} className="mw-spin" /> : null}
            {flow.busy === 'preview' ? tConnector('preparing') : tConnector('reviewCreationDdl')}
          </button>
        ) : (
          !flow.result && (
            <button
              type="button"
              className={styles.primary}
              disabled={!writable || !confirmed || !remaining || locked || Boolean(flow.busy)}
              onClick={() => void flow.commit()}
            >
              {flow.busy === 'commit' ? (
                <SpinnerGap size={14} className="mw-spin" />
              ) : (
                <Plus size={14} />
              )}
              {flow.busy === 'commit'
                ? tConnector('creatingNativeResource')
                : tConnector('confirmResourceCreation')}
            </button>
          )
        )}
      </footer>
    </SqlDialog>
  );
}
