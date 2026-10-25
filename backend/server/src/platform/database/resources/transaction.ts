import { entityIdSchema } from '@fouc/shared/resources';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { resourceSchema } from './schema';

/** The request owns its transaction; services cannot start a second top-level one. */
export type ResourceTransaction = Omit<NodePgDatabase<typeof resourceSchema>, 'transaction'>;
export type FoucIdentityTransaction = Pick<ResourceTransaction, 'select' | 'execute'>;
export class ResourceTransactionAbortedError extends Error {
  constructor() {
    super('Resource transaction was rolled back instead of committed');
    this.name = 'ResourceTransactionAbortedError';
  }
}

/** Project mutations bind their real resource ID and the verified active identity. */
export async function withProject<T>(
  pool: Pool,
  projectId: string,
  sessionId: string,
  operation: (db: ResourceTransaction) => Promise<T>,
): Promise<T> {
  if (!entityIdSchema.safeParse(projectId).success) throw new TypeError('Invalid project ID');
  if (!entityIdSchema.safeParse(sessionId).success) throw new TypeError('Invalid session ID');
  return withResourceScope(pool, { projectId, sessionId, readOnly: false }, operation);
}

/** sessionId must be obtained from a verified server-side auth session, never a request body. */
export async function withFoucIdentity<T>(
  pool: Pool,
  sessionId: string,
  operation: (db: FoucIdentityTransaction) => Promise<T>,
): Promise<T> {
  if (!entityIdSchema.safeParse(sessionId).success) throw new TypeError('Invalid session ID');
  return withResourceScope(pool, { projectId: '', sessionId, readOnly: true }, operation);
}

async function withResourceScope<T>(
  pool: Pool,
  scope: { projectId: string; sessionId: string; readOnly: boolean },
  operation: (db: ResourceTransaction) => Promise<T>,
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
    await client.query("SELECT set_config('app.project_id', $1, true), set_config('app.auth_session_id', $2, true)", [scope.projectId, scope.sessionId]);
    const db: ResourceTransaction = drizzle(client, { schema: resourceSchema });
    const result = await operation(db);
    if (connectionError) throw connectionError;

    const completion = await client.query('COMMIT');
    began = false;
    // PostgreSQL returns ROLLBACK for COMMIT in an aborted transaction. A caller
    // catching a SQL error must not make an uncommitted write appear successful.
    reusable = !connectionError && ['COMMIT', 'ROLLBACK'].includes(completion.command);
    if (completion.command !== 'COMMIT') throw new ResourceTransactionAbortedError();
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
