'use client';
import { backendFetch } from '@/lib/backend';
import { useTranslation } from '@/lib/i18n';
import type { RedisDatabaseList, RedisSession } from '@fouc/shared';
import { ArrowRight, ArrowsClockwise, Database, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import common from '../datastore/relational.module.css';
import { createUiMessages, uiFailure, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-database-selector';
import styles from './redis-database-selector.module.css';
const { message: uiMessage } = createUiMessages(unitMessages);

export function RedisDatabaseSelector({
  base,
  current,
  onClose,
  onSwitch,
}: {
  base: string;
  current: number;
  onClose: () => void;
  onSwitch: (session: RedisSession) => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const dialog = useRef<HTMLDialogElement>(null);
  const currentChoice = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState<RedisDatabaseList | null>(null);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [requested, setRequested] = useState(String(current));
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<UiMessage>('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void backendFetch<RedisDatabaseList>(`${base}/databases?offset=${offset}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setPage(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(uiFailure(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, offset, revision]);
  useEffect(() => {
    if (!loading) currentChoice.current?.scrollIntoView({ block: 'nearest' });
  }, [loading, page]);
  function reload(nextOffset = offset) {
    setLoading(true);
    setError('');
    setOffset(nextOffset);
    setRevision((current) => current + 1);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!/^\d+$/.test(requested) || Number(requested) > 2147483646) {
      setError(uiMessage('请输入有效的非负数据库编号。'));
      return;
    }
    setSwitching(true);
    try {
      const session = await backendFetch<RedisSession>(`${base}/database`, {
        method: 'POST',
        body: JSON.stringify({ database: Number(requested) }),
      });
      onSwitch(session);
    } catch (reason) {
      setError(uiFailure(reason));
    } finally {
      setSwitching(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`${common.dialog} ${styles.dialog}`}
      aria-labelledby="redis-database-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!switching) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <header className={common.dialogHead}>
          <div>
            <Database size={18} />
            <h2 id="redis-database-title">{tu('切换 Redis 数据库')}</h2>
          </div>
          <button
            type="button"
            aria-label={tu('关闭数据库选择')}
            disabled={switching}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className={styles.body}>
          <div className={styles.summary}>
            <span>
              {tu('当前 DB')} {current} ·{' '}
              {page?.configuredCount === null || !page
                ? tu('数据库数量未知')
                : tu('{v0} 个数据库', { v0: String(page.configuredCount) })}
            </span>
            <button
              type="button"
              aria-label={tu('刷新数据库目录')}
              disabled={loading || switching}
              onClick={() => reload()}
            >
              <ArrowsClockwise size={14} />
            </button>
          </div>
          <p className={common.hint}>
            {tu(
              '成功切换后重新锁定写入，并清除当前 Key 与分页状态。保存的连接默认 DB 保持原设置。',
            )}
          </p>
          {page?.warnings.map((warning) => (
            <p className={styles.warning} key={warning}>
              {uiText(warning, locale)}
            </p>
          ))}
          {loading ? (
            <p role="status" className={common.hint}>
              {tu('正在读取数据库目录…')}
            </p>
          ) : (
            <div className={styles.grid}>
              {page?.databases.map((database) => (
                <button
                  type="button"
                  key={database.database}
                  ref={database.database === current ? currentChoice : undefined}
                  aria-pressed={Number(requested) === database.database}
                  disabled={switching}
                  onClick={() => setRequested(String(database.database))}
                >
                  <strong>
                    DB {database.database}
                    {database.database === current && <small>{tu('当前')}</small>}
                  </strong>
                  <span>
                    {database.keys === null
                      ? tu('Key 数量未知')
                      : tu('{v0} 个 Key', { v0: String(database.keys) })}
                  </span>
                  {database.expires !== null && (
                    <small>
                      {database.expires} {tu('个有期限')}
                    </small>
                  )}
                </button>
              ))}
              {!page?.databases.length && (
                <p className={common.hint}>
                  {tu('当前页没有可列出的数据库；可直接输入编号验证。')}
                </p>
              )}
            </div>
          )}
          {page && (offset > 0 || page.nextOffset !== null) && (
            <div className={styles.paging}>
              <button
                type="button"
                disabled={loading || switching || offset === 0}
                onClick={() => reload(Math.max(0, offset - 128))}
              >
                {tu('上一页')}
              </button>
              <span>
                {tu('从第')} {offset + 1} {tu('项起')}
              </span>
              <button
                type="button"
                disabled={loading || switching || page.nextOffset === null}
                onClick={() => reload(page.nextOffset!)}
              >
                {tu('下一页')}
              </button>
            </div>
          )}
          <label className={styles.field}>
            {tu('数据库编号')}
            <input
              aria-label={tu('目标数据库编号')}
              inputMode="numeric"
              value={requested}
              disabled={switching}
              onChange={(event) => setRequested(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className={common.error}>
              {uiText(error, locale)}
            </p>
          )}
          {switching && (
            <p role="status" className={common.hint}>
              {tu('正在连接目标 DB，等待验证结果…')}
            </p>
          )}
        </div>
        <footer className={common.dialogFooter}>
          <button type="button" className={common.secondary} disabled={switching} onClick={onClose}>
            {tu('取消')}
          </button>
          <span />
          <button type="submit" className={common.primary} disabled={switching || !requested}>
            {switching ? tu('连接中…') : tu('切换数据库')}
            <ArrowRight size={13} />
          </button>
        </footer>
      </form>
    </dialog>
  );
}
