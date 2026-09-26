import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { knowledgeSchema } from './schema';

/** The request owns its transaction; services cannot start a second top-level one. */
export type KnowledgeTenantTransaction = Omit<NodePgDatabase<typeof knowledgeSchema>, 'transaction'>;

export class KnowledgeTransactionAbortedError extends Error {
  constructor() {
    super('Knowledge transaction was rolled back instead of committed');
    this.name = 'KnowledgeTransactionAbortedError';
  }
}

/**
 * workspaceId must come from an authenticated, authorized server context.
 * This is the tenant storage boundary, not a replacement for membership/ACL checks.
 * Never execute request work through pool.query inside this callback.
 */
export async function withKnowledgeTenant<T>(
  pool: Pool,
  workspaceId: string,
  operation: (db: KnowledgeTenantTransaction) => Promise<T>,
): Promise<T> {
  if (!entityIdSchema.safeParse(workspaceId).success) throw new TypeError('Invalid workspace ID');

  const client = await pool.connect();
  let began = false;
  let reusable = false;
  let connectionError: Error | undefined;
  const onError = (error: Error) => { connectionError = error; };
  client.on('error', onError);

  try {
    await client.query('BEGIN');
    began = true;
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [workspaceId]);
    const db: KnowledgeTenantTransaction = drizzle(client, { schema: knowledgeSchema });
    const result = await operation(db);
    if (connectionError) throw connectionError;

    const completion = await client.query('COMMIT');
    began = false;
    // PostgreSQL returns ROLLBACK for COMMIT in an aborted transaction. A caller
    // catching a SQL error must not make an uncommitted write appear successful.
    reusable = !connectionError && ['COMMIT', 'ROLLBACK'].includes(completion.command);
    if (completion.command !== 'COMMIT') throw new KnowledgeTransactionAbortedError();
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
