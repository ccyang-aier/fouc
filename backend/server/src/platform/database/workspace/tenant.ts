import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { workspaceTenantSchema } from './schema';

/** The request owns its transaction; services cannot start a second top-level one. */
export type WorkspaceTenantTransaction = Omit<NodePgDatabase<typeof workspaceTenantSchema>, 'transaction'>;
export type FoucIdentityTransaction = Pick<WorkspaceTenantTransaction, 'select' | 'execute'>;

export class WorkspaceTransactionAbortedError extends Error {
  constructor() {
    super('Knowledge transaction was rolled back instead of committed');
    this.name = 'WorkspaceTransactionAbortedError';
  }
}

/**
 * workspaceId must come from an authenticated, authorized server context.
 * This is the tenant storage boundary, not a replacement for membership/ACL checks.
 * Never execute request work through pool.query inside this callback.
 */
export async function withWorkspaceTenant<T>(
  pool: Pool,
  workspaceId: string,
  operation: (db: WorkspaceTenantTransaction) => Promise<T>,
): Promise<T> {
  if (!entityIdSchema.safeParse(workspaceId).success) throw new TypeError('Invalid workspace ID');
  return withKnowledgeScope(pool, { workspaceId, sessionId: '', readOnly: false }, operation);
}

/** sessionId must be obtained from a verified server-side auth session, never a request body. */
export async function withFoucIdentity<T>(
  pool: Pool,
  sessionId: string,
  operation: (db: FoucIdentityTransaction) => Promise<T>,
): Promise<T> {
  if (!entityIdSchema.safeParse(sessionId).success) throw new TypeError('Invalid session ID');
  return withKnowledgeScope(pool, { workspaceId: '', sessionId, readOnly: true }, operation);
}

async function withKnowledgeScope<T>(
  pool: Pool,
  scope: { workspaceId: string; sessionId: string; readOnly: boolean },
  operation: (db: WorkspaceTenantTransaction) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let began = false;
  let reusable = false;
  let connectionError: Error | undefined;
  const onError = (error: Error) => { connectionError = error; };
  client.on('error', onError);

  try {
    await client.query(scope.readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
    began = true;
    // Explicitly clear the other scope even on a reused connection.
    await client.query("SELECT set_config('app.workspace_id', $1, true), set_config('app.auth_session_id', $2, true)", [scope.workspaceId, scope.sessionId]);
    const db: WorkspaceTenantTransaction = drizzle(client, { schema: workspaceTenantSchema });
    const result = await operation(db);
    if (connectionError) throw connectionError;

    const completion = await client.query('COMMIT');
    began = false;
    // PostgreSQL returns ROLLBACK for COMMIT in an aborted transaction. A caller
    // catching a SQL error must not make an uncommitted write appear successful.
    reusable = !connectionError && ['COMMIT', 'ROLLBACK'].includes(completion.command);
    if (completion.command !== 'COMMIT') throw new WorkspaceTransactionAbortedError();
    return result;
  } catch (error) {
    if (began) {
      try {
        const rollback = await client.query('ROLLBACK');
        reusable = !connectionError && rollback.command === 'ROLLBACK';
      } catch {
        reusable = false;
      }
    }
    throw error;
  } finally {
    client.removeListener('error', onError);
    // Failed BEGIN, failed rollback and broken sockets never return to the pool.
    client.release(!reusable);
  }
}
