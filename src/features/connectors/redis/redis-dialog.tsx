'use client';

import { useState, type FormEvent } from 'react';
import { ConnectionDialogActions, type ConnectionPendingAction } from '../datastore/connection-options/connection-dialog-actions';
import type {
  RedisConnectionConfig,
  RedisSavedConnection,
  RedisSession,
} from '@fouc/shared';
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

export function RedisDialog({
  workspaceId,
  connection,
  intent,
  onClose,
  onSave,
  onConnect,
  onTest,
}: {
  workspaceId: string;
  connection?: RedisSavedConnection;
  intent: 'save' | 'connect';
  onClose: () => void;
  onSave: (name: string, config: RedisConnectionConfig) => Promise<void>;
  onConnect: (
    password: string,
    options: DatabaseConnectionOptionsInput,
  ) => Promise<void>;
  onTest?: (
    password: string,
    options?: DatabaseConnectionOptionsInput,
  ) => Promise<string>;
}) {
  const previous = connection?.config;
  const [name, setName] = useState(connection?.name ?? '');
  const [host, setHost] = useState(previous?.host ?? '127.0.0.1'),
    [port, setPort] = useState(String(previous?.port ?? 6379));
  const [username, setUsername] = useState(previous?.username ?? ''),
    [database, setDatabase] = useState(String(previous?.database ?? 0));
  const [connectionOptions, setConnectionOptions] =
    useState<DatabaseConnectionOptionsInput>(
      previous?.connectionOptions ?? defaultConnectionOptions('redis'),
    );
  const [optionsValid, setOptionsValid] = useState(true),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState<ConnectionPendingAction>(null),
    [error, setError] = useState(''),
    [testError, setTestError] = useState(''),
    [feedback, setFeedback] = useState('');
  const busy = pending !== null;
  function clearFeedback() { setError(''); setTestError(''); setFeedback(''); }
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
      if (test && intent === 'connect' && onTest) {
        setFeedback(
          await onTest(
            password,
            resolveConnectionOptions('redis', connectionOptions),
          ),
        );
      } else if (test) {
        const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/redis/sessions`;
        const session = await backendFetch<RedisSession>(base, {
          method: 'POST',
          body: JSON.stringify({
            ...config,
            password,
            connectionOptions: resolveConnectionOptions(
              'redis',
              connectionOptions,
            ),
          }),
        });
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' });
        setFeedback(
          `连接成功 · Redis ${session.version ?? '版本未知'} · DB ${session.database}`,
        );
      } else if (intent === 'connect')
        await onConnect(
          password,
          resolveConnectionOptions('redis', connectionOptions),
        );
      else await onSave(name, config);
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
            ? '编辑 Redis 连接'
            : '新建 Redis 连接'
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
              <div className={formStyles.columns}>
                <label>
                  ACL 用户名
                  <input
                    placeholder="默认用户可留空"
                    disabled={busy}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>
                <label>
                  数据库编号
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
            </>
          ) : (
            <p className={styles.hint}>
              {host}:{port} · DB {database}
            </p>
          )}
          <label>
            连接密码
            <input
              autoFocus={intent === 'connect'}
              type="password"
              autoComplete="off"
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small>
              密码仅用于本次测试或会话，连接配置按工作空间保存在当前设备。
            </small>
          </label>
          <ConnectionOptionsFields
            provider="redis"
            value={connectionOptions}
            onChange={setConnectionOptions}
            disabled={busy}
            onValidityChange={setOptionsValid}
          />
          <p className={styles.hint}>
            支持 Standalone 连接。数据库索引由服务器实际配置决定。
          </p>
          {error && (
            <p className={styles.connectionError} role="alert">
              {error}
            </p>
          )}
        </div>
        <ConnectionDialogActions pending={pending} valid={optionsValid} feedback={feedback} testError={testError}
          submitLabel={intent === 'connect' ? '连接并打开' : '保存连接'} onTest={() => void perform(true)} onClose={onClose} />
      </form>
    </SqlDialog>
  );
}
