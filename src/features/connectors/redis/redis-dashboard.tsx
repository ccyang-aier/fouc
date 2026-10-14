'use client';
import { AppAlert } from '@/components/app-alert';
import { useAppAlert } from '@/components/app-alert-provider';
import { Button } from '@/components/ui/button';
import { createTranslator, useTranslation } from '@/lib/i18n';
import type { RedisInfoSnapshot } from '@fouc/shared';
import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  ChartLineUp,
  Copy,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { createUiMessages, uiText, type UiDescriptor } from '../i18n/ui-message';
import { messages as unitMessages } from './i18n/redis-dashboard';
import {
  redisBytes,
  redisHitRatio,
  redisInfoFilter,
  redisInfoValue,
  redisInteger,
  redisTotalKeys,
} from './redis-observability-model';
import styles from './redis-observability.module.css';
import { useRedisPoll } from './use-redis-poll';
const { message: uiMessage } = createUiMessages(unitMessages);

const eventText = createTranslator(unitMessages);

const sectionNames: Partial<Record<string, UiDescriptor>> = {
  Server: uiMessage('服务器'),
  Clients: uiMessage('客户端'),
  Memory: uiMessage('内存'),
  Persistence: uiMessage('持久化'),
  Stats: uiMessage('统计'),
  Replication: uiMessage('Replication section'),
  Modules: uiMessage('模块'),
  Commandstats: uiMessage('命令统计'),
  Errorstats: uiMessage('错误统计'),
  Latencystats: uiMessage('延迟统计'),
  Cluster: uiMessage('集群'),
  Keyspace: uiMessage('数据库'),
};

export function RedisDashboard({ base }: { base: string }) {
  const { t: tu, locale } = useTranslation(unitMessages);

  const [interval, setInterval] = useState(0);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { notify } = useAppAlert();
  const { data, loading, error } = useRedisPoll<RedisInfoSnapshot>(
    `${base}/info`,
    interval,
    revision,
  );
  const sections = data?.sections ?? [];
  const value = (section: string, key: string) => redisInfoValue(sections, section, key);
  const metrics = [
    ['已用内存', redisBytes(value('Memory', 'used_memory'), locale), 'used_memory'],
    [
      '内存上限',
      value('Memory', 'maxmemory') === '0'
        ? tu('未限额')
        : redisBytes(value('Memory', 'maxmemory'), locale),
      'maxmemory',
    ],
    [
      '命令 / 秒',
      redisInteger(value('Stats', 'instantaneous_ops_per_sec'), locale),
      'instantaneous_ops_per_sec',
    ],
    [
      '命中率',
      redisHitRatio(value('Stats', 'keyspace_hits'), value('Stats', 'keyspace_misses'), locale),
      'keyspace_hits / (hits + misses)',
    ],
    [
      '全部 DB 的 Key',
      redisInteger(redisTotalKeys(sections), locale),
      'INFO Keyspace · 所有数据库',
    ],
    [
      '已连接客户端',
      redisInteger(value('Clients', 'connected_clients'), locale),
      'connected_clients',
    ],
    [
      '累计命令',
      redisInteger(value('Stats', 'total_commands_processed'), locale),
      'total_commands_processed',
    ],
    ['运行天数', redisInteger(value('Server', 'uptime_in_days'), locale), 'uptime_in_days'],
  ] as const;
  const filtered = redisInfoFilter(sections, search);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('success', eventText('已复制指标'));
    } catch {
      notify('error', eventText('复制失败，请选中指标文字复制。'));
    }
  }
  return (
    <section className={styles.panel} aria-label={tu('Redis 运行概览')}>
      <div className={styles.toolbar}>
        <div className={styles.identity}>
          <ChartLineUp size={16} />
          <strong>{tu('运行概览')}</strong>
          <span>{tu('当前 Redis 实例')}</span>
        </div>
        <label>
          {tu('自动刷新')}
          <select
            aria-label={tu('概览自动刷新')}
            value={interval}
            onChange={(event) => setInterval(Number(event.target.value))}
          >
            {[0, 5, 10, 30, 60].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds ? tu('{v0} 秒', { v0: String(seconds) }) : tu('关闭')}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={tu('刷新 Redis 运行概览')}
          disabled={loading}
          onClick={() => setRevision((current) => current + 1)}
        >
          <ArrowsClockwise size={15} />
          {loading ? tu('读取中…') : tu('刷新')}
        </button>
      </div>
      {error ? (
        <AppAlert
          tone="error"
          title={uiText(error, locale)}
          description={data ? tu('下方保留上次数据，尚未刷新。') : undefined}
          action={
            <Button
              size="sm"
              disabled={loading}
              onClick={() => setRevision((current) => current + 1)}
            >
              {tu('重试')}
            </Button>
          }
        />
      ) : null}
      <div className={styles.scroll}>
        <div className={styles.lead}>
          <div>
            <small>{tu('SERVER OVERVIEW')}</small>
            <h2>
              {value('Server', 'redis_version')
                ? `Redis ${value('Server', 'redis_version')}`
                : tu('Redis 指标')}
            </h2>
            <p>
              {value('Server', 'redis_mode') ?? tu('模式未知')} ·{' '}
              {value('Replication', 'role') ?? tu('角色未知')}
              <span>
                {data
                  ? tu('更新于 {v0}', {
                      v0: String(
                        new Date(data.fetchedAt).toLocaleTimeString(locale, { hour12: false }),
                      ),
                    })
                  : tu('等待服务器指标')}
              </span>
            </p>
          </div>
          <span className={styles.sampleState} role="status">
            {loading
              ? tu('正在读取指标…')
              : error
                ? tu('刷新失败')
                : tu('{v0} 项指标', {
                    v0: String(
                      sections.reduce((total, section) => total + section.entries.length, 0),
                    ),
                  })}
          </span>
        </div>
        <div className={styles.metrics}>
          {metrics.map(([label, formatted, origin]) => (
            <article key={label}>
              <span>{uiText(uiMessage(label), locale)}</span>
              <strong title={uiText(formatted, locale)}>{uiText(formatted, locale)}</strong>
              <small>
                {origin === 'INFO Keyspace · 所有数据库'
                  ? tu('INFO Keyspace · 所有数据库')
                  : origin}
              </small>
            </article>
          ))}
        </div>
        <div className={styles.search}>
          <MagnifyingGlass size={15} />
          <input
            aria-label={tu('搜索 Redis 指标')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tu('搜索分区、指标名称或值…')}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}>
              {tu('清除')}
            </button>
          )}
        </div>
        <div className={styles.sections}>
          {filtered.map((section, index) => {
            const identity = `${section.name}:${index}`,
              open = expanded.has(section.name) || Boolean(search.trim());
            return (
              <section key={identity} className={styles.infoSection}>
                <button
                  type="button"
                  className={styles.sectionHeader}
                  aria-expanded={open}
                  disabled={Boolean(search.trim())}
                  title={search.trim() ? tu('搜索期间展开匹配分区') : undefined}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(section.name)) next.delete(section.name);
                      else next.add(section.name);
                      return next;
                    })
                  }
                >
                  {open ? <CaretDown size={13} /> : <CaretRight size={13} />}
                  <strong>{uiText(sectionNames[section.name] ?? section.name, locale)}</strong>
                  <code>{section.name}</code>
                  <span>{section.entries.length}</span>
                </button>
                {open && (
                  <table className={styles.infoTable}>
                    <tbody>
                      {section.entries.map((entry, entryIndex) => (
                        <tr key={`${entry.key}:${entryIndex}`}>
                          <th scope="row">
                            <code>{entry.key}</code>
                            <button
                              type="button"
                              aria-label={tu('复制指标名称 {v0}', { v0: String(entry.key) })}
                              onClick={() => void copy(entry.key)}
                            >
                              <Copy size={12} />
                            </button>
                          </th>
                          <td>
                            <code>{entry.value || tu('（空值）')}</code>
                            <button
                              type="button"
                              aria-label={tu('复制指标值 {v0}', { v0: String(entry.key) })}
                              onClick={() => void copy(entry.value)}
                            >
                              <Copy size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
        {!filtered.length && !loading && (
          <div className={styles.empty}>
            {error
              ? tu('服务器指标读取失败，可重试。')
              : search
                ? tu('没有匹配的指标。')
                : tu('服务器未返回指标。')}
          </div>
        )}
      </div>
      <footer className={styles.footer}>
        <span>{tu('INFO ALL · 实例统计包含所有 DB · 离开视图后停止刷新')}</span>
        <span>{data ? `${data.executionTimeMs} ms` : '—'}</span>
      </footer>
    </section>
  );
}
