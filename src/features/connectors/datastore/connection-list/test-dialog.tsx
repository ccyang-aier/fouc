'use client';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './test-dialog.messages';
import { useState, type FormEvent } from 'react';
import {
  defaultConnectionOptions,
  type DatabaseConnectionOptionsInput,
} from '@fouc/shared/connection-options';
import { ConnectionOptionsFields } from '../connection-options';
import { SqlDialog } from '../sql-library-dialog';
import type { SavedDatastoreConnection } from './provider-model';
import common from '../relational.module.css';
import styles from './batch-dialog.module.css';
export type ConnectionTestCredentials = {
  password: string;
  options?: DatabaseConnectionOptionsInput;
};
export function ConnectionBatchTestDialog({
  connections,
  onRun,
  onClose,
}: {
  connections: readonly SavedDatastoreConnection[];
  onRun: (credentials: ReadonlyMap<string, ConnectionTestCredentials>) => Promise<void>;
  onClose: () => void;
}) {
  const { t: tConnector } = useTranslation(connectorMessages);
  const [credentials, setCredentials] = useState<Map<string, ConnectionTestCredentials>>(
    () =>
      new Map(
        connections.map((connection) => [
          connection.id,
          {
            password: '',
            options:
              connection.config.provider === 'sqlite'
                ? undefined
                : (connection.config.connectionOptions ??
                  defaultConnectionOptions(connection.config.provider)),
          },
        ]),
      ),
  );
  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  function update(id: string, patch: Partial<ConnectionTestCredentials>) {
    setCredentials((current) => new Map(current).set(id, { ...current.get(id)!, ...patch }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || Object.values(validity).some((valid) => !valid)) return;
    setBusy(true);
    try {
      await onRun(credentials);
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <SqlDialog
      title={tConnector('testConnections', { p0: String(connections.length) })}
      busy={busy}
      onClose={onClose}
      className={styles.dialog}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className={styles.body}>
          {connections.map((connection) => (
            <fieldset key={connection.id} disabled={busy} className={styles.connection}>
              <legend>{connection.name}</legend>
              {connection.config.provider !== 'sqlite' && (
                <>
                  <label>
                    {tConnector('password')}
                    <input
                      type="password"
                      autoComplete="new-password"
                      aria-label={tConnector('testPasswordFor', { p0: String(connection.name) })}
                      value={credentials.get(connection.id)!.password}
                      onChange={(event) => update(connection.id, { password: event.target.value })}
                      placeholder={tConnector('leaveEmptyForNoPassword')}
                    />
                  </label>
                  <details>
                    <summary>{tConnector('advancedConnectionOptions')}</summary>
                    <ConnectionOptionsFields
                      provider={connection.config.provider}
                      value={credentials.get(connection.id)!.options!}
                      disabled={busy}
                      onChange={(options) => update(connection.id, { options })}
                      onValidityChange={(valid) =>
                        setValidity((current) =>
                          current[connection.id] === valid
                            ? current
                            : { ...current, [connection.id]: valid },
                        )
                      }
                    />
                  </details>
                </>
              )}
            </fieldset>
          ))}
        </div>
        <footer className={`${common.dialogFooter} ${styles.footer}`}>
          <button type="button" className={common.secondary} disabled={busy} onClick={onClose}>
            {tConnector('cancel')}
          </button>
          <button
            type="submit"
            className={common.primary}
            disabled={busy || Object.values(validity).some((valid) => !valid)}
          >
            {busy ? tConnector('testing') : tConnector('startTesting')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
