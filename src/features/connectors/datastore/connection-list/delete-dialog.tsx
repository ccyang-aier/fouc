import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './delete-dialog.messages';
import { SqlDialog } from '../sql-library-dialog';
import type { SavedDatastoreConnection } from './provider-model';
import common from '../relational.module.css';
import styles from './batch-dialog.module.css';
export function ConnectionDeleteDialog({
  connections,
  busy,
  error,
  onDelete,
  onClose,
}: {
  connections: readonly SavedDatastoreConnection[];
  busy: boolean;
  error?: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  return (
    <SqlDialog
      title={
        connections.length === 1
          ? tConnector('deleteConnection')
          : tConnector('deleteConnections', { p0: String(connections.length) })
      }
      role="alertdialog"
      busy={busy}
      onClose={onClose}
      className={styles.dialog}
    >
      <div className={styles.body}>
        <ul className={styles.names}>
          {connections.map((connection) => (
            <li key={connection.id}>{connection.name}</li>
          ))}
        </ul>
        <p className={styles.note}>
          {tConnector('onlyConnectionConfigurationsAreDeletedDatabasesAndTheirContentsAre')}
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className={`${common.dialogFooter} ${styles.footer}`}>
        <button type="button" className={common.secondary} disabled={busy} onClick={onClose}>
          {tConnector('cancel')}
        </button>
        <button type="button" className={common.danger} disabled={busy} onClick={onDelete}>
          {busy ? tConnector('deleting') : tConnector('confirmDeletion')}
        </button>
      </footer>
    </SqlDialog>
  );
}
