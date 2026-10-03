'use client';

import { useId, useState } from 'react';
import {
  ArrowDown,
  Check,
  Copy,
  Link,
  WarningCircle,
} from '@phosphor-icons/react';
import type { NativeNetworkProvider } from '@fouc/shared/connection-options';
import {
  buildConnectionSource,
  parseConnectionSource,
  type ConnectionUrlFields,
  type ParsedConnectionSource,
} from '@fouc/shared/connection-options-url';
import styles from './connection-options.module.css';

export type ConnectionSourceAssistantProps = {
  provider: NativeNetworkProvider;
  fields: ConnectionUrlFields;
  onApply: (parsed: ParsedConnectionSource) => void;
  disabled?: boolean;
  onNotice?: (message: string) => void;
};

export function ConnectionSourceAssistant({
  provider,
  fields,
  onApply,
  disabled = false,
  onNotice,
}: ConnectionSourceAssistantProps) {
  const id = useId();
  const [source, setSource] = useState(''),
    [visible, setVisible] = useState(false);
  const [parsed, setParsed] = useState<{
    source: string;
    result: ParsedConnectionSource;
  } | null>(null);
  const [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const [format, setFormat] = useState<'url' | 'dsn'>('url');
  const [includePassword, setIncludePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const preview =
    parsed?.source === source && parsed.result.fields.provider === provider
      ? parsed.result
      : null;
  let built: ReturnType<typeof buildConnectionSource> | null = null,
    buildError = '';
  try {
    built = buildConnectionSource(
      fields,
      provider === 'postgres' ? format : 'url',
      includePassword,
    );
  } catch (reason) {
    buildError = reason instanceof Error ? reason.message : '连接 URL 无法生成';
  }

  function inspect() {
    setError('');
    setFeedback('');
    try {
      setParsed({ source, result: parseConnectionSource(source, provider) });
    } catch (reason) {
      setParsed(null);
      setError(
        reason instanceof Error ? reason.message : '连接 URL / DSN 无法解析',
      );
    }
  }
  async function copy() {
    if (!built || busy) return;
    const text = built.text;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('当前浏览器未提供剪贴板权限，可选中生成文本手动复制');
      await navigator.clipboard.writeText(text);
      const message =
        includePassword && fields.password
          ? '已复制包含密码的连接文本'
          : '已复制连接文本，未包含密码';
      setFeedback(message);
      onNotice?.(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '剪贴板写入失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className={styles.assistant}>
      <summary>
        <Link size={15} />
        <strong>连接 URL / DSN</strong>
        <span>解析与复制</span>
      </summary>
      <div className={styles.assistantBody}>
        <label className={styles.field} htmlFor={`${id}-source`}>
          <span>粘贴连接文本</span>
          <div className={styles.secretInput}>
            <input
              id={`${id}-source`}
              type={visible ? 'text' : 'password'}
              value={source}
              disabled={disabled}
              maxLength={8192}
              autoComplete="off"
              spellCheck={false}
              placeholder={
                provider === 'postgres'
                  ? 'postgresql://… 或 host=… dbname=…'
                  : `${provider}://…`
              }
              onChange={(event) => {
                setSource(event.target.value);
                setError('');
                setFeedback('');
              }}
            />
            <button
              type="button"
              disabled={disabled}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? '隐藏' : '显示'}
            </button>
          </div>
        </label>
        <div className={styles.sourceActions}>
          <small>文本可能包含密码，仅保留在当前表单。</small>
          <button
            type="button"
            disabled={disabled || !source.trim()}
            onClick={inspect}
          >
            解析连接文本
          </button>
        </div>
        {preview && (
          <div className={styles.parsed}>
            <dl>
              <div>
                <dt>主机</dt>
                <dd>
                  {preview.fields.mongo?.hosts
                    .map(
                      (host) =>
                        `${host.host}${preview.fields.mongo?.srv ? '' : `:${host.port}`}`,
                    )
                    .join(', ') ||
                    `${preview.fields.host}:${preview.fields.port}`}
                </dd>
              </div>
              <div>
                <dt>数据库</dt>
                <dd>{preview.fields.database || '未指定'}</dd>
              </div>
              <div>
                <dt>用户名</dt>
                <dd>{preview.fields.username || '未指定'}</dd>
              </div>
              <div>
                <dt>TLS</dt>
                <dd>
                  {preview.fields.connectionOptions.tls?.enabled
                    ? '开启 · 完整证书校验'
                    : '关闭'}
                </dd>
              </div>
            </dl>
            {preview.containsPassword && (
              <p className={styles.hint}>
                已解析密码；应用后仅用于本次连接或测试。
              </p>
            )}
            {preview.warnings.map((warning) => (
              <p className={styles.warning} key={warning}>
                <WarningCircle size={13} />
                {warning}
              </p>
            ))}
            <button
              type="button"
              className={styles.applyButton}
              disabled={disabled}
              onClick={() => {
                try {
                  onApply(preview);
                  setFeedback('已应用到连接表单');
                  setSource('');
                  setParsed(null);
                  setError('');
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : '连接文本应用失败',
                  );
                }
              }}
            >
              <ArrowDown size={14} />
              应用到表单
            </button>
          </div>
        )}
        <div className={styles.generated}>
          <div className={styles.sourceActions}>
            <strong>根据当前表单生成</strong>
            {provider === 'postgres' && (
              <select
                aria-label="连接文本格式"
                disabled={disabled}
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as 'url' | 'dsn');
                  setFeedback('');
                }}
              >
                <option value="url">连接 URL</option>
                <option value="dsn">libpq DSN</option>
              </select>
            )}
          </div>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              disabled={disabled || !fields.password}
              checked={includePassword}
              onChange={(event) => {
                setIncludePassword(event.target.checked);
                setFeedback('');
              }}
            />
            在复制文本中包含密码
          </label>
          {includePassword && fields.password && (
            <p className={styles.warning}>
              <WarningCircle size={13} />
              复制内容包含密码，请确认粘贴位置。
            </p>
          )}
          {built && (
            <textarea
              readOnly
              aria-label="生成的连接文本"
              value={built.text}
              rows={3}
              spellCheck={false}
            />
          )}
          {buildError && <p className={styles.hint}>{buildError}</p>}
          {built?.warnings.map((warning) => (
            <p className={styles.hint} key={warning}>
              {warning}
            </p>
          ))}
          <button
            type="button"
            disabled={disabled || busy || !built}
            onClick={() => void copy()}
          >
            <Copy size={14} />
            {busy
              ? '复制中…'
              : `复制${provider === 'postgres' && format === 'dsn' ? ' DSN' : ' URL'}`}
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            <WarningCircle size={14} />
            {error}
          </p>
        )}
        {feedback && (
          <p className={styles.success} role="status">
            <Check size={14} />
            {feedback}
          </p>
        )}
      </div>
    </details>
  );
}
