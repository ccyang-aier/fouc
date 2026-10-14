'use client';
import { BackendRequestError, backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import type {
  RedisBulkOperation,
  RedisBulkPreview,
  RedisBulkResult,
} from '@fouc/shared/redis-bulk';
import { Key, LockOpen, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { uiFailure, uiText, type UiMessage } from '../../i18n/ui-message';
import { messages as unitMessages } from './../i18n/bulk-dialog';
import styles from './bulk.module.css';
import { bulkOperation, operationLabels } from './model';
import { RedisBulkOutcome, RedisBulkReview } from './review';

export type RedisBulkDialogProps = {
  base: string;
  database: number;
  keys: string[];
  readOnly: boolean;
  onUnlock: () => Promise<void>;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onApplied: (result: RedisBulkResult) => void;
};

export function RedisBulkDialog({
  base,
  database,
  keys,
  readOnly,
  onUnlock,
  onClose,
  onBusyChange,
  onApplied,
}: RedisBulkDialogProps) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const plan = useRef<string | null>(null);
  const [kind, setKind] = useState<RedisBulkOperation['kind']>('relative-ttl');
  const [seconds, setSeconds] = useState('3600');
  const [deadline, setDeadline] = useState('');
  const [preview, setPreview] = useState<RedisBulkPreview | null>(null);
  const [result, setResult] = useState<RedisBulkResult | null>(null);
  const [resultFailure, setResultFailure] = useState<UiMessage | null>(null);
  const [busy, setBusy] = useState<'' | 'preview' | 'unlock' | 'execute'>('');
  const [confirmed, setConfirmed] = useState(false);
  const [dangerText, setDangerText] = useState('');
  const [error, setError] = useState<UiMessage>('');
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      request.current?.abort();
      if (plan.current)
        void backendFetch(`${base}/bulk/plans/${plan.current}`, { method: 'DELETE' }).catch(
          () => {},
        );
    };
  }, [base]);
  useEffect(() => {
    onBusyChange(Boolean(busy));
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  function invalidate() {
    if (plan.current)
      void backendFetch(`${base}/bulk/plans/${plan.current}`, { method: 'DELETE' }).catch(() => {});
    plan.current = null;
    setPreview(null);
    setConfirmed(false);
    setDangerText('');
    setError('');
  }
  async function prepare() {
    invalidate();
    setBusy('preview');
    const controller = new AbortController();
    request.current = controller;
    try {
      const operation = bulkOperation(kind, seconds, deadline);
      const next = await backendFetch<RedisBulkPreview>(`${base}/bulk/preview`, {
        method: 'POST',
        body: JSON.stringify({ database, keys, operation }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        plan.current = next.planId;
        setPreview(next);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(uiFailure(reason));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy('');
    }
  }
  async function unlock() {
    invalidate();
    setBusy('unlock');
    try {
      await onUnlock();
    } catch (reason) {
      setError(uiFailure(reason));
    } finally {
      setBusy('');
    }
  }
  async function execute() {
    if (!preview || !confirmed || readOnly || (preview.dangerous && dangerText !== 'DELETE'))
      return;
    setBusy('execute');
    setError('');
    const id = preview.planId;
    plan.current = null;
    try {
      const next = await backendFetch<RedisBulkResult>(`${base}/bulk/commit`, {
        method: 'POST',
        body: JSON.stringify({
          planId: id,
          confirmed: true,
          dangerConfirmed: preview.dangerous && dangerText === 'DELETE',
        }),
      });
      setResult(next);
      setResultFailure(null);
      setPreview(null);
      onApplied(next);
    } catch (reason) {
      // Input/auth rejections precede dispatch. Lost transport responses cannot prove whether Redis wrote.
      const rejected =
        reason instanceof BackendRequestError && [400, 401, 403].includes(reason.status);
      setResultFailure(uiFailure(reason));
      const next: RedisBulkResult = {
        planId: id,
        database,
        state: rejected ? 'failed' : 'unknown',
        executionTimeMs: 0,
        applied: 0,
        unchanged: 0,
        missing: 0,
        unknown: rejected ? 0 : preview.keys.length,
        keys: preview.keys.map((item) => ({
          key: item.key,
          state: rejected ? 'failed' : 'unknown',
          expiresAt: null,
          reason: reason instanceof Error ? reason.message : String(reason),
        })),
      };
      setResult(next);
      setPreview(null);
      onApplied(next);
    } finally {
      setBusy('');
    }
  }
  function close() {
    if (busy === 'execute' || busy === 'unlock') return;
    request.current?.abort();
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="redis-bulk-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{tu('REDIS / BATCH REVIEW')}</span>
          <h2 id="redis-bulk-title">{tu('批量 Key 与过期时间')}</h2>
        </div>
        <button
          type="button"
          aria-label={tu('关闭批量操作')}
          disabled={busy === 'execute' || busy === 'unlock'}
          onClick={close}
        >
          <X size={17} />
        </button>
      </header>
      <div className={styles.body}>
        <div className={styles.scope}>
          <Key size={17} />
          <div>
            <strong>
              DB {database} {tu('· 已冻结选择')} {keys.length} {tu('个 Key')}
            </strong>
            <small>{tu('来自当前已加载列表；不扩展匹配规则或继续扫描的范围。')}</small>
          </div>
        </div>
        {result ? (
          <RedisBulkOutcome result={result} failure={resultFailure} />
        ) : (
          <>
            <fieldset className={styles.options} disabled={Boolean(busy)}>
              <label>
                {tu('操作')}
                <select
                  aria-label={tu('批量操作类型')}
                  value={kind}
                  onChange={(event) => {
                    invalidate();
                    setKind(event.target.value as RedisBulkOperation['kind']);
                  }}
                >
                  {Object.entries(operationLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {uiText(label, locale)}
                    </option>
                  ))}
                </select>
              </label>
              {kind === 'relative-ttl' && (
                <label>
                  {tu('有效期 · 秒')}
                  <input
                    aria-label={tu('批量 TTL 秒数')}
                    inputMode="numeric"
                    value={seconds}
                    onChange={(event) => {
                      invalidate();
                      setSeconds(event.target.value);
                    }}
                  />
                  <small>{tu('从 Redis 实际执行时开始计时。')}</small>
                </label>
              )}
              {kind === 'absolute-ttl' && (
                <label>
                  {tu('本地绝对过期时间')}
                  <input
                    aria-label={tu('批量绝对过期时间')}
                    type="datetime-local"
                    step="1"
                    value={deadline}
                    onChange={(event) => {
                      invalidate();
                      setDeadline(event.target.value);
                    }}
                  />
                  <small>{tu('使用当前浏览器时区；过去的期限会立即删除。')}</small>
                </label>
              )}
            </fieldset>
            {!preview && (
              <p className={styles.notice}>
                {tu(
                  '先生成只读预览，核对实际类型、原始快照与绝对期限。永久保留请明确选择 PERSIST；删除需要额外输入 DELETE。',
                )}
              </p>
            )}
            {preview && <RedisBulkReview preview={preview} />}
            {preview && readOnly && (
              <div className={styles.locked}>
                <LockOpen size={16} />
                <div>
                  <strong>{tu('当前会话保持只读')}</strong>
                  <span>{tu('解锁会使旧计划失效；随后需重新预览并确认。')}</span>
                </div>
                <button type="button" disabled={Boolean(busy)} onClick={() => void unlock()}>
                  {tu('解锁本次会话')}
                </button>
              </div>
            )}
            {preview && !readOnly && (
              <div className={styles.confirmation}>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={Boolean(busy)}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  {tu('我已核对')} {keys.length}{' '}
                  {tu('个 Key，确认提交此一次性计划；脚本运行时错误不会自动回滚。')}
                </label>
                {preview.dangerous && (
                  <label className={styles.dangerConfirm}>
                    {tu('输入 DELETE 确认不可撤销删除')}
                    <input
                      aria-label={tu('输入 DELETE 确认批量删除')}
                      value={dangerText}
                      autoComplete="off"
                      disabled={Boolean(busy)}
                      onChange={(event) => setDangerText(event.target.value)}
                      placeholder="DELETE"
                    />
                  </label>
                )}
              </div>
            )}
          </>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {uiText(error, locale)}
          </p>
        )}
        {busy === 'execute' && (
          <p className={styles.notice} role="status">
            {tu('单个 Lua 批次已发送，等待 Redis 实际确认；此时取消无法撤回已发送的命令。')}
          </p>
        )}
      </div>
      <footer className={styles.footer}>
        <span>
          {busy === 'preview'
            ? tu('读取有界原始快照…')
            : busy === 'unlock'
              ? tu('校验写入能力…')
              : tu('最多 100 Key · 单脚本隔离 · 原值与绝对期限保护')}
        </span>
        <button type="button" disabled={busy === 'execute' || busy === 'unlock'} onClick={close}>
          {result ? tu('完成') : busy === 'preview' ? tu('取消预览') : tu('取消')}
        </button>
        {!result && (
          <button type="button" disabled={Boolean(busy)} onClick={() => void prepare()}>
            {preview ? tu('重新预览') : tu('生成只读预览')}
          </button>
        )}
        {preview && !readOnly && (
          <button
            type="button"
            className={preview.dangerous ? styles.dangerButton : styles.primary}
            disabled={Boolean(busy) || !confirmed || (preview.dangerous && dangerText !== 'DELETE')}
            onClick={() => void execute()}
          >
            {busy === 'execute' ? tu('等待确认…') : tu('确认执行一次')}
          </button>
        )}
      </footer>
    </dialog>
  );
}
