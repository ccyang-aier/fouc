'use client';

import { useState, type FormEvent } from 'react';
import { ConnectionDialogActions, type ConnectionPendingAction } from '../datastore/connection-options/connection-dialog-actions';
import type {
  MongoConnectionConfig,
  MongoSavedConnection,
} from '@fouc/shared/mongo-connections';
import type { MongoSession } from '@fouc/shared/mongo';
import {
  defaultConnectionOptions,
  publicConnectionOptions,
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
} from '@fouc/shared/connection-options';
import { backendFetch } from '@/lib/backend';
import { SqlDialog } from '../datastore/sql-library-dialog';
import {
  ConnectionOptionsFields,
  ConnectionSourceAssistant,
} from '../datastore/connection-options';
import styles from '../datastore/relational.module.css';
import formStyles from '../datastore/connection-options/connection-dialog.module.css';

export function MongoDialog({
  workspaceId,
  connection,
  intent,
  onClose,
  onSave,
  onConnect,
  onTest,
}: {
  workspaceId: string;
  connection?: MongoSavedConnection;
  intent: 'save' | 'connect';
  onClose: () => void;
  onSave: (name: string, config: MongoConnectionConfig) => Promise<void>;
  onConnect: (
    password: string,
    options: DatabaseConnectionOptionsInput,
  ) => Promise<void>;
  onTest?: (
    password: string,
    options?: DatabaseConnectionOptionsInput,
  ) => Promise<string>;
}) {
  const [name, setName] = useState(connection?.name ?? '');
  const [config, setConfig] = useState<MongoConnectionConfig>(
    connection?.config ?? {
      provider: 'mongodb',
      host: '127.0.0.1',
      port: 27017,
      username: '',
      database: 'admin',
      authSource: 'admin',
      connectionOptions: defaultConnectionOptions('mongodb'),
    },
  );
  const [connectionOptions, setConnectionOptions] =
    useState<DatabaseConnectionOptionsInput>(config.connectionOptions);
  const [optionsValid, setOptionsValid] = useState(true),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState<ConnectionPendingAction>(null),
    [error, setError] = useState(''),
    [testError, setTestError] = useState(''),
    [feedback, setFeedback] = useState('');
  const busy = pending !== null;
  function clearFeedback() { setError(''); setTestError(''); setFeedback(''); }
  const hostList = config.mongo?.srv || (config.mongo?.hosts.length ?? 0) > 1;
  function update<K extends keyof MongoConnectionConfig>(
    key: K,
    value: MongoConnectionConfig[K],
  ) {
    setConfig((current) => ({
      ...current,
      [key]: value,
      ...(key === 'host' || key === 'port' ? { mongo: undefined } : {}),
    }));
    clearFeedback();
  }
  async function perform(test = false) {
    if (busy || !optionsValid) return;
    setPending(test ? 'test' : 'submit');
    clearFeedback();
    try {
      const publicConfig = {
        ...config,
        connectionOptions: publicConnectionOptions(
          'mongodb',
          connectionOptions,
          !!config.mongo?.srv,
        ),
      };
      if (test && intent === 'connect' && onTest) {
        setFeedback(
          await onTest(
            password,
            resolveConnectionOptions(
              'mongodb',
              connectionOptions,
              !!config.mongo?.srv,
            ),
          ),
        );
      } else if (test) {
        const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/mongo/sessions`;
        const session = await backendFetch<MongoSession>(base, {
          method: 'POST',
          body: JSON.stringify({
            ...publicConfig,
            password,
            connectionOptions: resolveConnectionOptions(
              'mongodb',
              connectionOptions,
              !!config.mongo?.srv,
            ),
          }),
        });
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' });
        setFeedback(
          `连接成功 · MongoDB ${session.version ?? '版本未知'} · ${session.database}`,
        );
      } else if (intent === 'connect')
        await onConnect(
          password,
          resolveConnectionOptions(
            'mongodb',
            connectionOptions,
            !!config.mongo?.srv,
          ),
        );
      else await onSave(name, publicConfig);
    } catch (reason) {
      (test ? setTestError : setError)(reason instanceof Error ? reason.message : '连接操作失败');
    } finally {
      setPending(null);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform();
  }
  return (
    <SqlDialog
      title={
        intent === 'connect'
          ? `打开 ${connection?.name}`
          : connection
            ? '编辑 MongoDB 连接'
            : '新建 MongoDB 连接'
      }
      busy={busy}
      className={formStyles.dialog}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit} onChange={clearFeedback}>
        <div className={formStyles.body}>
          {intent === 'save' ? (
            <>
              <label>
                连接名称
                <input
                  required
                  autoFocus
                  maxLength={120}
                  disabled={busy}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <ConnectionSourceAssistant
                provider="mongodb"
                fields={{ ...config, password, connectionOptions }}
                disabled={busy}
                onApply={({ fields }) => {
                  setConfig({
                    provider: 'mongodb',
                    host: fields.host,
                    port: fields.port,
                    username: fields.username,
                    database: fields.database,
                    authSource:
                      fields.mongo?.authSource ??
                      (fields.username ? fields.database : 'admin'),
                    connectionOptions: publicConnectionOptions(
                      'mongodb',
                      fields.connectionOptions,
                      !!fields.mongo?.srv,
                    ),
                    mongo: fields.mongo,
                  });
                  setPassword(fields.password);
                  setConnectionOptions(fields.connectionOptions);
                  clearFeedback();
                }}
              />
              {hostList ? (
                <div className={formStyles.hostList}>
                  <strong>
                    {config.mongo?.srv ? 'DNS SRV 连接' : 'MongoDB 主机列表'}
                  </strong>
                  <code>
                    {config.mongo?.hosts
                      .map(
                        (host) =>
                          `${host.host}${config.mongo?.srv ? '' : `:${host.port}`}`,
                      )
                      .join(', ')}
                  </code>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfig((current) => ({
                        ...current,
                        mongo: undefined,
                      }));
                      clearFeedback();
                    }}
                  >
                    切换为单主机
                  </button>
                </div>
              ) : (
                <div className={styles.formColumns}>
                  <label>
                    主机
                    <input
                      required
                      disabled={busy}
                      value={config.host}
                      onChange={(event) => update('host', event.target.value)}
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
                      value={config.port}
                      onChange={(event) =>
                        update('port', Number(event.target.value))
                      }
                    />
                  </label>
                </div>
              )}
              <div className={formStyles.columns}>
                <label>
                  用户名
                  <input
                    disabled={busy}
                    value={config.username}
                    autoComplete="off"
                    onChange={(event) => update('username', event.target.value)}
                  />
                </label>
                <label>
                  初始数据库
                  <input
                    required
                    disabled={busy}
                    value={config.database}
                    onChange={(event) => update('database', event.target.value)}
                  />
                </label>
              </div>
              <label>
                认证数据库
                <input
                  required
                  disabled={busy}
                  value={config.authSource}
                  onChange={(event) => update('authSource', event.target.value)}
                />
              </label>
            </>
          ) : (
            <p className={styles.hint}>
              {config.mongo?.hosts.map((host) => host.host).join(', ') ||
                `${config.host}:${config.port}`}{' '}
              · {config.database} · {config.username || '无用户名'}
            </p>
          )}
          <label>
            连接密码
            <input
              aria-label="连接密码"
              type="password"
              autoFocus={intent === 'connect'}
              autoComplete="off"
              disabled={busy}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFeedback();
              }}
            />
            <small>密码仅用于本次连接，不保存到连接配置。</small>
          </label>
          <ConnectionOptionsFields
            provider="mongodb"
            value={connectionOptions}
            onChange={setConnectionOptions}
            disabled={busy}
            onValidityChange={setOptionsValid}
          />
          {error && (
            <p className={styles.connectionError} role="alert">
              {error}
            </p>
          )}
        </div>
        <ConnectionDialogActions pending={pending} valid={optionsValid} feedback={feedback} testError={testError}
          submitLabel={intent === 'connect' ? '打开工作台' : '保存连接'} onTest={() => void perform(true)} onClose={onClose} />
      </form>
    </SqlDialog>
  );
}
