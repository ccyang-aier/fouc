'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
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
  workspaceId: string;
  provider: RelationalProvider;
  connection?: RelationalSavedConnection;
  intent: 'save' | 'connect';
  onClose: () => void;
  onSave: (name: string, config: RelationalConnectionConfig) => Promise<void>;
  onConnect: (
    password: string,
    options?: DatabaseConnectionOptionsInput,
  ) => Promise<void>;
};

export function RelationalDialog({
  workspaceId,
  provider,
  connection,
  intent,
  onClose,
  onSave,
  onConnect,
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const label =
    provider === 'postgres'
      ? 'PostgreSQL'
      : provider === 'mysql'
        ? 'MySQL'
        : 'SQLite';

  async function perform(action: 'submit' | 'test') {
    if (busy || !optionsValid) return;
    setBusy(true);
    setError('');
    setFeedback('');
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
        const base = `/api/database/workspaces/${encodeURIComponent(workspaceId)}/relational/sessions`;
        const session = await backendFetch<RelationalSession>(base, {
          method: 'POST',
          body: JSON.stringify(request),
        });
        await backendFetch(`${base}/${session.id}`, { method: 'DELETE' });
        setFeedback(
          `连接成功 · ${session.info.productName} · ${session.info.productVersion}`,
        );
      } else if (intent === 'connect')
        await onConnect(
          password,
          provider === 'sqlite'
            ? undefined
            : resolveConnectionOptions(provider, connectionOptions),
        );
      else await onSave(name, config);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '连接操作失败');
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform('submit');
  }
  return (
    <SqlDialog
      title={
        intent === 'connect'
          ? `打开 ${connection?.name}`
          : connection
            ? `编辑 ${label} 连接`
            : `新建 ${label} 连接`
      }
      busy={busy}
      className={formStyles.dialog}
      onClose={onClose}
    >
      <form className={formStyles.form} onSubmit={submit}>
        <div className={formStyles.body}>
          {intent === 'save' && (
            <>
              <label>
                连接名称
                <input
                  autoFocus
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
                      setFeedback('');
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
            </>
          )}
          {intent === 'connect' && provider !== 'sqlite' && (
            <p className={styles.hint}>
              {host}:{port} · {database || '默认数据库'} · {username}
            </p>
          )}
          {provider !== 'sqlite' && (
            <>
              <label>
                连接密码
                <input
                  type="password"
                  autoFocus={intent === 'connect'}
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                />
                <small>仅用于本次连接或测试，不会保存到连接配置。</small>
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
          <p className={styles.hint}>使用只读会话浏览结构与执行查询。</p>
          {error && (
            <p className={styles.connectionError} role="alert">
              {error}
            </p>
          )}
          {feedback && (
            <p className={styles.success} role="status">
              <CheckCircle size={15} />
              {feedback}
            </p>
          )}
        </div>
        <footer className={styles.dialogFooter}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy || !optionsValid}
            onClick={() => void perform('test')}
          >
            测试连接
          </button>
          <span />
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="submit"
            className={styles.primary}
            disabled={busy || !optionsValid}
          >
            {busy
              ? '处理中…'
              : intent === 'connect'
                ? '连接并打开'
                : '保存连接'}
          </button>
        </footer>
      </form>
    </SqlDialog>
  );
}
