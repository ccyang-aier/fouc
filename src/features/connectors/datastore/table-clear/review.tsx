import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './review.messages';
import type { TableClearReview } from '@fouc/shared/table-clear';
import styles from './table-clear.module.css';
export function TableClearReviewContent({ review }: { review: TableClearReview }) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  return (
    <>
      <div className={styles.stats}>
        <div>
          <small>{tConnector('rowsVisibleAtReviewTime')}</small>
          <strong>{review.visibleRowCount}</strong>
          <span>
            {new Date(review.countedAt).toLocaleTimeString(locale)}
            {tConnector('countUnderCurrentRole')}
          </span>
        </div>
        <div>
          <small>{tConnector('nativeOperation')}</small>
          <strong>{review.operation === 'delete' ? 'DELETE' : 'TRUNCATE'}</strong>
          <span>
            {review.transaction === 'atomic'
              ? tConnector('singleTransactionExecution')
              : tConnector('implicitCommitCannotBeRolledBack')}
          </span>
        </div>
        <div>
          <small>Identity / Sequence</small>
          <strong>
            {review.identity === 'preserved'
              ? tConnector('preserve')
              : review.identity === 'reset'
                ? tConnector('reset')
                : tConnector('notApplicable')}
          </strong>
          <span>{tConnector('basedOnCurrentNativeColumns')}</span>
        </div>
      </div>
      <div className={styles.sectionTitle}>
        <strong>{tConnector('fullControlledSql')}</strong>
        <span>{tConnector('currentTargetOnlyNoCascade')}</span>
      </div>
      <pre className={styles.sql} aria-label={tConnector('fullEmptyTableSql')}>
        {review.sql}
      </pre>
      <div className={styles.permission}>
        <span data-state={review.permission}>
          {review.permission === 'allowed'
            ? tConnector('permissionsRead')
            : review.permission === 'denied'
              ? tConnector('insufficientPermissions')
              : tConnector('nativeValidationAtExecution')}
        </span>
        <p>{review.permissionDetail}</p>
      </div>
      <div className={styles.sectionTitle}>
        <strong>{tConnector('referencesAndTriggers')}</strong>
        <span>
          {review.incomingReferences.length}
          {tConnector('references')}
          {review.triggers.length}
          {tConnector('executionTriggers')}
        </span>
      </div>
      <p className={styles.caption}>{review.referenceCoverage}</p>
      {review.incomingReferences.length ? (
        <div className={styles.dependencies}>
          {review.incomingReferences.map((item) => (
            <div key={JSON.stringify([item.schema, item.table, item.constraint])}>
              <strong>
                {item.schema}.{item.table}
              </strong>
              <code>{item.constraint}</code>
              <span>
                {item.columns.join(', ')} → {item.referencedColumns.join(', ')} · {item.onDelete}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>
          {tConnector('noForeignKeysReferenceTheTargetTableWithinTheCurrent')}
        </p>
      )}
      {review.triggers.map((trigger) => (
        <details className={styles.trigger} key={trigger.name}>
          <summary>
            {trigger.name} · {trigger.timing} {trigger.events.join(' / ')}
          </summary>
          <pre>{trigger.definition}</pre>
        </details>
      ))}
      <div className={styles.warnings}>
        <strong>{tConnector('impactReview')}</strong>
        <ul>
          {review.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
      {review.blockedReasons.length > 0 && (
        <div className={styles.blocked} role="alert">
          <strong>{tConnector('theCurrentPlanCannotExecute')}</strong>
          <ul>
            {review.blockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
