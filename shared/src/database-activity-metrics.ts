import type { DatabaseActivityMetric, DatabaseActivitySnapshot } from './database-activity-types';

function integer(value: string | null | undefined): bigint | null {
  if (value === null || value === undefined || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

/** DBX counter differencing, retaining raw integers until after subtraction. */
export function databaseActivityRate(previous: DatabaseActivitySnapshot | undefined, current: DatabaseActivitySnapshot, key: string): number | null {
  if (!previous || previous.scopeKey !== current.scopeKey || previous.provider !== current.provider || previous.database !== current.database) return null;
  const elapsed = current.capturedAt - previous.capturedAt;
  if (elapsed <= 0) return null;
  const oldUptime = integer(previous.counters.Uptime ?? previous.counters.uptime_seconds);
  const uptime = integer(current.counters.Uptime ?? current.counters.uptime_seconds);
  if (oldUptime !== null && uptime !== null && uptime < oldUptime) return null;
  if (previous.counters.reset_epoch !== current.counters.reset_epoch) return null;
  const before = integer(previous.counters[key]), after = integer(current.counters[key]);
  if (before === null || after === null || after < before) return null;
  const value = Number(after - before) * 1000 / elapsed;
  return Number.isFinite(value) ? value : null;
}

function ratio(hit: string | null | undefined, read: string | null | undefined, readsAreSubset = false): number | null {
  const hits = integer(hit), reads = integer(read);
  if (hits === null || reads === null) return null;
  const total = readsAreSubset ? hits : hits + reads;
  if (total === 0n) return null;
  const numerator = readsAreSubset ? hits - reads : hits;
  if (numerator < 0n || numerator > total) return null;
  return Number(numerator * 1_000_000n / total) / 10_000;
}

export function databaseActivityMetrics(current: DatabaseActivitySnapshot, previous?: DatabaseActivitySnapshot): DatabaseActivityMetric[] {
  const values = current.counters;
  const source = current.sources.status ?? '未知';
  const gauge = (id: string, label: string, unit: DatabaseActivityMetric['unit'], key: string): DatabaseActivityMetric => ({ id, label, unit, value: values[key] ?? null, source, counter: null });
  const rate = (id: string, label: string, unit: DatabaseActivityMetric['unit'], key: string): DatabaseActivityMetric => ({ id, label, unit, value: databaseActivityRate(previous, current, key), source, counter: values[key] ?? null });
  if (current.provider === 'mysql') return [
    gauge('connections', '连接数', 'count', 'Threads_connected'),
    gauge('active', '运行线程', 'count', 'Threads_running'),
    rate('throughput', '查询吞吐 QPS', 'count/s', values.Queries !== undefined ? 'Queries' : 'Questions'),
    rate('received', '接收流量', 'B/s', 'Bytes_received'),
    rate('sent', '发送流量', 'B/s', 'Bytes_sent'),
    { id: 'cache', label: 'InnoDB 缓存命中', unit: '%', value: ratio(values.Innodb_buffer_pool_read_requests, values.Innodb_buffer_pool_reads, true), source, counter: null },
    gauge('slow', '累计慢查询', 'count', 'Slow_queries'),
    gauge('uptime', '实例运行时间', 's', 'Uptime'),
  ];
  if (current.provider === 'postgres') {
    const commit = databaseActivityRate(previous, current, 'xact_commit');
    const rollback = databaseActivityRate(previous, current, 'xact_rollback');
    return [
      gauge('connections', '可观察连接', 'count', 'connections'),
      gauge('active', '活动连接', 'count', 'active_connections'),
      { id: 'throughput', label: '事务吞吐 TPS', unit: 'count/s', value: commit === null || rollback === null ? null : commit + rollback, source, counter: null },
      rate('wal', 'WAL 位置推进', 'B/s', 'wal_bytes'),
      rate('inserts', '插入行数', 'count/s', 'tup_inserted'),
      { id: 'cache', label: '块缓存命中', unit: '%', value: ratio(values.blks_hit, values.blks_read), source, counter: null },
      gauge('deadlocks', '累计死锁', 'count', 'deadlocks'),
      gauge('uptime', '实例运行时间', 's', 'uptime_seconds'),
    ];
  }
  const pages = integer(values.page_count), size = integer(values.page_size);
  return [
    gauge('pages', '主文件页数', 'count', 'page_count'),
    gauge('pageSize', '页大小', 'B', 'page_size'),
    { id: 'fileBytes', label: '逻辑主文件大小', unit: 'B', value: pages === null || size === null ? null : (pages * size).toString(), source: 'PRAGMA main.page_count × page_size（不含 WAL / SHM）', counter: null },
    gauge('free', '空闲页数', 'count', 'freelist_count'),
  ];
}

export function formatDatabaseActivityMetric(metric: DatabaseActivityMetric): string {
  const value = metric.value;
  if (value === null) return '—';
  if (metric.unit === 's') {
    const seconds = typeof value === 'string' ? integer(value) : BigInt(Math.floor(value));
    if (seconds === null) return '—';
    return seconds >= 86400n ? `${seconds / 86400n} 天 ${seconds % 86400n / 3600n} 小时` : seconds >= 3600n ? `${seconds / 3600n} 小时 ${seconds % 3600n / 60n} 分` : `${seconds / 60n} 分 ${seconds % 60n} 秒`;
  }
  if (metric.unit === 'count' && typeof value === 'string') return integer(value)?.toLocaleString() ?? value;
  if (metric.unit === 'B' && typeof value === 'string') {
    const bytes = integer(value);
    if (bytes === null) return value;
    if (bytes < 1024n) return `${bytes} B`;
    const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    let divisor = 1024n, index = 0;
    while (bytes >= divisor * 1024n && index < units.length - 1) { divisor *= 1024n; index++; }
    return `${bytes / divisor}.${bytes % divisor * 10n / divisor} ${units[index]}`;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const text = number.toLocaleString(undefined, { maximumFractionDigits: metric.unit === '%' ? 2 : 3 });
  return metric.unit === '%' ? text + '%' : metric.unit === 'B/s' ? text + ' B/s' : metric.unit === 'count/s' ? text + '/s' : metric.unit === 'B' ? text + ' B' : text;
}
