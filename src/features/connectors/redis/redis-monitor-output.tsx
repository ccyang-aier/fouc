'use client';
import { useTranslation } from '@/lib/i18n';
import { Check, Copy, MagnifyingGlass, Stop } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createUiMessages, uiText, type UiMessage } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-monitor-output';
import styles from './redis-monitor.module.css';
import type { RedisMonitorState } from './use-redis-monitor';
const { message: uiMessage } = createUiMessages(unitMessages);

export function RedisMonitorOutput({
  state,
  onStop,
}: {
  state: RedisMonitorState;
  onStop: () => void;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [filter, setFilter] = useState('');
  const [follow, setFollow] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<UiMessage>('');
  const viewport = useRef<HTMLDivElement>(null);
  const records = state.records.filter((record) =>
    record.message.toLowerCase().includes(filter.toLowerCase()),
  );
  const active = state.status === 'connecting' || state.status === 'listening';
  useEffect(() => {
    if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [state.records, filter, follow]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        records
          .map((record) => record.message + (record.truncated ? ' … [已截断]' : ''))
          .join('\n'),
      );
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError(uiMessage('复制失败，请选择记录复制。'));
    }
  }
  return (
    <section className={styles.panel} aria-label={tu('Redis 实时 MONITOR')}>
      <header className={styles.header}>
        <span className={styles.status} data-active={state.status === 'listening'} role="status">
          {state.status === 'connecting'
            ? tu('正在建立独立监听连接…')
            : state.status === 'listening'
              ? tu('MONITOR 正在监听')
              : state.status === 'stopped'
                ? tu('MONITOR 已停止')
                : tu('MONITOR 读取失败')}
        </span>
        {active && (
          <button type="button" aria-label={tu('停止 Redis MONITOR')} onClick={onStop}>
            <Stop size={13} />
            {tu('停止')}
          </button>
        )}
        <button
          type="button"
          disabled={!records.length}
          aria-label={tu('复制 MONITOR 输出')}
          onClick={() => void copy()}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? tu('已复制') : tu('复制')}
        </button>
      </header>
      <div className={styles.toolbar}>
        <label>
          <MagnifyingGlass size={13} />
          <input
            aria-label={tu('筛选 MONITOR 记录')}
            value={filter}
            placeholder={tu('筛选命令、Key 或来源')}
            onChange={(event) => {
              setFilter(event.target.value);
              setCopied(false);
            }}
          />
        </label>
        <label className={styles.follow}>
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => setFollow(event.target.checked)}
          />
          {tu('跟随最新')}
        </label>
      </div>
      {state.error && (
        <p role="alert" className={styles.error}>
          {uiText(state.error, locale)} {tu('· 已保留接收记录，可重新运行 MONITOR。')}
        </p>
      )}
      {copyError && (
        <p role="alert" className={styles.error}>
          {uiText(copyError, locale)}
        </p>
      )}
      <div ref={viewport} className={styles.records} tabIndex={0} aria-label={tu('MONITOR 记录')}>
        {records.map((record) => (
          <div key={record.sequence}>
            <span>{record.sequence}</span>
            <code>
              {record.message}
              {record.truncated && <em> {tu('… [已截断]')}</em>}
            </code>
          </div>
        ))}
        {!records.length && (
          <p>
            {state.records.length
              ? tu('没有匹配的记录。')
              : state.status === 'listening'
                ? tu('等待此实例收到命令…')
                : state.status === 'connecting'
                  ? tu('等待服务器确认 MONITOR…')
                  : tu('没有接收记录。')}
          </p>
        )}
      </div>
      <footer>
        {tu('显示')} {records.length} / {state.records.length}{' '}
        {tu('条 · 仅保留最新 1000 条 · 单条最多 16 KiB')}
        {state.dropped > 0 && (
          <strong>
            {' '}
            {tu('· 传输缓冲已丢弃')} {state.dropped} {tu('条，记录不完整')}
          </strong>
        )}
      </footer>
    </section>
  );
}
