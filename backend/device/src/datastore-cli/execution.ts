import { open } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { sqlExecutionActive, type SqlExecutionSnapshot, type SqlExecutionPoll } from '@fouc/shared';
import { DatastoreHttpClient, resourceSegment } from './http';
import { relationalSession, type CliSession } from './connections';
import { DatastoreCliError, type CliOptions } from './types';

export async function cliSqlSource(options: CliOptions): Promise<string> {
  let sql = options.query;
  if (options.file) {
    const file = await open(options.file, 'r');
    try {
      if (!(await file.stat()).isFile()) throw new DatastoreCliError('SQL input must be a regular file', 2, 'invalid_file');
      const data = Buffer.alloc(1_000_001);
      let bytes = 0;
      while (bytes < data.length) {
        const next = await file.read(data, bytes, data.length - bytes, bytes);
        if (!next.bytesRead) break;
        bytes += next.bytesRead;
      }
      if (bytes > 1_000_000) throw new DatastoreCliError('SQL file exceeds 1 MB', 2, 'file_too_large');
      try { sql = new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(0, bytes)).replace(/^\uFEFF/, ''); }
      catch { throw new DatastoreCliError('SQL file must be valid UTF-8; convert its encoding before running', 2, 'invalid_encoding'); }
    } finally { await file.close(); }
  }
  if (!sql?.trim()) throw new DatastoreCliError('query requires --query or --file', 2, 'missing_sql');
  return sql;
}

/** Use the same registered execution/cancel protocol as the rendered SQL editor. */
export async function runCliSql(client: DatastoreHttpClient, session: CliSession, options: CliOptions, sql: string, signal?: AbortSignal): Promise<SqlExecutionSnapshot> {
  relationalSession(session);
  const started = Date.now();
  let execution: SqlExecutionSnapshot | null = null;
  try {
    execution = await client.request<SqlExecutionSnapshot>(session.base + '/executions', { sql, schema: options.schema, maxRows: options.limit });
    while (sqlExecutionActive(execution)) {
      signal?.throwIfAborted();
      if (Date.now() - started > options.timeout) throw new DatastoreCliError('SQL execution timed out; native cancellation requested', 4, 'timeout');
      await delay(100, undefined, { signal });
      const poll: SqlExecutionPoll = await client.request<SqlExecutionPoll>(session.base + '/executions/' + resourceSegment(execution.id) + '?revision=' + execution.revision);
      if (poll.execution) execution = poll.execution;
    }
    if (execution.status !== 'completed') {
      const failed = execution.statements.find(statement => statement.error);
      throw new DatastoreCliError(failed?.error?.message ?? `SQL execution ${execution.status}`, execution.status === 'cancelled' ? 130 : 1, failed?.error?.code ?? 'query_failed');
    }
    return execution;
  } catch (reason) {
    if (execution && sqlExecutionActive(execution)) {
      const cleanup = client.cleanupClient();
      try { await cleanup.request(session.base + '/executions/' + resourceSegment(execution.id) + '/cancel', {}); }
      catch {
        if (reason instanceof Error) reason.message += '; cancellation was not acknowledged; inspect execution ' + execution.id;
      }
    }
    if (signal?.aborted && !(reason instanceof DatastoreCliError)) throw new DatastoreCliError('SQL interrupted; native cancellation requested', 130, 'interrupted');
    throw reason;
  }
}
