import { DATABASE_ADMIN_OBJECT_LIMITS, databaseAdminObjectKey, type DatabaseAdminObjectList, type DatabaseAdminObjectSource, type MySqlEventDetails } from '@fouc/shared/database-admin-objects';
import { DatabaseInputError } from '../input-error';
import { adminObjectSearch } from './input';
import { catalogText, errorMessage, optionalSection, quoteAdminObject, sourceText, type AdminObjectAdapter } from './common';

interface EventPage { schema: string; search: string; offset: number; limit: number }
export async function listMySqlEvents(adapter: AdminObjectAdapter, input: EventPage, signal?: AbortSignal): Promise<DatabaseAdminObjectList> {
  const rows = await adapter.query(`SELECT EVENT_SCHEMA AS schema_name, EVENT_NAME AS name, EVENT_COMMENT AS comment,
    STATUS AS status, EVENT_TYPE AS event_type, CAST(EXECUTE_AT AS CHAR) AS execute_at,
    INTERVAL_VALUE AS interval_value, INTERVAL_FIELD AS interval_unit, TIME_ZONE AS time_zone
    FROM information_schema.EVENTS WHERE EVENT_SCHEMA=? AND (EVENT_NAME LIKE ? ESCAPE '=' OR EVENT_COMMENT LIKE ? ESCAPE '=')
    ORDER BY EVENT_NAME LIMIT ${input.limit + 1} OFFSET ${input.offset}`,
  [input.schema, adminObjectSearch(input.search), adminObjectSearch(input.search)], input.limit + 1, signal);
  return {
    provider: 'mysql', database: input.schema, offset: input.offset, limit: input.limit, hasMore: rows.length > input.limit,
    coverage: 'permission-filtered', warnings: ['事件目录受当前角色 EVENT 权限与原生可见范围限制；空目录不能证明数据库没有事件。'],
    items: rows.slice(0, input.limit).map(row => ({
      id: databaseAdminObjectKey('event', String(row.name), input.schema), kind: 'event', name: String(row.name), schema: input.schema,
      comment: catalogText(row.comment), status: catalogText(row.status), timeZone: catalogText(row.time_zone),
      schedule: row.event_type === 'ONE TIME' ? row.execute_at == null ? null : `AT ${row.execute_at}` : row.interval_value == null || row.interval_unit == null ? null : `EVERY ${row.interval_value} ${row.interval_unit}`,
      installedVersion: null, defaultVersion: null, available: null,
    })),
  };
}

/** DBX mysql.rs get_event_info + native SHOW CREATE EVENT source column (not its time_zone column). */
export async function describeMySqlEvent(adapter: AdminObjectAdapter, schema: string, name: string, signal?: AbortSignal): Promise<MySqlEventDetails> {
  const rows = await adapter.query(`SELECT EVENT_SCHEMA AS schema_name, EVENT_NAME AS name, DEFINER AS definer,
    TIME_ZONE AS time_zone, EVENT_TYPE AS event_type, CAST(EXECUTE_AT AS CHAR) AS execute_at,
    INTERVAL_VALUE AS interval_value, INTERVAL_FIELD AS interval_unit, CAST(STARTS AS CHAR) AS starts,
    CAST(ENDS AS CHAR) AS ends, STATUS AS status, ON_COMPLETION AS completion, EVENT_COMMENT AS comment,
    LEFT(EVENT_DEFINITION,${DATABASE_ADMIN_OBJECT_LIMITS.sourceCharacters}) AS body,
    CHAR_LENGTH(EVENT_DEFINITION) > ${DATABASE_ADMIN_OBJECT_LIMITS.sourceCharacters} AS body_truncated,
    CAST(CREATED AS CHAR) AS created_at, CAST(LAST_ALTERED AS CHAR) AS updated_at, CAST(LAST_EXECUTED AS CHAR) AS last_executed,
    SQL_MODE AS sql_mode, CHARACTER_SET_CLIENT AS character_set_client,
    COLLATION_CONNECTION AS collation_connection, DATABASE_COLLATION AS database_collation
    FROM information_schema.EVENTS WHERE EVENT_SCHEMA=? AND EVENT_NAME=? LIMIT 1`, [schema, name], 1, signal);
  if (!rows.length) throw new DatabaseInputError('事件不存在或当前角色没有目录读取权限。');
  const row = rows[0];
  const source = await optionalSection<DatabaseAdminObjectSource>(async () => {
    const native = await adapter.query(`SHOW CREATE EVENT ${quoteAdminObject('mysql', schema)}.${quoteAdminObject('mysql', name)}`, [], 1, signal);
    const record = native[0];
    const key = record && Object.keys(record).find(column => column.toLowerCase() === 'create event');
    return sourceText(key ? record[key] : null);
  }, reason => ({ ...sourceText(null), warning: `SHOW CREATE EVENT 不可用：${errorMessage(reason)}` }), signal);
  const scheduler = await optionalSection<MySqlEventDetails['scheduler']>(async () => {
    const status = (await adapter.query('SELECT @@GLOBAL.event_scheduler AS status, @@SESSION.time_zone AS session_time_zone, @@GLOBAL.system_time_zone AS system_time_zone', [], 1, signal))[0];
    return { status: catalogText(status?.status), sessionTimeZone: catalogText(status?.session_time_zone), systemTimeZone: catalogText(status?.system_time_zone), error: null };
  }, reason => ({ status: null, sessionTimeZone: null, systemTimeZone: null, error: errorMessage(reason) }), signal);
  return {
    kind: 'event', name: String(row.name), schema: String(row.schema_name), definer: catalogText(row.definer),
    status: catalogText(row.status), timeZone: catalogText(row.time_zone), eventType: catalogText(row.event_type),
    executeAt: catalogText(row.execute_at), intervalValue: catalogText(row.interval_value), intervalUnit: catalogText(row.interval_unit),
    starts: catalogText(row.starts), ends: catalogText(row.ends), completion: catalogText(row.completion), comment: catalogText(row.comment),
    createdAt: catalogText(row.created_at), updatedAt: catalogText(row.updated_at), lastExecuted: catalogText(row.last_executed),
    properties: Object.fromEntries(['sql_mode', 'character_set_client', 'collation_connection', 'database_collation'].map(key => [key, catalogText(row[key])])),
    body: sourceText(row.body, 'native', row.body_truncated === true || row.body_truncated === 1), source, scheduler,
    warnings: [
      '调度与最近执行时间保留事件时区的原生墙钟值；创建 / 修改时间使用当前会话时区，不转换成本机时间。',
      '事件 ENABLED 状态不代表正在运行；还取决于服务器 event_scheduler、调度时间与定义者权限。',
      '只读查看不会执行正文、创建事件或切换调度器。正文中动态 SQL、表及例程依赖不能从此目录完整判定。',
    ],
  };
}
