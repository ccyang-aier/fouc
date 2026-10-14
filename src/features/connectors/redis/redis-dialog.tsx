'use client';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import type { RedisConnectionConfig, RedisSavedConnection, RedisSession } from '@fouc/shared';
import {
  defaultConnectionOptions,
  publicConnectionOptions,
  resolveConnectionOptions,
  type DatabaseConnectionOptionsInput,
} from '@fouc/shared/connection-options';
import { useState, type FormEvent } from 'react';
import {
  ConnectionOptionsFields,
  ConnectionSourceAssistant,
} from '../datastore/connection-options';
import {
  ConnectionDialogActions,
  type ConnectionPendingAction,
  type ConnectionVerification,
} from '../datastore/connection-options/connection-dialog-actions';
import formStyles from '../datastore/connection-options/connection-dialog.module.css';
import styles from '../datastore/relational.module.css';
import { SqlDialog } from '../datastore/sql-library-dialog';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-dialog';
const { message: uiMessage } = createUiMessages(unitMessages);

export function RedisDialog({
  connection,
  initialError = '',
  onClose,
  onSave,
}: {
  connection?: RedisSavedConnection;
  initialError?: string;
  onClose: () => void;
  onSave: (
    name: string,
    config: RedisConnectionConfig,
    verification?: ConnectionVerification,
  ) => Promise<void>;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const previous = connection?.config;
  const [name, setName] = useState(connection?.name ?? '');
  const [host, setHost] = useState(previous?.host ?? '127.0.0.1'),
    [port, setPort] = useState(String(previous?.port ?? 6379));
  const [username, setUsername] = useState(previous?.username ?? ''),
    [database, setDatabase] = useState(String(previous?.database ?? 0));
  const [connectionOptions, setConnectionOptions] = useState<DatabaseConnectionOptionsInput>(
    previous?.connectionOptions ?? defaultConnectionOptions('redis'),
  );
  const [optionsValid, setOptionsValid] = useState(true),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState<ConnectionPendingAction>(null),
    [error, setError] = useState<UiMessage>(initialError),
    [testError, setTestError] = useState<UiMessage>(''),
    [feedback, setFeedback] = useState<UiMessage>('');
  const busy = pending !== null;
  function clearFeedback() {
    setError('');
    setTestError('');
    setFeedback('');
  }
  async function perform(test = false) {
    if (busy || !optionsValid) return;
    setPending(test ? 'test' : 'submit');
    clearFeedback();
    try {
      const config: RedisConnectionConfig = {
        provider: 'redis',
        host,
        port: Number(port),
        username,
        database: Number(database),
        connectionOptions: publicConnectionOptions('redis', connectionOptions),
      };
      if (test) {
        const base = `/api/database/redis/sessions`;
        const session = await backendFetch<RedisSession>(base, {
          method: 'POST',
          body: JSON.stringify({
            ...config,
            password,
            connectionOptions: resolveConnectionOptions('redis', connectionOptions),
          }),
        });
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' });
        setFeedback(
          uiMessage('连接成功 · Redis {v0} · DB {v1}', {
            v0: String(session.version ?? '版本未知'),
            v1: String(session.database),
          }),
        );
      } else
        await onSave(
          name,
          config,
          feedback && !testError
            ? {
                password,
                connectionOptions: resolveConnectionOptions('redis', connectionOptions),
              }
            : undefined,
        );
    } catch (reason) {
      (test ? setTestError : setError)(uiFailure(reason));
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
      title={connection ? tu('编辑 Redis 连接') : tu('新建 Redis 连接')}
      busy={busy}
      className={formStyles.dialog}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit} onChange={clearFeedback}>
        <div className={formStyles.body}>
          <label>
            {tu('连接名称')}{' '}
            <input
              required
              autoFocus={!initialError}
              maxLength={120}
              disabled={busy}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <ConnectionSourceAssistant
            provider="redis"
            fields={{
              provider: 'redis',
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
              {tu('主机')}{' '}
              <input
                required
                disabled={busy}
                value={host}
                onChange={(event) => setHost(event.target.value)}
              />
            </label>
            <label>
              {tu('端口')}{' '}
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
          <div className={formStyles.columns}>
            <label>
              {tu('ACL 用户名')}{' '}
              <input
                placeholder={tu('默认用户可留空')}
                disabled={busy}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              {tu('数据库编号')}{' '}
              <input
                required
                type="number"
                min={0}
                max={2147483646}
                disabled={busy}
                value={database}
                onChange={(event) => setDatabase(event.target.value)}
              />
            </label>
          </div>
          <label>
            {tu('连接密码')}{' '}
            <input
              autoFocus={Boolean(initialError)}
              type="password"
              autoComplete="off"
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small>{tu('密码临时保留以便直接打开工作台，不写入连接配置。')} </small>
          </label>
          <ConnectionOptionsFields
            provider="redis"
            value={connectionOptions}
            onChange={setConnectionOptions}
            disabled={busy}
            onValidityChange={setOptionsValid}
          />
          <p className={styles.hint}>
            {tu('支持 Standalone 连接。数据库索引由服务器实际配置决定。')}{' '}
          </p>
          {error && (
            <p className={styles.connectionError} role="alert">
              {uiText(error, locale)}
            </p>
          )}
        </div>
        <ConnectionDialogActions
          pending={pending}
          valid={optionsValid}
          feedback={uiText(feedback, locale)}
          testError={uiText(testError, locale)}
          submitLabel={tu('保存连接')}
          onTest={() => void perform(true)}
          onClose={onClose}
        />
      </form>
    </SqlDialog>
  );
}
