import { randomUUID } from 'node:crypto';
import { entityIdSchema, outboxEventSchema } from '@fouc/shared/knowledge/contracts';
import type { OutboxEvent } from '@fouc/shared/knowledge/contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { WorkspaceTenantTransaction } from '../../../platform/database/workspace/tenant';
import { outbox } from '../../../platform/database/workspace/schema';
import { KnowledgeJobError } from './types';
import type { OutboxReference } from './types';

export const DISPATCH_TASK = 'workspace.dispatch';
export const consumerTask = (name: string) => `workspace.consume.${name}`;
export const jobKey = (task: string, reference: OutboxReference) => `${task}:${reference.workspaceId}:${reference.outboxId}`;

/** Must use the same transaction as the domain write and outbox insert. */
export async function enqueueKnowledgeJob(db: WorkspaceTenantTransaction, task: string, reference: OutboxReference): Promise<string> {
  const result = await db.execute<{ id: string | null }>(sql`
    SELECT (knowledge_jobs.add_job(
      identifier => ${task}::text,
      payload => ${JSON.stringify(reference)}::json,
      max_attempts => 25,
      job_key => ${jobKey(task, reference)}::text,
      job_key_mode => 'preserve_run_at'
    )).id::text AS id
  `);
  // A concurrent add_job may return NULL. Never commit an outbox without its job.
  if (!result.rows[0]?.id) throw new KnowledgeJobError('enqueue_failed');
  return result.rows[0].id;
}

export async function appendKnowledgeOutbox(
  db: WorkspaceTenantTransaction,
  input: OutboxEvent,
  id = randomUUID(),
): Promise<{ id: string; created: boolean }> {
  const parsed = outboxEventSchema.safeParse(input);
  if (!parsed.success || !entityIdSchema.safeParse(id).success) throw new KnowledgeJobError('invalid_event');
  const event = parsed.data;
  const inserted = await db.insert(outbox).values({ id, workspaceId: event.workspaceId, topic: event.topic, payload: event })
    .onConflictDoNothing().returning({ id: outbox.id });
  if (inserted.length) {
    await enqueueKnowledgeJob(db, DISPATCH_TASK, { workspaceId: event.workspaceId, outboxId: id });
    return { id, created: true };
  }
  const existing = await db.select({ matches: sql<boolean>`${outbox.payload} = ${JSON.stringify(event)}::jsonb` })
    .from(outbox).where(and(eq(outbox.workspaceId, event.workspaceId), eq(outbox.id, id)));
  if (existing[0]?.matches !== true) throw new KnowledgeJobError('event_conflict');
  // Completed Graphile jobs are deleted; the retained outbox is the durable dedup key.
  return { id, created: false };
}
