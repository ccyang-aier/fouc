'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './action.messages';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { LockOpen } from '@phosphor-icons/react/dist/csr/LockOpen';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { Table } from '@phosphor-icons/react/dist/csr/Table';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type { RelationalSession } from '@fouc/shared';
import {
  TABLE_CREATE_LIMITS,
  tableCreateNewColumn,
  validateTableCreateInput,
  type TableCreateColumn,
} from '@fouc/shared/table-create';
import { SqlDialog } from '../sql-library-dialog';
import { TableCreateColumnRow } from './column-row';
import { useTableCreate } from './use-table-create';
import styles from './table-create.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
interface Props {
  base: string;
  session: RelationalSession;
  schema: string;
  writable: boolean;
  disabled: boolean;
  onUnlock: () => Promise<void>;
  onCreated: () => void;
  onBusyChange: (busy: boolean) => void;
}
export function TableCreateAction(props: Props) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        disabled={props.disabled}
        onClick={() => setOpen(true)}
        aria-label={tConnector('createDataTable')}
      >
        <Plus size={14} />
        <span>{tConnector('createTable')}</span>
      </button>
      {open && <CreateTableDialog key={props.base} {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
function CreateTableDialog({
  base,
  session,
  schema: initialSchema,
  writable,
  onUnlock,
  onCreated,
  onBusyChange,
  onClose,
}: Props & {
  onClose: () => void;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const flow = useTableCreate(base, onCreated, onBusyChange);
  const [schema, setSchema] = useState(initialSchema);
  const [table, setTable] = useState('');
  const [columns, setColumns] = useState<TableCreateColumn[]>(() => [
    tableCreateNewColumn(session.provider, crypto.randomUUID(), true),
  ]);
  const [confirmed, setConfirmed] = useState(false),
    [clock, setClock] = useState(() => Date.now());
  const [unlocking, setUnlocking] = useState(false),
    [noticeStored, setNotice] = useState<UiMessage>('');
  const notice = uiText(noticeStored, locale);
  const targetSchema =
    schema ||
    (flow.options?.schemas.includes(session.database)
      ? session.database
      : flow.options?.schemas.includes('public')
        ? 'public'
        : (flow.options?.schemas[0] ?? ''));
  const input = useMemo(
    () => ({ schema: targetSchema, table, columns }),
    [targetSchema, table, columns],
  );
  const validation = useMemo(() => {
    if (!table) return tConnector('enterANameForTheNewTable');
    try {
      validateTableCreateInput(session.provider, input);
      return '';
    } catch (reason) {
      return reason instanceof Error ? uiText(reason, locale) : String(reason);
    }
  }, [input, table, session.provider, tConnector, locale]);
  const review = flow.prepared?.review;
  const remaining = flow.prepared
    ? Math.max(0, Math.min(300, Math.ceil((flow.prepared.expiresAt - clock) / 1000)))
    : 0;
  const locked = flow.busy === 'commit' || unlocking;
  useEffect(() => {
    if (!flow.prepared) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [flow.prepared]);
  function updateColumn(id: string, next: TableCreateColumn) {
    setColumns((current) => current.map((column) => (column.id === id ? next : column)));
  }
  function moveColumn(index: number, direction: -1 | 1) {
    setColumns((current) => {
      const next = [...current],
        target = index + direction;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function unlock() {
    setUnlocking(true);
    setNotice('');
    try {
      await onUnlock();
    } catch (reason) {
      setNotice(reason instanceof Error ? uiFailure(reason) : String(reason));
    } finally {
      setUnlocking(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(review!.sql);
      setNotice(connectorUiMessages.message('fullCreateTableDdlCopied'));
    } catch {
      setNotice(connectorUiMessages.message('unableToWriteToTheClipboardSelectAndCopyThe'));
    }
  }
  return (
    <SqlDialog
      title={tConnector('createDataTable')}
      className={styles.dialog}
      busy={locked}
      onClose={onClose}
    >
      <div className={styles.context}>
        <Table size={17} />
        <div>
          <strong>{tConnector('nativeTableDesigner')}</strong>
          <span>
            {session.info.productName} · {session.database}
          </span>
        </div>
        <span className={styles.badge}>
          {review
            ? flow.result
              ? tConnector('executionResults')
              : tConnector('readOnlyDdlReview')
            : tConnector('columnDesign')}
        </span>
      </div>
      <div className={styles.body}>
        {!review ? (
          <>
            <div className={styles.targetFields}>
              <label>
                {tConnector('target')}
                {session.provider === 'mysql' ? tConnector('database') : 'Schema'}
                <select
                  aria-label={tConnector('targetCatalogForTableCreation')}
                  value={targetSchema}
                  disabled={Boolean(flow.busy)}
                  onChange={(event) => setSchema(event.target.value)}
                >
                  {flow.options?.schemas.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                {tConnector('newTableName')}
                <input
                  aria-label={tConnector('newDataTableName')}
                  value={table}
                  disabled={Boolean(flow.busy)}
                  autoFocus
                  placeholder={tConnector('forExampleResearchItems')}
                  onChange={(event) => setTable(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.editorHead}>
              <strong>
                {tConnector('field')}
                <span>
                  {columns.length} / {TABLE_CREATE_LIMITS.columns}
                </span>
              </strong>
              <small>{tConnector('primaryKeyFollowsColumnOrderDefaultsAreRawValuesOr')}</small>
              <button
                type="button"
                disabled={Boolean(flow.busy) || columns.length >= TABLE_CREATE_LIMITS.columns}
                onClick={() =>
                  setColumns((current) => [
                    ...current,
                    tableCreateNewColumn(session.provider, crypto.randomUUID()),
                  ])
                }
              >
                <Plus size={14} />
                {tConnector('addColumn')}
              </button>
            </div>
            <div className={styles.columnsViewport}>
              <table className={styles.columns}>
                <thead>
                  <tr>
                    <th className={styles.nameHead}>{tConnector('columnName')}</th>
                    <th>{tConnector('nativeType')}</th>
                    <th>{tConnector('lengthPrecision')}</th>
                    <th>NULL</th>
                    <th>PK</th>
                    <th>UNIQUE</th>
                    <th>{tConnector('autoIncrementIdentity')}</th>
                    <th>{tConnector('defaultValue')}</th>
                    <th>{tConnector('orderRemove')}</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column, index) => (
                    <TableCreateColumnRow
                      key={column.id}
                      column={column}
                      index={index}
                      count={columns.length}
                      provider={session.provider}
                      disabled={Boolean(flow.busy)}
                      onChange={(next) => updateColumn(column.id, next)}
                      onDelete={() =>
                        setColumns((current) => current.filter((item) => item.id !== column.id))
                      }
                      onMove={(direction) => moveColumn(index, direction)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.scrollHint}>
              {tConnector('scrollHorizontallyToEditEveryColumnPropertyNumericDefaultsRetain')}
            </p>
            {validation && table && (
              <p className={styles.validation} role="status">
                <Warning size={14} />
                {validation}
              </p>
            )}
            <div className={styles.notice}>
              <Warning size={16} />
              <span>
                {tConnector('reviewDoesNotCreateATableConfirmationCreatesOnlyAn')}
                <small>
                  {tConnector(
                    'foreignKeysComputedGeneratedColumnsCheckConstraintsPartitionsCommentsA',
                  )}
                  {session.provider === 'mysql'
                    ? tConnector('mysqlUsesInnodbDdlCommitsImplicitly')
                    : tConnector('postgresqlSqliteUseNativeTableCreationTransactions')}
                </small>
              </span>
            </div>
            {flow.busy === 'loading' && (
              <p className={styles.loading} role="status">
                <SpinnerGap size={15} className="mw-spin" />
                {tConnector('readingTheCurrentConnectionSActualTargetCatalog')}
              </p>
            )}
          </>
        ) : (
          <>
            <div className={styles.reviewHead}>
              <strong>
                {review.schema}.{review.table}
              </strong>
              <span>
                {review.columns.length}
                {tConnector('columns')}
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
                aria-label={tConnector('copyFullCreateTableDdl')}
                onClick={() => void copy()}
              >
                <Copy size={14} />
                {tConnector('copyDdl')}
              </button>
            </div>
            <pre className={styles.sql} aria-label={tConnector('fullCreateTableDdl')}>
              {review.sql}
            </pre>
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
                      ? tConnector('tableCreationConfirmed')
                      : flow.result.outcome === 'unknown'
                        ? tConnector('resultUnconfirmed')
                        : tConnector('tableCreationIncomplete')}
                  </strong>
                  <p>{flow.result.message}</p>
                  {flow.result.executionTimeMs > 0 && (
                    <small>
                      {flow.result.executionTimeMs.toFixed(0)}
                      {tConnector('msNativeExecution')}
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
                      {tConnector('theCurrentSessionLocksWritesUnlockTableCreationAfterReviewing')}
                    </span>
                    <button
                      type="button"
                      disabled={unlocking || !remaining}
                      onClick={() => void unlock()}
                    >
                      {unlocking
                        ? tConnector('unlocking')
                        : tConnector('unlockNativeTableCreation')}
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
                    {tConnector('iHaveReviewedTheCompleteDdlAboveAndConfirmCreating')}
                    <strong>{review.schema}</strong>
                    {tConnector('create')}
                    <strong>{review.table}</strong>。
                    {session.provider === 'mysql' && (
                      <small>{tConnector('iUnderstandThatMysqlDdlCannotBeUndoneThroughA')}</small>
                    )}
                  </span>
                </label>
              </>
            )}
          </>
        )}
        {(flow.error || notice) && (
          <p
            className={flow.error ? styles.error : styles.feedback}
            role={flow.error ? 'alert' : 'status'}
          >
            {flow.error || notice}
            {!flow.options && flow.error && (
              <button type="button" disabled={Boolean(flow.busy)} onClick={() => void flow.load()}>
                {tConnector('readCatalogAgain')}
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
          <button
            type="button"
            disabled={locked || Boolean(flow.busy)}
            onClick={() => {
              setConfirmed(false);
              setNotice('');
              void flow.edit();
            }}
          >
            {tConnector('backToColumnDesign')}
          </button>
        )}
        {!review ? (
          <button
            type="button"
            className={styles.primary}
            disabled={
              Boolean(flow.busy) ||
              !flow.options ||
              Boolean(validation) ||
              !flow.options.schemas.includes(targetSchema)
            }
            onClick={() => {
              setConfirmed(false);
              setNotice('');
              setClock(Date.now());
              void flow.preview(input);
            }}
          >
            {flow.busy === 'preview' && <SpinnerGap size={14} className="mw-spin" />}
            {flow.busy === 'preview'
              ? tConnector('preparingNativeReview')
              : tConnector('reviewFullCreateTableDdl')}
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
                ? tConnector('creatingNativeTable')
                : tConnector('confirmTableCreation')}
            </button>
          )
        )}
      </footer>
    </SqlDialog>
  );
}
