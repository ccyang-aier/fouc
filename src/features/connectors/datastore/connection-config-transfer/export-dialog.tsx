'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  DownloadSimple,
  LockKey,
  ShieldCheck,
} from '@phosphor-icons/react';
import {
  CONNECTION_CONFIG_LIMITS,
  createConnectionConfigBundle,
} from '@fouc/shared/connection-config-transfer';
import { encryptConnectionConfig } from '@fouc/shared/connection-config-transfer-crypto';
import type { ExistingTransferConnection } from '@fouc/shared/connection-config-transfer-plan';
import { SqlDialog } from '../sql-library-dialog';
import common from '../relational.module.css';
import styles from './transfer.module.css';

export function ExportConnectionDialog({
  connections,
  onClose,
}: {
  connections: readonly ExistingTransferConnection[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(connections.map((entry) => entry.id)),
  );
  const [encrypted, setEncrypted] = useState(true),
    [passphrase, setPassphrase] = useState(''),
    [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);
  async function download() {
    if (busy || !selected.size) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      if (encrypted && passphrase !== confirm)
        throw new Error('两次输入的加密口令不一致');
      const bundle = createConnectionConfigBundle(
        connections.filter((entry) => selected.has(entry.id)),
      );
      const payload = encrypted
        ? await encryptConnectionConfig(bundle, passphrase, controller.signal)
        : bundle;
      controller.signal.throwIfAborted();
      const pretty = JSON.stringify(payload, null, 2);
      const content =
        !encrypted &&
        new TextEncoder().encode(pretty).length >
          CONNECTION_CONFIG_LIMITS.plainBytes
          ? JSON.stringify(payload)
          : pretty;
      const url = URL.createObjectURL(
        new Blob([content], {
          type: 'application/json;charset=utf-8',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fouc-connections-${new Date().toISOString().slice(0, 10)}${encrypted ? '.encrypted' : ''}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback(
        `已生成 ${bundle.connections.length} 个连接的${encrypted ? '加密' : '公开 JSON'}配置文件`,
      );
      setPassphrase('');
      setConfirm('');
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : '配置导出失败');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <SqlDialog
      title="导出连接配置"
      busy={busy}
      className={styles.dialog}
      onClose={onClose}
    >
      <div className={styles.body}>
        <div className={styles.scope}>
          <ShieldCheck size={15} />
          <span>
            当前目录 · {connections.length} 个连接 ·
            文件不包含密码、证书或私钥
          </span>
        </div>
        <div className={styles.listHead}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              disabled={busy}
              checked={selected.size === connections.length}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? new Set(connections.map((entry) => entry.id))
                    : new Set(),
                )
              }
            />
            选择全部
          </label>
          <small>已选择 {selected.size} 个</small>
        </div>
        <div className={styles.connectionList}>
          {connections.map((entry) => (
            <label key={entry.id} className={styles.exportRow}>
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.has(entry.id)}
                onChange={(event) =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (event.target.checked) next.add(entry.id);
                    else next.delete(entry.id);
                    return next;
                  })
                }
              />
              <div>
                <strong>{entry.name}</strong>
                <span>
                  {entry.config.provider === 'sqlite'
                    ? entry.config.path
                    : `${entry.config.host}:${entry.config.port} · ${entry.config.database}`}
                </span>
              </div>
              <small>{entry.config.provider}</small>
            </label>
          ))}
        </div>
        <div className={styles.protection}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={encrypted}
              disabled={busy}
              onChange={(event) => {
                setEncrypted(event.target.checked);
                setFeedback('');
              }}
            />
            <LockKey size={15} />
            使用口令加密配置文件
          </label>
          {encrypted ? (
            <div className={styles.columns}>
              <label>
                加密口令
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={busy}
                  value={passphrase}
                  minLength={12}
                  maxLength={1024}
                  placeholder="至少 12 个字符"
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </label>
              <label>
                再次输入口令
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={busy}
                  value={confirm}
                  maxLength={1024}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <p className={styles.warning}>
              公开 JSON 会显示连接名称、地址和用户名，请确认文件的接收位置。
            </p>
          )}
          <p className={styles.hint}>
            目标设备仍需重新提供连接密码及所需证书文件。加密口令只用于当前操作，请自行妥善保管。
          </p>
        </div>
        {error && (
          <p className={styles.error} role="alert">
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
      <footer className={`${common.dialogFooter} ${styles.footer}`}>
        <span>{selected.size} 个连接</span>
        <button
          type="button"
          className={common.secondary}
          onClick={() => {
            job.current?.abort();
            onClose();
          }}
        >
          {busy ? '取消导出' : '关闭'}
        </button>
        <button
          type="button"
          className={common.primary}
          disabled={
            busy ||
            !selected.size ||
            (encrypted &&
              (Array.from(passphrase).length < 12 || passphrase !== confirm))
          }
          onClick={() => void download()}
        >
          <DownloadSimple size={14} />
          {busy ? '正在加密…' : '下载配置文件'}
        </button>
      </footer>
    </SqlDialog>
  );
}
