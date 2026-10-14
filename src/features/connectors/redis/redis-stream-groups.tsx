'use client';
import { type UiMessage } from '../i18n/ui-message';

import { backendFetch } from '@/lib/backend';
import { useTranslation, type Locale } from '@/lib/i18n';
import type {
  RedisBlob,
  RedisStreamConsumer,
  RedisStreamConsumers,
  RedisStreamGroup,
  RedisStreamGroups,
  RedisStreamPendingPage,
} from '@fouc/shared';
import { ArrowsClockwise, CaretRight, Copy, UsersThree } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createUiMessages, uiFailure, uiText } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-stream-groups';
import { redisInteger } from './redis-observability-model';
import { redisStreamDuration } from './redis-stream-model';
import styles from './redis-stream.module.css';
import { useRedisStreamRead } from './use-redis-stream-read';
const { message: uiMessage } = createUiMessages(unitMessages);

const label = (name: RedisBlob, locale: Locale) =>
  name.display || uiText(uiMessage('（空名称）'), locale);
export function RedisStreamGroupsView({ base, rawKey }: { base: string; rawKey: string }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const selection = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<UiMessage>('');
  function select(value: string | null) {
    selection.current = value;
    setSelected(value);
    setFeedback('');
  }
  const reconcile = useCallback((page: RedisStreamGroups) => {
    if (
      selection.current !== null &&
      !page.groups.some((group) => group.name.rawBase64 === selection.current)
    ) {
      selection.current = null;
      setSelected(null);
      setFeedback(uiMessage('所选消费组已不存在，已返回消费组列表。'));
    }
  }, []);
  const { data, loading, error } = useRedisStreamRead<RedisStreamGroups>(
    `${base}/stream/groups`,
    JSON.stringify({ key: rawKey }),
    revision,
    reconcile,
  );
  const group = data?.groups.find((item) => item.name.rawBase64 === selected);
  return (
    <section className={styles.panel} aria-label={tu('Stream 消费组')}>
      <div className={styles.toolbar}>
        <UsersThree size={15} />
        <button type="button" onClick={() => select(null)}>
          {tu('消费组')}
        </button>
        {group && (
          <>
            <CaretRight size={12} />
            <span title={label(group.name, locale)}>{label(group.name, locale)}</span>
          </>
        )}
        <button
          type="button"
          className={styles.refresh}
          aria-label={tu('刷新 Stream 消费组')}
          disabled={loading}
          onClick={() => {
            setFeedback('');
            setRevision((value) => value + 1);
          }}
        >
          <ArrowsClockwise size={14} />
          {loading ? tu('读取中…') : tu('刷新')}
        </button>
      </div>
      {error && (
        <ReadError
          text={uiText(error, locale)}
          retained={Boolean(data)}
          onRetry={() => setRevision((value) => value + 1)}
        />
      )}
      {feedback && (
        <p role="status" className={styles.notice}>
          {uiText(feedback, locale)}
        </p>
      )}
      {loading && !data ? (
        <div className={styles.empty} role="status">
          {tu('正在读取消费组…')}
        </div>
      ) : group ? (
        <GroupDetail
          key={group.name.rawBase64}
          base={base}
          rawKey={rawKey}
          group={group}
          revision={data!.fetchedAt}
        />
      ) : (
        <div className={styles.scroll}>
          <table className={styles.groupsTable}>
            <thead>
              <tr>
                {(
                  ['消费组', '消费者', 'Pending', '最后投递 ID', 'Entries read', 'Lag'] as const
                ).map((column) => (
                  <th key={column} scope="col">
                    {uiText(uiMessage(column), locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.groups.map((item) => (
                <tr key={item.name.rawBase64}>
                  <td>
                    <button
                      type="button"
                      aria-label={tu('打开消费组 {v0}', { v0: String(label(item.name, locale)) })}
                      title={label(item.name, locale)}
                      onClick={() => select(item.name.rawBase64)}
                    >
                      {label(item.name, locale)}
                    </button>
                  </td>
                  <td>{redisInteger(item.consumers, locale)}</td>
                  <td>{redisInteger(item.pending, locale)}</td>
                  <td>
                    <code>{item.lastDeliveredId}</code>
                  </td>
                  <td>{redisInteger(item.entriesRead, locale)}</td>
                  <td>{redisInteger(item.lag, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.groups.length && !error && (
            <p className={styles.empty}>{tu('当前 Stream 没有消费组。')}</p>
          )}
        </div>
      )}
      <footer className={styles.footer}>
        {tu('观测读取 · Pending 是已投递未确认的消息 · Lag 未知时显示未知')}
      </footer>
    </section>
  );
}
function GroupDetail({
  base,
  rawKey,
  group,
  revision,
}: {
  base: string;
  rawKey: string;
  group: RedisStreamGroup;
  revision: number;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const selection = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<UiMessage>('');
  function select(value: string | null) {
    selection.current = value;
    setSelected(value);
    setFeedback('');
  }
  const reconcile = useCallback((page: RedisStreamConsumers) => {
    if (
      selection.current !== null &&
      !page.consumers.some((consumer) => consumer.name.rawBase64 === selection.current)
    ) {
      selection.current = null;
      setSelected(null);
      setFeedback(uiMessage('所选消费者已不存在，已返回消费者列表。'));
    }
  }, []);
  const { data, loading, error } = useRedisStreamRead<RedisStreamConsumers>(
    `${base}/stream/consumers`,
    JSON.stringify({ key: rawKey, group: group.name.rawBase64 }),
    revision + retry,
    reconcile,
  );
  const consumer = data?.consumers.find((item) => item.name.rawBase64 === selected);
  const metrics: Array<[keyof typeof unitMessages, string]> = consumer
    ? [
        ['Pending', redisInteger(consumer.pending, locale)],
        ['Idle', redisStreamDuration(consumer.idleMs, locale)],
        ['Inactive', redisStreamDuration(consumer.inactiveMs, locale)],
      ]
    : [
        ['消费者', redisInteger(group.consumers, locale)],
        ['Pending', redisInteger(group.pending, locale)],
        ['Lag', redisInteger(group.lag, locale)],
      ];
  return (
    <div className={styles.scroll}>
      <div className={styles.breadcrumb}>
        <button type="button" title={label(group.name, locale)} onClick={() => select(null)}>
          {label(group.name, locale)}
        </button>
        {consumer && (
          <>
            <CaretRight size={12} />
            <strong title={label(consumer.name, locale)}>{label(consumer.name, locale)}</strong>
          </>
        )}
      </div>
      <div className={styles.metrics}>
        {metrics.map(([name, value]) => (
          <article key={name}>
            <span>{uiText(uiMessage(name), locale)}</span>
            <strong title={value}>{value}</strong>
          </article>
        ))}
      </div>
      {!consumer && (
        <p className={styles.position}>
          {tu('最后投递')} <code>{group.lastDeliveredId}</code> {tu('· 逻辑读取')}{' '}
          {redisInteger(group.entriesRead, locale)}
        </p>
      )}
      {feedback && (
        <p role="status" className={styles.notice}>
          {uiText(feedback, locale)}
        </p>
      )}
      {error && (
        <ReadError
          text={uiText(error, locale)}
          retained={Boolean(data)}
          onRetry={() => setRetry((value) => value + 1)}
        />
      )}
      {consumer ? (
        <PendingDetail
          key={consumer.name.rawBase64}
          base={base}
          rawKey={rawKey}
          group={group}
          consumer={consumer}
          revision={data!.fetchedAt}
        />
      ) : (
        <section className={styles.card} aria-label={tu('Stream 消费者')}>
          <div className={styles.cardHeader}>
            <strong>
              {tu('消费者 ·')} {data?.consumers.length ?? 0}
            </strong>
            <button
              type="button"
              aria-label={tu('刷新 Stream 消费者')}
              disabled={loading}
              onClick={() => setRetry((value) => value + 1)}
            >
              <ArrowsClockwise size={13} />
            </button>
          </div>
          {loading && !data ? (
            <p className={styles.empty} role="status">
              {tu('正在读取消费者…')}
            </p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.consumersTable}>
                <thead>
                  <tr>
                    {(['消费者', 'Pending', 'Idle', 'Inactive'] as const).map((column) => (
                      <th key={column} scope="col">
                        {uiText(uiMessage(column), locale)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.consumers.map((item) => (
                    <tr key={item.name.rawBase64}>
                      <td>
                        <button
                          type="button"
                          aria-label={tu('打开消费者 {v0}', {
                            v0: String(label(item.name, locale)),
                          })}
                          title={label(item.name, locale)}
                          onClick={() => select(item.name.rawBase64)}
                        >
                          {label(item.name, locale)}
                        </button>
                      </td>
                      <td>{redisInteger(item.pending, locale)}</td>
                      <td title={`${item.idleMs} ms`}>
                        {redisStreamDuration(item.idleMs, locale)}
                      </td>
                      <td title={item.inactiveMs === null ? tu('未知') : `${item.inactiveMs} ms`}>
                        {redisStreamDuration(item.inactiveMs, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.consumers.length && !error && (
                <p className={styles.empty}>{tu('当前消费组没有消费者。')}</p>
              )}
            </div>
          )}
        </section>
      )}
      <p className={styles.notice}>
        {tu(
          'Idle / Inactive 的含义依 Redis 版本而定；Inactive 未提供时不推断为零。指标是每次读取时的观测值。',
        )}
      </p>
    </div>
  );
}
function PendingDetail({
  base,
  rawKey,
  group,
  consumer,
  revision,
}: {
  base: string;
  rawKey: string;
  group: RedisStreamGroup;
  consumer: RedisStreamConsumer;
  revision: number;
}) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [request, setRequest] = useState({
    epoch: revision,
    cursor: null as string | null,
    serial: 0,
  });
  const [page, setPage] = useState<RedisStreamPendingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UiMessage>('');
  const [copyMessage, setCopyMessage] = useState<UiMessage>('');
  const cursor = request.epoch === revision ? request.cursor : null;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const result = await backendFetch<RedisStreamPendingPage>(`${base}/stream/pending`, {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            key: rawKey,
            group: group.name.rawBase64,
            consumer: consumer.name.rawBase64,
            cursor,
          }),
        });
        if (!controller.signal.aborted) {
          setPage((current) => ({
            ...result,
            entries: cursor
              ? [
                  ...new Map(
                    [...(current?.entries ?? []), ...result.entries].map((entry) => [
                      entry.id,
                      entry,
                    ]),
                  ).values(),
                ]
              : result.entries,
          }));
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(uiFailure(reason));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [
    base,
    rawKey,
    group.name.rawBase64,
    consumer.name.rawBase64,
    revision,
    cursor,
    request.serial,
  ]);
  function read(next: string | null) {
    setCopyMessage('');
    setRequest((current) => ({ epoch: revision, cursor: next, serial: current.serial + 1 }));
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(page?.entries ?? [], null, 2));
      setCopyMessage(uiMessage('已复制当前已加载的 Pending JSON'));
    } catch {
      setCopyMessage(uiMessage('复制失败，请选择消息 ID 复制。'));
    }
  }
  return (
    <section className={styles.card} aria-label={tu('Stream Pending')}>
      <div className={styles.cardHeader}>
        <strong>
          {tu('Pending · 已加载')} {page?.entries.length ?? 0}
        </strong>
        <button
          type="button"
          aria-label={tu('复制 Stream Pending JSON')}
          disabled={!page}
          onClick={() => void copy()}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          aria-label={tu('刷新 Stream Pending')}
          disabled={loading}
          onClick={() => read(null)}
        >
          <ArrowsClockwise size={13} />
        </button>
      </div>
      {error && (
        <ReadError
          text={uiText(error, locale)}
          retained={Boolean(page)}
          onRetry={() => read(cursor)}
        />
      )}
      {copyMessage && (
        <p role="status" className={styles.notice}>
          {uiText(copyMessage, locale)}
        </p>
      )}
      {loading && !page ? (
        <p className={styles.empty} role="status">
          {tu('正在读取 Pending…')}
        </p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.pendingTable}>
            <thead>
              <tr>
                {(['消息 ID', '距上次投递', '投递次数'] as const).map((column) => (
                  <th key={column} scope="col">
                    {uiText(uiMessage(column), locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page?.entries.map((entry) => (
                <tr key={entry.id}>
                  <td title={entry.id}>
                    <code>{entry.id}</code>
                  </td>
                  <td title={`${entry.idleMs} ms`}>{redisStreamDuration(entry.idleMs, locale)}</td>
                  <td>{redisInteger(entry.deliveries, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!page?.entries.length && !error && (
            <p className={styles.empty}>{tu('当前消费者没有 Pending 消息。')}</p>
          )}
        </div>
      )}
      {page?.nextCursor && (
        <button
          type="button"
          className={styles.more}
          disabled={loading}
          onClick={() => read(page.nextCursor)}
        >
          {loading ? tu('读取中…') : tu('加载更多 Pending')}
        </button>
      )}
    </section>
  );
}
function ReadError({
  text,
  retained,
  onRetry,
}: {
  text: string;
  retained: boolean;
  onRetry: () => void;
}) {
  const { t: tu } = useTranslation(unitMessages);

  return (
    <div role="alert" className={styles.error}>
      {text}
      {retained && tu(' · 保留上次数据')}
      <button type="button" onClick={onRetry}>
        {tu('重试')}
      </button>
    </div>
  );
}
