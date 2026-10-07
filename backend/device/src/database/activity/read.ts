import type { RelationalProvider } from '@fouc/shared';
import { DATABASE_ACTIVITY_LIMITS, type DatabaseActivityIssue, type DatabaseActivityProcess, type DatabaseActivitySection, type DatabaseActivitySnapshot } from '@fouc/shared/database-activity';
import type { DriverResult } from '../drivers/relational-driver';
import { MYSQL_ACTIVITY_PROCESSES_SQL, MYSQL_ACTIVITY_SETTINGS_SQL, MYSQL_ACTIVITY_STATUS_SQL, POSTGRES_ACTIVITY_PROCESSES_SQL, POSTGRES_ACTIVITY_SETTINGS_SQL, POSTGRES_ACTIVITY_STATUS_SQL, SQLITE_ACTIVITY_SETTINGS, SQLITE_ACTIVITY_STATUS } from './sql';

export interface NativeDatabaseActivityAdapter {
  provider: RelationalProvider;
  database: string;
  scopeKey: string;
  read: (sql: string, maxRows: number, signal?: AbortSignal) => Promise<DriverResult>;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean' ? String(value) : null;
}

function namedRows(result: DriverResult): Array<Record<string, unknown>> {
  const columns = result.columns.map(name => name.toLowerCase());
  return result.rows.map(row => Object.fromEntries(columns.map((name, index) => [name, row[index]])));
}

function mysqlMap(result: DriverResult): Record<string, string | null> {
  return Object.fromEntries(namedRows(result).flatMap(row => {
    const key = text(row.variable_name);
    return key ? [[key, text(row.value)]] : [];
  }));
}

function postgresMap(result: DriverResult): Record<string, string | null> {
  const row = namedRows(result)[0];
  return row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])) : {};
}

function processes(provider: RelationalProvider, result: DriverResult): DatabaseActivityProcess[] {
  return namedRows(result).slice(0, DATABASE_ACTIVITY_LIMITS.processes).map(row => {
    const query = text(provider === 'mysql' ? row.info : row.query);
    const masked = provider === 'postgres' && ((row.state === null && row.backend_type === 'client backend') || query === '<insufficient privilege>');
    return {
      id: text(row.id), user: text(row.user), database: text(row.db),
      client: text(provider === 'mysql' ? row.host : row.client), application: text(row.app), backendType: text(row.backend_type),
      command: text(row.command), state: text(row.state), wait: text(row.wait),
      ageSeconds: text(row.time),
      query: query?.slice(0, DATABASE_ACTIVITY_LIMITS.sqlCharacters) ?? null,
      queryTruncated: (query?.length ?? 0) > DATABASE_ACTIVITY_LIMITS.sqlCharacters,
      own: provider === 'mysql' ? null : row.own === true || row.own === 'true' || row.own === 't' ? true : row.own === false || row.own === 'false' || row.own === 'f' ? false : null,
      masked,
    };
  });
}

function issue(section: DatabaseActivitySection, error: unknown): DatabaseActivityIssue {
  const code = typeof error === 'object' && error !== null && 'code' in error ? text(error.code) : null;
  return { section, code, message: error instanceof Error ? error.message : String(error) };
}

export async function readDatabaseActivity(adapter: NativeDatabaseActivityAdapter, signal?: AbortSignal): Promise<DatabaseActivitySnapshot> {
  signal?.throwIfAborted();
  const started = Date.now();
  const snapshot: DatabaseActivitySnapshot = {
    provider: adapter.provider, database: adapter.database, scopeKey: adapter.scopeKey,
    capturedAt: started, durationMs: 0, counters: {}, settings: {}, processes: [],
    processesSupported: adapter.provider !== 'sqlite', processesTruncated: false,
    sources: { status: null, settings: null, processes: null },
    metricScope: adapter.provider === 'sqlite' ? 'file' : 'instance', warnings: [], issues: [],
  };
  const readSection = async (section: DatabaseActivitySection, run: () => Promise<void>) => {
    signal?.throwIfAborted();
    try { await run(); }
    catch (error) { signal?.throwIfAborted(); snapshot.issues.push(issue(section, error)); }
    signal?.throwIfAborted();
  };
  if (adapter.provider === 'sqlite') {
    snapshot.sources = { status: 'PRAGMA main.page_count / page_size / freelist_count', settings: '只读 PRAGMA（当前连接）', processes: null };
    await readSection('status', async () => {
      for (const key of SQLITE_ACTIVITY_STATUS) {
        const result = await adapter.read(`PRAGMA main.${key}`, 1, signal);
        snapshot.counters[key] = text(result.rows[0]?.[0]);
      }
    });
    await readSection('settings', async () => {
      for (const key of SQLITE_ACTIVITY_SETTINGS) {
        const result = await adapter.read(`PRAGMA main.${key}`, 1, signal);
        snapshot.settings[key] = text(result.rows[0]?.[0]);
      }
    });
    snapshot.warnings.push('SQLite 没有服务器进程目录；此处仅展示当前文件与连接的真实只读 PRAGMA，不推断其他应用的连接或运行查询。', '逻辑主文件大小不含 WAL / SHM，也不是磁盘实际占用。');
  } else {
    const mysql = adapter.provider === 'mysql';
    const statusSql = mysql ? MYSQL_ACTIVITY_STATUS_SQL : POSTGRES_ACTIVITY_STATUS_SQL;
    const settingsSql = mysql ? MYSQL_ACTIVITY_SETTINGS_SQL : POSTGRES_ACTIVITY_SETTINGS_SQL;
    const processSql = mysql ? MYSQL_ACTIVITY_PROCESSES_SQL : POSTGRES_ACTIVITY_PROCESSES_SQL;
    snapshot.sources = { status: mysql ? 'SHOW GLOBAL STATUS（实例累计计数）' : 'pg_stat_database / pg_stat_activity / WAL LSN（实例）', settings: mysql ? 'SHOW GLOBAL VARIABLES（指定设置）' : 'current_setting / pg_is_in_recovery', processes: mysql ? 'SHOW FULL PROCESSLIST（当前账号可见）' : 'pg_stat_activity（当前账号可见）' };
    await readSection('status', async () => {
      const result = await adapter.read(statusSql, DATABASE_ACTIVITY_LIMITS.statusRows, signal);
      snapshot.counters = mysql ? mysqlMap(result) : postgresMap(result);
      if (result.hasMore) snapshot.warnings.push('原始状态目录已达到 2000 行上限；未返回的指标保持未知。');
      if (!result.rows.length) snapshot.warnings.push('原生状态查询未返回数据，指标保持未知。');
    });
    // Timestamp the status sample immediately after that query, rather than after later process reads.
    snapshot.capturedAt = Date.now();
    await readSection('settings', async () => {
      const result = await adapter.read(settingsSql, 100, signal);
      snapshot.settings = mysql ? mysqlMap(result) : postgresMap(result);
    });
    await readSection('processes', async () => {
      const result = await adapter.read(processSql, DATABASE_ACTIVITY_LIMITS.processes, signal);
      snapshot.processes = processes(adapter.provider, result);
      snapshot.processesTruncated = result.hasMore || result.rows.length > DATABASE_ACTIVITY_LIMITS.processes;
    });
    snapshot.warnings.push('实例指标可能包含其他数据库的活动；会话目录只显示当前连接账号的原生可见范围，不代表全实例完整统计。', '速率需要同一会话的两个有效样本；重启、统计重置、缺失数据或计数下降显示未知，不显示虚假的零。', '监控读查询自身也可能增加实例累计计数；刷新间隔越短，采样开销越大。');
    if (mysql) snapshot.warnings.push('没有 PROCESS 权限时，MySQL 仅返回账号自身会话；Time 是当前状态持续秒数。SHOW FULL PROCESSLIST 不保证识别此监控连接。');
    else snapshot.warnings.push('PostgreSQL 可能隐藏其他角色的 state / query；Time 是当前或最后语句、事务 / 会话的年龄，idle 行不代表 SQL 仍在执行。WAL 指标是位置推进，并非网络带宽或磁盘实际写入。', 'SQL 文本还受原生 track_activity_query_size 字节上限约束；复制内容不保证包含完整原始语句。');
    if (snapshot.processes.some(row => row.masked)) snapshot.warnings.push('部分会话信息已被原生权限遮蔽；保留未知状态，不把权限遮蔽解释为零活动。');
  }
  snapshot.durationMs = Date.now() - started;
  signal?.throwIfAborted();
  return snapshot;
}
