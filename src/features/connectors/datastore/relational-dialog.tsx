'use client';

import { uiText, type UiMessage, createUiMessages } from '../i18n/ui-message';

import { useTranslation } from '@/lib/i18n';
import { messages as connectorMessages } from './relational-dialog.messages';
import { useState, type FormEvent } from 'react';
import {
  ConnectionDialogActions,
  type ConnectionPendingAction,
  type ConnectionVerification,
} from './connection-options/connection-dialog-actions';
import type {
  RelationalConnectionConfig,
  RelationalProvider,
  RelationalSavedConnection,
  RelationalSession,
} from '@fouc/shared';
import {
  defaultConnectionOptions,
  publicConnectionOptions,
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
} from '@fouc/shared/connection-options';
import { backendFetch } from '@/lib/backend';
import { SqlDialog } from './sql-library-dialog';
import { ConnectionOptionsFields, ConnectionSourceAssistant } from './connection-options';
import styles from './relational.module.css';
import formStyles from './connection-options/connection-dialog.module.css';
const connectorUiMessages = createUiMessages(connectorMessages);
type Props = {
  provider: RelationalProvider;
  connection?: RelationalSavedConnection;
  initialError?: string;
  onClose: () => void;
  onSave: (
    name: string,
    config: RelationalConnectionConfig,
    verification?: ConnectionVerification,
  ) => Promise<void>;
};
export function RelationalDialog({
  provider,
  connection,
  initialError = '',
  onClose,
  onSave,
}: Props) {
  const { t: tConnector, locale } = useTranslation(connectorMessages);
  const previous = connection?.config,
    network = previous?.provider !== 'sqlite' ? previous : undefined;
  const [name, setName] = useState(connection?.name ?? '');
  const [host, setHost] = useState(network?.host ?? '127.0.0.1');
  const [port, setPort] = useState(String(network?.port ?? (provider === 'mysql' ? 3306 : 5432)));
  const [username, setUsername] = useState(
    network?.username ?? (provider === 'mysql' ? 'root' : 'postgres'),
  );
  const [database, setDatabase] = useState(
    network?.database ?? (provider === 'mysql' ? '' : 'postgres'),
  );
  const [path, setPath] = useState(previous?.provider === 'sqlite' ? previous.path : '');
  const [connectionOptions, setConnectionOptions] = useState<DatabaseConnectionOptionsInput>(
    network?.connectionOptions ??
      defaultConnectionOptions(provider === 'mysql' ? 'mysql' : 'postgres'),
  );
  const [optionsValid, setOptionsValid] = useState(true),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState<ConnectionPendingAction>(null),
    [error, setError] = useState(initialError),
    [testErrorStored, setTestError] = useState<UiMessage>(''),
    [feedbackStored, setFeedback] = useState<UiMessage>('');
  const testError = uiText(testErrorStored, locale);
  const feedback = uiText(feedbackStored, locale);
  const busy = pending !== null;
  function clearFeedback() {
    setError('');
    setTestError('');
    setFeedback('');
  }
  const label = provider === 'postgres' ? 'PostgreSQL' : provider === 'mysql' ? 'MySQL' : 'SQLite';
  async function perform(action: 'submit' | 'test') {
    if (busy || !optionsValid) return;
    setPending(action);
    clearFeedback();
    try {
      const config: RelationalConnectionConfig =
        provider === 'sqlite'
          ? { provider, path }
          : {
              provider,
              host,
              port: Number(port),
              username,
              database,
              connectionOptions: publicConnectionOptions(provider, connectionOptions),
            };
      if (action === 'test') {
        const request =
          provider === 'sqlite'
            ? config
            : {
                ...config,
                password,
                connectionOptions: resolveConnectionOptions(provider, connectionOptions),
              };
        const base = `/api/database/relational/sessions`;
        const session = await backendFetch<RelationalSession>(base, {
          method: 'POST',
          body: JSON.stringify(request),
        });
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' });
        setFeedback(
          connectorUiMessages.message('connected', {
            p0: String(session.info.productName),
            p1: String(session.info.productVersion),
          }),
        );
      } else
        await onSave(
          name,
          config,
          feedback && !testError
            ? {
                password,
                connectionOptions:
                  provider === 'sqlite'
                    ? undefined
                    : resolveConnectionOptions(provider, connectionOptions),
              }
            : undefined,
        );
    } catch (reason) {
      (action === 'test' ? setTestError : setError)(
        reason instanceof Error ? uiText(reason, locale) : tConnector('connectionActionFailed'),
      );
    } finally {
      setPending(null);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform('submit');
  }
  return (
    <SqlDialog
      title={
        connection
          ? tConnector('editConnection', { p0: String(label) })
          : tConnector('newConnection', { p0: String(label) })
      }
      busy={busy}
      className={formStyles.dialog}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit} onChange={clearFeedback}>
        <div className={formStyles.body}>
          <label>
            {tConnector('connectionName')}
            <input
              autoFocus={!initialError}
              required
              maxLength={120}
              disabled={busy}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={tConnector('exampleLocalDevelopmentDatabase')}
            />
          </label>
          {provider !== 'sqlite' ? (
            <>
              <ConnectionSourceAssistant
                provider={provider}
                fields={{
                  provider,
                  host,
                  port: Number(port),
                  username,
                  password,
                  database,
                  connectionOptions,
                }}
                disabled={busy}
                onApply={({ fields }) => {
                  setHost(fields.host);
                  setPort(String(fields.port));
                  setUsername(fields.username);
                  setDatabase(fields.database);
                  setPassword(fields.password);
                  setConnectionOptions(fields.connectionOptions);
                  clearFeedback();
                }}
              />
              <div className={styles.formColumns}>
                <label>
                  {tConnector('host')}
                  <input
                    required
                    disabled={busy}
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                  />
                </label>
                <label>
                  {tConnector('port')}
                  <input
                    required
                    type="number"
                    min={1}
                    max={65535}
                    disabled={busy}
                    value={port}
                    onChange={(event) => setPort(event.target.value)}
                  />
                </label>
              </div>
              <label>
                {tConnector('database')}
                <input
                  required={provider === 'postgres'}
                  disabled={busy}
                  value={database}
                  onChange={(event) => setDatabase(event.target.value)}
                  placeholder={
                    provider === 'mysql'
                      ? tConnector('leaveEmptyToChooseADatabaseInTheWorkbench')
                      : undefined
                  }
                />
              </label>
              <label>
                {tConnector('username')}
                <input
                  required
                  disabled={busy}
                  value={username}
                  autoComplete="off"
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              {tConnector('sqliteFileOnTheDevice')}
              <input
                required
                disabled={busy}
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="C:\\data\\application.db"
              />
              <small>{tConnector('useAnAbsolutePathTheFileMustAlreadyExistOn')}</small>
            </label>
          )}
          {provider !== 'sqlite' && (
            <>
              <label>
                {tConnector('connectionPassword')}
                <input
                  type="password"
                  autoFocus={Boolean(initialError)}
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                />
                <small>
                  {tConnector('thePasswordIsRetainedTemporarilyForOpeningTheWorkbenchAnd')}
                </small>
              </label>
              <ConnectionOptionsFields
                provider={provider}
                value={connectionOptions}
                onChange={setConnectionOptions}
                disabled={busy}
                onValidityChange={setOptionsValid}
              />
            </>
          )}
          {error && (
            <p className={styles.connectionError} role="alert">
              {error}
            </p>
          )}
        </div>
        <ConnectionDialogActions
          pending={pending}
          valid={optionsValid}
          feedback={feedback}
          testError={testError}
          submitLabel={tConnector('saveConnection')}
          onTest={() => void perform('test')}
          onClose={onClose}
        />
      </form>
    </SqlDialog>
  );
}
