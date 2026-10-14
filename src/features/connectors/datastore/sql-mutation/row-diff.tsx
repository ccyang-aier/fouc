import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './row-diff.messages';
import type { DatabaseCell } from '@fouc/shared';
import type { SqlMutationCell, SqlMutationReview } from '@fouc/shared/sql-mutation';
import styles from './sql-mutation.module.css';
export function MutationRowDiff({
  review,
  rowIndex,
  changesOnly,
}: {
  review: SqlMutationReview;
  rowIndex: number;
  changesOnly: boolean;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const row = review.rows[rowIndex];
  if (!row) return <p className={styles.hint}>{tConnector('noRowsMatchTheScope')}</p>;
  const indexes = review.columns.flatMap((column, index) => {
    const after = row.after?.[index];
    const changed =
      !row.before ||
      !row.after ||
      after?.state === 'database' ||
      JSON.stringify(row.before[index]) !==
        JSON.stringify(after?.state === 'value' ? after.value : null);
    return changesOnly && !changed ? [] : [index];
  });
  return (
    <div className={styles.diffScroll}>
      <table className={styles.diff} aria-label={tConnector('sqlOldAndNewValueComparison')}>
        <thead>
          <tr>
            <th>{tConnector('field')}</th>
            <th>{tConnector('currentValue')}</th>
            <th>{tConnector('afterCommit')}</th>
          </tr>
        </thead>
        <tbody>
          {indexes.map((index) => {
            const column = review.columns[index];
            return (
              <tr key={column.name}>
                <th scope="row">
                  <b>{column.name}</b>
                  <small>
                    {column.dataType}
                    {column.isPrimaryKey ? ' · PK' : ''}
                  </small>
                </th>
                <td>
                  {row.before ? (
                    <Cell value={row.before[index]} />
                  ) : (
                    <span className={styles.missing}>{tConnector('addRow')}</span>
                  )}
                </td>
                <td>
                  {row.after ? (
                    <NewCell cell={row.after[index]} />
                  ) : (
                    <span className={styles.deleted}>{tConnector('toBeDeleted')}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!indexes.length && (
        <p className={styles.hint}>{tConnector('thisRowHasNoKnownValueChangesTurnOffChanges')}</p>
      )}
    </div>
  );
}
function NewCell({ cell }: { cell: SqlMutationCell }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return cell.state === 'database' ? (
    <span className={styles.generated} title={cell.reason}>
      {tConnector('databaseGenerated')}
      <small>{cell.reason}</small>
    </span>
  ) : (
    <Cell value={cell.value} />
  );
}
function Cell({ value }: { value: DatabaseCell }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  if (value === null) return <span className={styles.null}>NULL</span>;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const bytes =
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type === 'binary' &&
    typeof value.base64 === 'string'
      ? value.base64
      : null;
  return (
    <code title={text}>
      {bytes !== null
        ? `base64:${bytes.slice(0, 120)}${bytes.length > 120 ? '…' : ''}`
        : text.length > 240
          ? text.slice(0, 240) + '…'
          : text || tConnector('emptyString')}
    </code>
  );
}
