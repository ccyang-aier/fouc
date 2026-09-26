import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { entityIdSchema, pageScopeSchema } from '@fouc/shared/knowledge/contracts';
import { comment, commentThread } from '../../database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../database/knowledge/tenant';
import { requireCommentAccess } from './access';
import { KnowledgeCommentError } from './errors';

export type CommentThreadRow = typeof commentThread.$inferSelect;
export type CommentRow = typeof comment.$inferSelect;
export type CommentThreadWithComments = CommentThreadRow & { comments: CommentRow[] };

const listInputSchema = pageScopeSchema.extend({ userId: entityIdSchema });

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new KnowledgeCommentError('INVALID_COMMENT_INPUT');
  return parsed.data;
}

/**
 * Read-side listing for a page's comment sidebar. Threads anchor to the page;
 * block anchoring travels with the CRDT comment mark (N02). Comments return in
 * chronological order; the id tiebreaker keeps the order total even though
 * equal microsecond timestamps cannot occur through this one-comment-per-
 * transaction service.
 */
export async function listPageCommentThreads(db: KnowledgeTenantTransaction, input: unknown): Promise<CommentThreadWithComments[]> {
  const parsed = parse(listInputSchema, input);
  const scope = { workspaceId: parsed.workspaceId, pageId: parsed.pageId };
  await requireCommentAccess(db, { userId: parsed.userId, scope, required: 'view' });
  const threads = await db.select().from(commentThread)
    .where(and(eq(commentThread.workspaceId, scope.workspaceId), eq(commentThread.pageId, scope.pageId)))
    .orderBy(asc(commentThread.createdAt), asc(commentThread.id));
  if (!threads.length) return [];
  const entries = await db.select().from(comment)
    .where(and(eq(comment.workspaceId, scope.workspaceId), inArray(comment.threadId, threads.map((thread) => thread.id))))
    .orderBy(asc(comment.createdAt), asc(comment.id));
  return threads.map((thread) => ({ ...thread, comments: entries.filter((entry) => entry.threadId === thread.id) }));
}
