import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { entityIdSchema } from '@fouc/shared/knowledge/contracts';
import { createCommentThreadInputSchema } from '@fouc/shared/knowledge/comments';
import { comment, commentThread } from '../../../platform/database/knowledge/schema';
import type { KnowledgeTenantTransaction } from '../../../platform/database/knowledge/tenant';
import { requireCommentAccess } from './access';
import { KnowledgeCommentError } from './errors';
import { emitCommentThreadChanged, notifyCommentRecipients } from './notifications';
import type { CommentNotice } from './notifications';
import type { CommentRow, CommentThreadRow } from './queries';

/**
 * Client-id thread creation (N02): the frontend applies the CRDT `comment`
 * mark with a freshly generated threadId while the user is still composing,
 * so the anchor and the persisted thread must share that id — the mark cannot
 * be rebound after the fact without a second CRDT round trip. Retrying a lost
 * network response must not fork the thread either, so an existing
 * (workspace, threadId, pageId, commentId) match is an idempotent success.
 */
const createWithIdInputSchema = createCommentThreadInputSchema.and(
  z.strictObject({ userId: entityIdSchema }),
);

export interface CreateCommentThreadWithIdResult {
  thread: CommentThreadRow;
  comment: CommentRow;
  notified: string[];
  /** True when the exact thread and comment were already persisted (retry). */
  existing: boolean;
}

export async function createCommentThreadWithId(
  db: KnowledgeTenantTransaction,
  input: unknown,
): Promise<CreateCommentThreadWithIdResult> {
  const parsed = createWithIdInputSchema.safeParse(input);
  if (!parsed.success) throw new KnowledgeCommentError('INVALID_COMMENT_INPUT');
  const { workspaceId, pageId, threadId, commentId, bodyMd, mentions, userId } = parsed.data;
  const scope = { workspaceId, pageId };

  const [existingThread] = await db.select().from(commentThread)
    .where(and(eq(commentThread.workspaceId, workspaceId), eq(commentThread.id, threadId)));
  if (existingThread) {
    // A retry of the same client operation: same page and same first comment
    // is success; anything else is id misuse, not a race to paper over.
    if (existingThread.pageId !== pageId) throw new KnowledgeCommentError('INVALID_COMMENT_INPUT');
    const [existingComment] = await db.select().from(comment)
      .where(and(eq(comment.workspaceId, workspaceId), eq(comment.id, commentId)));
    if (!existingComment || existingComment.threadId !== threadId) throw new KnowledgeCommentError('INVALID_COMMENT_INPUT');
    return { thread: existingThread, comment: existingComment, notified: [], existing: true };
  }

  await requireCommentAccess(db, { userId, scope, required: 'comment' });
  const [thread] = await db.insert(commentThread).values({ workspaceId, id: threadId, pageId }).returning();
  const [entry] = await db.insert(comment).values({
    workspaceId, id: commentId, threadId, authorId: userId, bodyMd,
  }).returning();
  const notices: CommentNotice[] = mentions.map((mentioned) => ({ kind: 'comment.mention', userId: mentioned }));
  const notified = await notifyCommentRecipients(db, { scope, threadId, commentId, actorId: userId, notices });
  await emitCommentThreadChanged(db, scope, threadId);
  return { thread, comment: entry, notified, existing: false };
}
