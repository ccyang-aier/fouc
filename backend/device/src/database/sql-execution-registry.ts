import type { DatabaseQueryResult, SqlExecutionError, SqlExecutionSnapshot, SqlStatementRange } from '@fouc/shared';
import { sqlExecutionActive } from '@fouc/shared';
import { DatabaseInputError } from './input-error';

type Registration = {

  sessionId: string;
  controller: AbortController;
  snapshot: SqlExecutionSnapshot;
  done: Promise<void>;
};
export function sqlExecutionError(value: unknown): SqlExecutionError {
  const error = value as Record<string, unknown> | null;
  const text = (key: string) => typeof error?.[key] === 'string' ? (error[key] as string).slice(0, 16384) : null;
  const position = Number(error?.position);
  return { message: value instanceof Error ? value.message.slice(0, 16384) : String(value),
    code: text('code'), position: Number.isInteger(position) && position > 0 ? position - 1 : null,
    detail: text('detail'), hint: text('hint') };
}

/** Native DBX execution registration: ownership, interruption and terminal confirmation. */
export class SqlExecutionRegistry {
  private entries = new Map<string, Registration>();
  start(sessionId: string, database: string, schema: string | null, ranges: SqlStatementRange[],
    run: (statement: string, signal: AbortSignal, index: number) => Promise<DatabaseQueryResult>,
    mapError: (error: unknown, index: number) => SqlExecutionError = sqlExecutionError): SqlExecutionSnapshot {
    const active = [...this.entries.values()].filter((entry) => sqlExecutionActive(entry.snapshot));
    if (active.length >= 8 || active.filter((entry) => entry.sessionId === sessionId).length >= 2)
      throw new DatabaseInputError('并行查询已达上限，请等待或取消正在执行的查询');
    this.trim(sessionId);
    const snapshot: SqlExecutionSnapshot = { id: crypto.randomUUID(), status: 'running', database, schema,
      statements: ranges.map((range) => ({ ...range, status: 'pending', result: null, error: null, startedAt: null, finishedAt: null })),
      currentIndex: null, completedCount: 0, startedAt: Date.now(), finishedAt: null, revision: 1 };
    const entry: Registration = { sessionId, controller: new AbortController(), snapshot, done: Promise.resolve() };
    this.entries.set(snapshot.id, entry);
    entry.done = this.execute(entry, run, mapError);
    return this.copy(snapshot);
  }
  private async execute(entry: Registration, run: (statement: string, signal: AbortSignal, index: number) => Promise<DatabaseQueryResult>, mapError: (error: unknown, index: number) => SqlExecutionError): Promise<void> {
    const { snapshot, controller } = entry;
    for (let index = 0; index < snapshot.statements.length; index++) {
      if (controller.signal.aborted) break;
      const statement = snapshot.statements[index];
      snapshot.currentIndex = index; statement.status = 'running'; statement.startedAt = Date.now(); snapshot.revision++;
      try {
        statement.result = await run(statement.sql, controller.signal, index);
        // A completed driver result wins over a late cancellation request.
        statement.status = 'succeeded'; snapshot.completedCount++;
      } catch (reason) {
        statement.status = controller.signal.aborted ? 'cancelled' : 'failed';
        if (!controller.signal.aborted) statement.error = mapError(reason, index);
      }
      statement.finishedAt = Date.now(); snapshot.revision++;
      if (statement.status !== 'succeeded') break;
    }
    snapshot.status = snapshot.statements.some((item) => item.status === 'failed') ? 'failed'
      : snapshot.completedCount === snapshot.statements.length ? 'completed' : 'cancelled';
    for (const item of snapshot.statements) if (item.status === 'pending') item.status = 'skipped';
    snapshot.currentIndex = null; snapshot.finishedAt = Date.now(); snapshot.revision++;
    this.trim(entry.sessionId);
  }
  private owned(sessionId: string, id: string): Registration {
    const entry = this.entries.get(id);
    if (!entry || entry.sessionId !== sessionId)
      throw new DatabaseInputError('查询执行记录不存在或已释放');
    return entry;
  }
  poll(sessionId: string, id: string, revision: number) {
    const { snapshot } = this.owned(sessionId, id);
    return { revision: snapshot.revision, execution: revision === snapshot.revision ? null : this.copy(snapshot) };
  }
  cancel(sessionId: string, id: string): SqlExecutionSnapshot {
    const entry = this.owned(sessionId, id);
    if (entry.snapshot.status === 'running') {
      entry.snapshot.status = 'cancelling'; entry.snapshot.revision++; entry.controller.abort();
    }
    return this.copy(entry.snapshot);
  }
  async closeSession(sessionId: string): Promise<void> {
    const entries = [...this.entries.values()].filter((entry) => entry.sessionId === sessionId);
    for (const entry of entries) entry.controller.abort();
    await Promise.all(entries.map((entry) => entry.done));
    for (const entry of entries) this.entries.delete(entry.snapshot.id);
  }
  private copy(snapshot: SqlExecutionSnapshot): SqlExecutionSnapshot {
    return { ...snapshot, statements: snapshot.statements.map((item) => ({ ...item })) };
  }
  private trim(sessionId: string): void {
    const finished = [...this.entries.values()].filter((entry) => entry.sessionId === sessionId && !sqlExecutionActive(entry.snapshot));
    for (const entry of finished.slice(0, -4)) this.entries.delete(entry.snapshot.id);
  }
}
