'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './review.messages';
import { Copy, WarningCircle, CheckCircle, LockOpen } from '@phosphor-icons/react';
import type { RelationalProvider } from '@fouc/shared';
import type { ForeignKeyEditModel } from './use-foreign-key-edit';
import styles from './foreign-key-edit.module.css';
export function ForeignKeyReview({
  model,
  provider,
  writable,
}: {
  model: ForeignKeyEditModel;
  provider: RelationalProvider;
  writable: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const { prepared, result, remaining, copy, busy, unlock, confirmed, locked, setConfirmed } =
    model;
  if (!prepared) return null;
  return (
    <>
      <div className={styles.reviewHead}>
        <strong>
          {prepared.review.input.kind === 'create' ? tConnector('create') : tConnector('delete')}{' '}
          {prepared.review.input.name}
        </strong>
        <small>
          {result
            ? tConnector('planAlreadyConsumed')
            : remaining
              ? tConnector('secondsRemaining', { p0: String(remaining) })
              : tConnector('reviewExpired')}{' '}
          ·{' '}
          {prepared.review.transaction === 'implicit'
            ? tConnector('implicitCommit')
            : tConnector('nativeTransaction')}
        </small>
        <button
          type="button"
          aria-label={tConnector('copyForeignKeyDdl')}
          onClick={() => void copy()}
        >
          <Copy size={14} />
        </button>
      </div>
      <pre className={styles.sql} aria-label={tConnector('completeForeignKeyDdl')}>
        {prepared.review.sql}
      </pre>
      <ul className={styles.warnings}>
        {prepared.review.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      {result ? (
        <div
          className={`${styles.result} ${result.outcome === 'applied' ? styles.success : styles.uncertain}`}
          role={result.outcome === 'applied' ? 'status' : 'alert'}
        >
          {result.outcome === 'applied' ? <CheckCircle size={21} /> : <WarningCircle size={21} />}
          <div>
            <strong>
              {result.outcome === 'applied'
                ? tConnector('foreignKeyChangesConfirmed')
                : result.outcome === 'unknown'
                  ? tConnector('resultUnconfirmed')
                  : tConnector('foreignKeyChangesNotApplied')}
            </strong>
            <p>{result.message}</p>
          </div>
        </div>
      ) : (
        <>
          {!writable && (
            <div className={styles.unlock}>
              <LockOpen size={17} />
              <span>{tConnector('theCurrentSessionIsReadOnlyReviewTheCompleteDdl')}</span>
              <button
                type="button"
                disabled={Boolean(busy) || !remaining}
                onClick={() => void unlock()}
              >
                {busy === 'unlock' ? tConnector('unlocking') : tConnector('unlockForeignKeyWrites')}
              </button>
            </div>
          )}
          <label className={styles.confirm}>
            <input
              type="checkbox"
              aria-label={tConnector('confirmForeignKeyChangesHaveBeenReviewed')}
              checked={confirmed}
              disabled={!writable || locked || !remaining}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {tConnector('iHaveReviewedTheRelationshipDirectionAndCompleteDdlAnd')}
              {prepared.review.input.kind === 'create'
                ? tConnector('create')
                : tConnector('delete')}
              {tConnector('foreignKeys')}
              <strong>{prepared.review.input.name}</strong>。
              {provider === 'mysql' && (
                <small>{tConnector('iUnderstandThatMysqlDdlCannotBeUndoneThroughA')}</small>
              )}
            </span>
          </label>
        </>
      )}
    </>
  );
}
