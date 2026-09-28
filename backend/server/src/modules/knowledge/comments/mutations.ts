import { randomUUID } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { entityIdSchema, pageScopeSchema, workspaceScopeSchema } from '@fouc/shared/knowledge/contracts';
import { comment, commentThread, member } from '../../../platform/database/workspace/schema';
import type { WorkspaceTenantTransaction } from '../../../platform/database/workspace/tenant';
import { requireCommentAccess } from './access';
import { KnowledgeCommentError } from './errors';
import { emitCommentThreadChanged, notifyCommentRecipients } from './notifications';
import type { CommentNotice } from './notifications';
import type { CommentRow, CommentThreadRow } from './queries';

// Mirrors the comment body CHECK (btrim length 1..50000); the schema trims first.
const bodySchema = z.string().trim().min(1).max(50_000);
// Mentions are structured verified user ids, never text parsed out of the body.
const mentionsSchema = z.array(entityIdSchema).max(100);

const createInputSchema = pageScopeSchema.extend({
  userId: entityIdSchema,
  bodyMd: bodySchema,
  mentions: mentionsSchema.default([]),
}).refine((input) => new Set(input.mentions).size === input.mentions.length);

const replyInputSchema = workspaceScopeSchema.extend({
  threadId: entityIdSchema,
  userId: entityIdSchema,
  bodyMd: bodySchema,
  mentions: mentionsSchema.default([]),
}).refine((input) => new Set(input.mentions).size === input.mentions.length);

const threadTargetSchema = workspaceScopeSchema.extend({ threadId: entityIdSchema, userId: entityIdSchema });
const commentTargetSchema = workspaceScopeSchema.extend({ commentId: entityIdSchema, userId: entityIdSchema });

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new KnowledgeCommentError('INVALID_COMMENT_INPUT');
  return parsed.data;
}

/** Serializes lifecycle operations (reply/resolve/reopen/delete) on one thread. */
async function lockedThread(db: WorkspaceTenantTransaction, workspaceId: string, threadId: string): Promise<CommentThreadRow> {
  const [thread] = await db.select().from(commentThread)
    .where(and(eq(commentThread.workspaceId, workspaceId), eq(commentThread.id, threadId)))
    .for('update');
  if (!thread) throw new KnowledgeCommentError('COMMENT_THREAD_NOT_FOUND');
  return thread;
}

/** userId comes from verified session authority. The whole lifecycle shares one transaction. */
export async function createCommentThread(db: WorkspaceTenantTransaction, input: unknown): Promise<{ thread: CommentThreadRow; comment: CommentRow; notified: string[] }> {
  const parsed = parse(createInputSchema, input);
  const scope = { workspaceId: parsed.workspaceId, pageId: parsed.pageId };
  await requireCommentAccess(db, { userId: parsed.userId, scope, required: 'comment' });
  const threadId = randomUUID();
  const [thread] = await db.insert(commentThread).values({ workspaceId: scope.workspaceId, id: threadId, pageId: scope.pageId }).returning();
  const [entry] = await db.insert(comment).values({
    workspaceId: scope.workspaceId, id: randomUUID(), threadId, authorId: parsed.userId, bodyMd: parsed.bodyMd,
  }).returning();
  const mentions: CommentNotice[] = parsed.mentions.map((userId) => ({ kind: 'comment.mention', userId }));
  const notified = await notifyCommentRecipients(db, { scope, threadId, commentId: entry.id, actorId: parsed.userId, notices: mentions });
  await emitCommentThreadChanged(db, scope, threadId);
  return { thread, comment: entry, notified };
}

/** Replying requires an open thread; reopening is the explicit way out of a resolved one. */
export async function replyCommentThread(db: WorkspaceTenantTransaction, input: unknown): Promise<{ thread: CommentThreadRow; comment: CommentRow; notified: string[] }> {
  const parsed = parse(replyInputSchema, input);
  const thread = await lockedThread(db, parsed.workspaceId, parsed.threadId);
  const scope = { workspaceId: parsed.workspaceId, pageId: thread.pageId };
  await requireCommentAccess(db, { userId: parsed.userId, scope, required: 'comment' });
  if (thread.status === 'resolved') throw new KnowledgeCommentError('COMMENT_THREAD_RESOLVED');
  const commentId = randomUUID();
  const [entry] = await db.insert(comment).values({
    workspaceId: parsed.workspaceId, id: commentId, threadId: thread.id, authorId: parsed.userId, bodyMd: parsed.bodyMd,
  }).returning();
  const [activeThread] = await db.update(commentThread).set({ updatedAt: new Date() })
    .where(and(eq(commentThread.workspaceId, parsed.workspaceId), eq(commentThread.id, thread.id))).returning();
  const participants = await db.selectDistinct({ userId: comment.authorId }).from(comment)
    .where(and(eq(comment.workspaceId, parsed.workspaceId), eq(comment.threadId, thread.id), ne(comment.authorId, parsed.userId)));
  const notices: CommentNotice[] = [
    ...participants.map((participant) => ({ kind: 'comment.reply' as const, userId: participant.userId })),
    ...parsed.mentions.map((userId) => ({ kind: 'comment.mention' as const, userId })),
  ];
  const notified = await notifyCommentRecipients(db, { scope, threadId: thread.id, commentId, actorId: parsed.userId, notices });
  await emitCommentThreadChanged(db, scope, thread.id);
  return { thread: activeThread, comment: entry, notified };
}

/** Resolve/reopen transition. Re-applying the current status is an idempotent no-op without events. */
async function transitionThread(db: WorkspaceTenantTransaction, input: unknown, status: CommentThreadRow['status']): Promise<{ thread: CommentThreadRow; changed: boolean }> {
  const parsed = parse(threadTargetSchema, input);
  const thread = await lockedThread(db, parsed.workspaceId, parsed.threadId);
  const scope = { workspaceId: parsed.workspaceId, pageId: thread.pageId };
  await requireCommentAccess(db, { userId: parsed.userId, scope, required: 'comment' });
  if (thread.status === status) return { thread, changed: false };
  const [updated] = await db.update(commentThread).set({ status, updatedAt: new Date() })
    .where(and(eq(commentThread.workspaceId, parsed.workspaceId), eq(commentThread.id, thread.id)))
    .returning();
  if (!updated) throw new KnowledgeCommentError('COMMENT_THREAD_NOT_FOUND');
  await emitCommentThreadChanged(db, scope, thread.id);
  return { thread: updated, changed: true };
}

export function resolveCommentThread(db: WorkspaceTenantTransaction, input: unknown) {
  return transitionThread(db, input, 'resolved');
}

export function reopenCommentThread(db: WorkspaceTenantTransaction, input: unknown) {
  return transitionThread(db, input, 'open');
}

/** Authors may remove their own comments; a thread whose last comment is gone is removed with it. */
export async function deleteOwnComment(db: WorkspaceTenantTransaction, input: unknown): Promise<{ threadDeleted: boolean }> {
  const parsed = parse(commentTargetSchema, input);
  const [entry] = await db.select().from(comment)
    .where(and(eq(comment.workspaceId, parsed.workspaceId), eq(comment.id, parsed.commentId)));
  if (!entry) throw new KnowledgeCommentError('COMMENT_NOT_FOUND');
  const thread = await lockedThread(db, parsed.workspaceId, entry.threadId);
  const scope = { workspaceId: parsed.workspaceId, pageId: thread.pageId };
  await requireCommentAccess(db, { userId: parsed.userId, scope, required: 'comment' });
  if (entry.authorId !== parsed.userId) throw new KnowledgeCommentError('COMMENT_ACCESS_DENIED');
  await db.delete(comment).where(and(eq(comment.workspaceId, parsed.workspaceId), eq(comment.id, entry.id)));
  const remaining = await db.select({ id: comment.id }).from(comment)
    .where(and(eq(comment.workspaceId, parsed.workspaceId), eq(comment.threadId, thread.id)));
  if (!remaining.length) {
    await db.delete(commentThread)
      .where(and(eq(commentThread.workspaceId, parsed.workspaceId), eq(commentThread.id, thread.id)));
  }
  await emitCommentThreadChanged(db, scope, thread.id);
  return { threadDeleted: remaining.length === 0 };
}

/**
 * Workspace owners/admins moderate threads on any page they can still view;
 * recycled or otherwise inaccessible pages stay off limits like everywhere else.
 */
export async function deleteCommentThreadAsAdmin(db: WorkspaceTenantTransaction, input: unknown): Promise<void> {
  const parsed = parse(threadTargetSchema, input);
  const thread = await lockedThread(db, parsed.workspaceId, parsed.threadId);
  const scope = { workspaceId: parsed.workspaceId, pageId: thread.pageId };
  await requireCommentAccess(db, { userId: parsed.userId, scope, required: 'view' });
  const [membership] = await db.select().from(member)
    .where(and(eq(member.workspaceId, parsed.workspaceId), eq(member.userId, parsed.userId)));
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new KnowledgeCommentError('COMMENT_ACCESS_DENIED');
  }
  await db.delete(commentThread)
    .where(and(eq(commentThread.workspaceId, parsed.workspaceId), eq(commentThread.id, thread.id)));
  await emitCommentThreadChanged(db, scope, thread.id);
}
