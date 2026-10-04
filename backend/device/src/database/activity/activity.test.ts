import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import type { RelationalSession } from '@fouc/shared';
import { databaseActivityMetrics, databaseActivityRate, formatDatabaseActivityMetric, type DatabaseActivitySnapshot } from '@fouc/shared/database-activity';
import { databaseActivityRoutes } from '../../api/database-activity-routes';
import type { DriverResult, RelationalDriver } from '../drivers/relational-driver';
import { DatabaseInputError } from '../input-error';
import { readDatabaseActivity, type NativeDatabaseActivityAdapter } from './read';
import { DatabaseActivityService } from './service';

function result(columns: string[], rows: DriverResult['rows'], hasMore = false): DriverResult {
  return { columns, rows, columnTypes: [], hasMore };
}

function sample(patch: Partial<DatabaseActivitySnapshot> = {}): DatabaseActivitySnapshot {
  return {
    provider: 'mysql', database: 'lab', scopeKey: 'workspace/session', capturedAt: 1000, durationMs: 1,
    counters: {}, settings: {}, processes: [], processesSupported: true, processesTruncated: false,
    sources: { status: 'native', settings: 'native', processes: 'native' }, metricScope: 'instance', warnings: [], issues: [], ...patch,
  };
}

test('DBX rate differencing keeps large raw counters exact and reports reset/missing/cross-scope as unknown', () => {
  const previous = sample({ counters: { Queries: '90071992547409930', Uptime: '100' } });
  const current = sample({ capturedAt: 2000, counters: { Queries: '90071992547409932', Uptime: '101' } });
  expect(databaseActivityRate(previous, current, 'Queries')).toBe(2);
  expect(databaseActivityRate(undefined, current, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, scopeKey: 'another/session' }, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, database: 'another' }, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, capturedAt: 1000 }, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, counters: { Queries: '90071992547409932', Uptime: '1' } }, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, counters: { Queries: '1', Uptime: '101' } }, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, counters: {} }, 'Queries')).toBeNull();
  expect(databaseActivityRate(previous, { ...current, counters: { ...current.counters, reset_epoch: 'new' } }, 'Queries')).toBeNull();
  const cache = databaseActivityMetrics(sample({ counters: { Innodb_buffer_pool_read_requests: '100000000000000000000', Innodb_buffer_pool_reads: '1000000000000000000' } })).find(metric => metric.id === 'cache');
  expect(cache?.value).toBe(99);
  expect(formatDatabaseActivityMetric({ id: 'raw', label: '', value: '9007199254740993', unit: 'count', source: '', counter: null }).replaceAll(',', '')).toBe('9007199254740993');
});

test('MySQL process IDs stay textual, malformed metadata remains unknown, and settings privilege failure is isolated', async () => {
  const calls: string[] = [];
  const adapter: NativeDatabaseActivityAdapter = {
    provider: 'mysql', database: 'lab', scopeKey: 'w/mysql',
    read: async sql => {
      calls.push(sql);
      if (sql === 'SHOW GLOBAL STATUS') return result(['Variable_name', 'Value'], [['Queries', '90071992547409932'], ['Threads_connected', '2']]);
      if (sql.startsWith('SHOW GLOBAL VARIABLES')) throw Object.assign(new Error('access denied for settings'), { code: 'ER_SPECIFIC_ACCESS_DENIED_ERROR' });
      return result(['ID', 'USER', 'HOST', 'DB', 'COMMAND', 'TIME', 'STATE', 'INFO'], [['9007199254740993', 'role', 'local', 'lab', 'Query', '12', null, 'SELECT ' + 'x'.repeat(70_000)]], true);
    },
  };
  const snapshot = await readDatabaseActivity(adapter);
  expect(calls.length).toBe(3);
  expect(snapshot.counters.Queries).toBe('90071992547409932');
  expect(snapshot.settings).toEqual({});
  expect(snapshot.issues).toEqual([{ section: 'settings', code: 'ER_SPECIFIC_ACCESS_DENIED_ERROR', message: 'access denied for settings' }]);
  expect(snapshot.processes[0].id).toBe('9007199254740993');
  expect(snapshot.processes[0].state).toBeNull();
  expect(snapshot.processes[0].own).toBeNull();
  expect(snapshot.processes[0].query?.length).toBe(65_536);
  expect(snapshot.processes[0].queryTruncated).toBe(true);
  expect(snapshot.processesTruncated).toBe(true);
  expect(databaseActivityMetrics(snapshot).find(metric => metric.id === 'slow')?.value).toBeNull();
});

test('PostgreSQL query-local own session and native privilege masking remain factual', async () => {
  const snapshot = await readDatabaseActivity({
    provider: 'postgres', database: 'lab', scopeKey: 'w/pg',
    read: async sql => sql.includes('WITH db_stats') ? result(['XACT_COMMIT', 'xact_rollback', 'wal_bytes', 'reset_epoch'], [['10000000000000000001', '2', null, 'epoch']]) : sql.includes('current_setting') ? result(['version', 'max_connections'], [['17.0', '100']]) : result(['id', 'user', 'db', 'client', 'app', 'state', 'wait', 'time', 'query', 'own', 'backend_type'], [['100', 'role', 'lab', 'local', 'fouc', 'active', null, '1', 'SELECT pg_stat_activity', true, 'client backend'], ['101', 'other', 'lab', null, null, null, null, null, '<insufficient privilege>', false, 'client backend'], ['102', null, null, 'local', null, null, 'Activity:CheckpointerMain', '12', null, false, 'checkpointer']]),
  });
  expect(snapshot.counters.xact_commit).toBe('10000000000000000001');
  expect(snapshot.counters.wal_bytes).toBeNull();
  expect(snapshot.processes[0].own).toBe(true);
  expect(snapshot.processes[0].masked).toBe(false);
  expect(snapshot.processes[1].masked).toBe(true);
  expect(snapshot.processes[1].ageSeconds).toBeNull();
  expect(snapshot.processes[1].query).toBe('<insufficient privilege>');
  expect(snapshot.processes[2].masked).toBe(false);
  expect(snapshot.processes[2].backendType).toBe('checkpointer');
  expect(snapshot.warnings.some(warning => warning.includes('原生权限遮蔽'))).toBe(true);
  expect(databaseActivityMetrics(snapshot).find(metric => metric.id === 'wal')?.value).toBeNull();
});

test('SQLite uses only native getter PRAGMA and does not invent a server process list', async () => {
  const calls: string[] = [];
  const snapshot = await readDatabaseActivity({
    provider: 'sqlite', database: 'fixture.sqlite', scopeKey: 'w/sqlite',
    read: async sql => { calls.push(sql); return result(['value'], [[sql.includes('page_count') ? '9007199254740993' : sql.includes('page_size') ? '4096' : '0']]); },
  });
  expect(calls.length).toBe(9);
  expect(calls.every(sql => /^PRAGMA main\.[a-z_]+$/.test(sql))).toBe(true);
  expect(snapshot.processesSupported).toBe(false);
  expect(snapshot.processes).toEqual([]);
  expect(snapshot.sources.processes).toBeNull();
  expect(databaseActivityMetrics(snapshot).find(metric => metric.id === 'fileBytes')?.value).toBe((9007199254740993n * 4096n).toString());
});

test('scope ownership, active writes, single-flight cancellation and route input cannot bypass native read-only sampling', async () => {
  let reads = 0;
  let current = true;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const entry = {
    session: { provider: 'mysql', database: 'lab' } as RelationalSession,
    saving: false,
    driver: { read: async (_sql: string, _schema: string | null, _limit: number, _values: unknown, signal?: AbortSignal) => {
      reads++;
      if (reads === 1) await gate;
      signal?.throwIfAborted();
      return result([], []);
    } } as unknown as RelationalDriver,
  };
  const service = new DatabaseActivityService((workspace, id) => {
    if (workspace !== 'allowed' || id !== 'session' || !current) throw new DatabaseInputError('scope unavailable');
    return entry;
  });
  await expect(service.snapshot('other', 'session')).rejects.toThrow('scope unavailable');
  entry.saving = true;
  await expect(service.snapshot('allowed', 'session')).rejects.toThrow('写入');
  expect(reads).toBe(0);
  entry.saving = false;
  const controller = new AbortController();
  const inFlight = service.snapshot('allowed', 'session', controller.signal);
  await expect(service.snapshot('allowed', 'session')).rejects.toThrow('尚未结束');
  controller.abort(); release!();
  await expect(inFlight).rejects.toThrow();
  const next = await service.snapshot('allowed', 'session');
  expect(next.scopeKey).toBe('["allowed","session"]');
  expect(reads).toBe(4);
  const app = new Hono();
  app.onError((error, c) => c.json({ error: error.message }, error instanceof DatabaseInputError ? 400 : 500));
  app.route('/', databaseActivityRoutes(service));
  const rejected = await app.request('/api/database/workspaces/allowed/relational/sessions/session/activity/snapshot?sql=DELETE');
  expect(rejected.status).toBe(400);
  expect(reads).toBe(4);
  current = false;
  await expect(service.snapshot('allowed', 'session')).rejects.toThrow('scope unavailable');
});
