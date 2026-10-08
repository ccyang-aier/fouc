'use client';

import { useState, type FormEvent } from 'react';
import { ConnectionDialogActions, type ConnectionPendingAction, type ConnectionVerification } from './connection-options/connection-dialog-actions';
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
import {
  ConnectionOptionsFields,
  ConnectionSourceAssistant,
} from './connection-options';
import styles from './relational.module.css';
import formStyles from './connection-options/connection-dialog.module.css';

type Props = {

  provider: RelationalProvider;
  connection?: RelationalSavedConnection;
  initialError?: string;
  onClose: () => void;
  onSave: (name: string, config: RelationalConnectionConfig, verification?: ConnectionVerification) => Promise<void>;
};

export function RelationalDialog({
  provider,
  connection,
  initialError = '',
  onClose,
  onSave,
}: Props) {
  const previous = connection?.config,
    network = previous?.provider !== 'sqlite' ? previous : undefined;
  const [name, setName] = useState(connection?.name ?? '');
  const [host, setHost] = useState(network?.host ?? '127.0.0.1');
  const [port, setPort] = useState(
    String(network?.port ?? (provider === 'mysql' ? 3306 : 5432)),
  );
  const [username, setUsername] = useState(
    network?.username ?? (provider === 'mysql' ? 'root' : 'postgres'),
  );
  const [database, setDatabase] = useState(
    network?.database ?? (provider === 'mysql' ? '' : 'postgres'),
  );
  const [path, setPath] = useState(
    previous?.provider === 'sqlite' ? previous.path : '',
  );
  const [connectionOptions, setConnectionOptions] =
    useState<DatabaseConnectionOptionsInput>(
      network?.connectionOptions ??
        defaultConnectionOptions(provider === 'mysql' ? 'mysql' : 'postgres'),
    );
  const [optionsValid, setOptionsValid] = useState(true),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState<ConnectionPendingAction>(null),
    [error, setError] = useState(initialError),
    [testError, setTestError] = useState(''),
    [feedback, setFeedback] = useState('');
  const busy = pending !== null;
  function clearFeedback() { setError(''); setTestError(''); setFeedback(''); }
  const label =
    provider === 'postgres'
      ? 'PostgreSQL'
      : provider === 'mysql'
        ? 'MySQL'
        : 'SQLite';

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
              connectionOptions: publicConnectionOptions(
                provider,
                connectionOptions,
              ),
            };
      if (action === 'test') {
        const request =
          provider === 'sqlite'
            ? config
            : {
                ...config,
                password,
                connectionOptions: resolveConnectionOptions(
                  provider,
                  connectionOptions,
                ),
              };
        const base = `/api/database/relational/sessions`;
        const session = await backendFetch<RelationalSession>(base, {
          method: 'POST',
          body: JSON.stringify(request),
        });
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' });
        setFeedback(
          `连接成功 · ${session.info.productName} · ${session.info.productVersion}`,
        );
      } else await onSave(name, config, feedback && !testError ? {
        password,
        connectionOptions: provider === 'sqlite' ? undefined : resolveConnectionOptions(provider, connectionOptions),
      } : undefined);
    } catch (reason) {
      (action === 'test' ? setTestError : setError)(reason instanceof Error ? reason.message : '连接操作失败');
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
            ? `编辑 ${label} 连接`
            : `新建 ${label} 连接`
      }
      busy={busy}
      className={formStyles.dialog}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit} onChange={clearFeedback}>
        <div className={formStyles.body}>
          <label>
            连接名称
            <input
              autoFocus={!initialError}
              required
              maxLength={120}
              disabled={busy}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：本地开发数据库"
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
                  主机
                  <input
                    required
                    disabled={busy}
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                  />
                </label>
                <label>
                  端口
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
                数据库
                <input
                  required={provider === 'postgres'}
                  disabled={busy}
                  value={database}
                  onChange={(event) => setDatabase(event.target.value)}
                  placeholder={
                    provider === 'mysql'
                      ? '可留空，在工作台选择数据库'
                      : undefined
                  }
                />
              </label>
              <label>
                用户名
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
              设备上的 SQLite 文件
              <input
                required
                disabled={busy}
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="C:\\data\\application.db"
              />
              <small>使用绝对路径；文件须位于当前设备并已存在。</small>
            </label>
          )}
          {provider !== 'sqlite' && (
            <>
              <label>
                连接密码
                <input
                  type="password"
                  autoFocus={Boolean(initialError)}
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                />
                <small>密码临时保留以便直接打开工作台，不写入连接配置。</small>
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
        <ConnectionDialogActions pending={pending} valid={optionsValid} feedback={feedback} testError={testError}
          submitLabel="保存连接" onTest={() => void perform('test')} onClose={onClose} />
      </form>
    </SqlDialog>
  );
}
