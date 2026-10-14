'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './result.messages';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import type { TableClearCommitResult } from '@fouc/shared/table-clear';
import styles from './table-clear.module.css';
export function TableClearResultContent({ result }: { result: TableClearCommitResult }) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const cleared = result.outcome === 'cleared';
  const title = cleared
    ? tConnector('nativeEmptyTableOperationConfirmed')
    : result.outcome === 'unknown'
      ? tConnector('commitOutcomeUnconfirmed')
      : tConnector('emptyTableOperationNotCommitted');
  return (
    <div
      className={`${styles.result} ${cleared ? styles.success : styles.blocked}`}
      role={cleared ? 'status' : 'alert'}
    >
      {cleared ? <CheckCircle size={22} /> : <Warning size={22} />}
      <div>
        <strong>{title}</strong>
        <p>{result.message}</p>
        {result.affectedRows !== null && (
          <small>
            {tConnector('nativeDeleteAffectedRows')}
            {result.affectedRows}
            {tConnector('rows')}
          </small>
        )}
        <small>{result.executionTimeMs.toFixed(0)} ms</small>
      </div>
    </div>
  );
}
