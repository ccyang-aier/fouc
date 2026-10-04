/** Native DBX dashboard queries, limited to the three Fouc runtime providers. */
export const MYSQL_ACTIVITY_STATUS_SQL = 'SHOW GLOBAL STATUS';
export const MYSQL_ACTIVITY_SETTINGS_SQL = "SHOW GLOBAL VARIABLES WHERE Variable_name IN ('max_connections','version','version_comment','read_only','super_read_only','innodb_buffer_pool_size','time_zone')";
export const MYSQL_ACTIVITY_PROCESSES_SQL = 'SHOW FULL PROCESSLIST';

export const POSTGRES_ACTIVITY_STATUS_SQL = `WITH db_stats AS (
  SELECT sum(xact_commit)::text AS xact_commit, sum(xact_rollback)::text AS xact_rollback,
    sum(blks_hit)::text AS blks_hit, sum(blks_read)::text AS blks_read,
    sum(tup_returned)::text AS tup_returned, sum(tup_fetched)::text AS tup_fetched,
    sum(tup_inserted)::text AS tup_inserted, sum(tup_updated)::text AS tup_updated,
    sum(tup_deleted)::text AS tup_deleted, sum(deadlocks)::text AS deadlocks,
    sum(temp_files)::text AS temp_files, sum(temp_bytes)::text AS temp_bytes,
    string_agg(coalesce(stats_reset::text,''),';' ORDER BY datid) AS reset_epoch
  FROM pg_catalog.pg_stat_database
), activity_stats AS (
  SELECT count(*) FILTER (WHERE state IS NOT NULL)::text AS connections,
    count(*) FILTER (WHERE state='active')::text AS active_connections,
    count(*) FILTER (WHERE state='idle')::text AS idle_connections,
    count(*) FILTER (WHERE state IS NULL)::text AS masked_connections
  FROM pg_catalog.pg_stat_activity WHERE pid <> pg_backend_pid()
)
SELECT db_stats.*, activity_stats.*,
  (CASE WHEN pg_is_in_recovery()
    THEN pg_wal_lsn_diff(pg_last_wal_replay_lsn(),'0/0')
    ELSE pg_wal_lsn_diff(pg_current_wal_lsn(),'0/0') END)::text AS wal_bytes,
  floor(extract(epoch FROM clock_timestamp()-pg_postmaster_start_time()))::bigint::text AS uptime_seconds
FROM db_stats CROSS JOIN activity_stats`;

export const POSTGRES_ACTIVITY_SETTINGS_SQL = `SELECT
  current_setting('max_connections') AS max_connections,
  current_setting('server_version') AS version,
  current_setting('track_activity_query_size') AS track_activity_query_size,
  current_setting('TimeZone') AS time_zone,
  pg_is_in_recovery()::text AS in_recovery`;

export const POSTGRES_ACTIVITY_PROCESSES_SQL = `SELECT pid::text AS id,
  usename AS "user", datname AS db,
  coalesce(host(client_addr),client_hostname,'local') AS client,
  application_name AS app, backend_type, state,
  coalesce(nullif(wait_event_type,'') || ':' || wait_event,wait_event_type) AS wait,
  floor(extract(epoch FROM clock_timestamp()-coalesce(query_start,xact_start,backend_start)))::bigint::text AS time,
  query, (pid=pg_backend_pid()) AS own
FROM pg_catalog.pg_stat_activity ORDER BY query_start ASC NULLS LAST, pid`;

export const SQLITE_ACTIVITY_STATUS = ['page_count', 'page_size', 'freelist_count'] as const;
export const SQLITE_ACTIVITY_SETTINGS = ['journal_mode', 'encoding', 'user_version', 'schema_version', 'foreign_keys', 'query_only'] as const;
