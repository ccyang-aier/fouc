'use client';
import { uiText, type UiMessage, uiFailure, createUiMessages } from '../i18n/ui-message';
import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './relational-access-dialog.messages';
import { useState, type FormEvent } from 'react';
import type { RelationalConnectionConfig } from '@fouc/shared';
import {
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
} from '@fouc/shared/connection-options';
import { ConnectionOptionsFields } from './connection-options/connection-options-fields';
import { SqlDialog } from './sql-library-dialog';
import common from './relational.module.css';
import styles from './connection-options/connection-dialog.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
/** A transfer target needs credentials, without editing its saved connection profile. */
export function RelationalAccessDialog({
  name,
  config,
  onClose,
  onConnect,
}: {
  name: string;
  config: Exclude<
    RelationalConnectionConfig,
    {
      provider: 'sqlite';
    }
  >;
  onClose: () => void;
  onConnect: (password: string, options: DatabaseConnectionOptionsInput) => Promise<void>;
}) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const [password, setPassword] = useState(''),
    [options, setOptions] = useState<DatabaseConnectionOptionsInput>(config.connectionOptions);
  const [valid, setValid] = useState(true),
    [busy, setBusy] = useState(false),
    [errorStored, setError] = useState<UiMessage>('');
  const error = uiText(errorStored, locale);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError('');
    try {
      await onConnect(password, resolveConnectionOptions(config.provider, options));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? uiFailure(cause)
          : connectorUiMessages.message('couldNotConnectToTheTarget'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SqlDialog
      title={tConnector('connectTransferTarget', { p0: String(name) })}
      className={styles.dialog}
      busy={busy}
      onClose={onClose}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          void submit(event);
        }}
        onChange={() => setError('')}
      >
        <div className={styles.body}>
          <p className={common.hint}>
            {config.host}:{config.port} · {config.database} · {config.username}
          </p>
          <label>
            {tConnector('connectionPassword')}
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <ConnectionOptionsFields
            provider={config.provider}
            value={options}
            onChange={setOptions}
            disabled={busy}
            onValidityChange={setValid}
          />
          {error && (
            <p className={common.connectionError} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className={common.dialogFooter}>
          <button
            type="button"
            className={`fouc-action ${common.secondary}`}
            onClick={onClose}
            disabled={busy}
          >
            {tConnector('cancel')}
          </button>
          <button type="submit" className={common.primary} disabled={busy || !valid}>
            {busy ? tConnector('connecting') : tConnector('connectionTarget')}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
