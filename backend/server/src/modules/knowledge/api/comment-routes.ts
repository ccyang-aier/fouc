import { TRPCError } from '@trpc/server';
import type {
  CommentEntry,
  CommentThread,
} from '@fouc/shared/knowledge/comments';
import {
  commentThreadTargetInputSchema,
  createCommentThreadInputSchema,
  deleteOwnCommentInputSchema,
  listCommentThreadsInputSchema,
  replyCommentThreadInputSchema,
} from '@fouc/shared/knowledge/comments';
import { KnowledgeCommentError } from '../comments/errors';
import { createCommentThreadWithId } from '../comments/create-with-id';
import {
  deleteOwnComment,
  reopenCommentThread,
  replyCommentThread,
  resolveCommentThread,
} from '../comments/mutations';
import { listPageCommentThreads } from '../comments/queries';
import type { CommentRow, CommentThreadRow, CommentThreadWithComments } from '../comments/queries';
import type { WorkspaceTenantTransaction } from '../../../platform/database/workspace/tenant';
import { apiError } from './errors';
import { knowledgeMutation, knowledgeQuery } from './procedures';

/**
 * N02: the `comment.*` tRPC procedures — the wire surface the comments sidebar
 * and the CRDT anchor loop call (`comment.list` / `create` / `reply` /
 * `resolve` / `reopen` / `delete`). Inputs and outputs are the shared
 * `@fouc/shared/knowledge/comments` contracts verbatim: thread and comment ids
 * arrive from the client so the optimistic `comment` mark and the persisted
 * thread share one id, and the row dates serialize to ISO strings here.
 *
 * Not wired into the router yet (the router file belongs to another task).
 * Suggested wiring — one nested record in `router.ts`:
 *
 *   import { knowledgeCommentRouterRecord } from './comment-routes';
 *   export const knowledgeApiRouter = createKnowledgeRouter({
 *     …,
 *     comment: knowledgeCommentRouterRecord,
 *   });
 *
 * Every procedure authorizes the page ACL again inside its own tenant
 * transaction (N01 `requireCommentAccess`); the declared credential scopes
 * only say which PAT may reach the procedure at all (`read` lists, `write`
 * mutates — sessions always carry both).
 */

/** N01 service errors fold to the safe tRPC allowlist; unknown errors stay opaque. */
function toCommentTrpcError(error: unknown): TRPCError {
  if (error instanceof KnowledgeCommentError) {    const code = ({
      INVALID_COMMENT_INPUT: 'BAD_REQUEST',
      COMMENT_ACCESS_DENIED: 'FORBIDDEN',
      COMMENT_THREAD_NOT_FOUND: 'NOT_FOUND',
      COMMENT_NOT_FOUND: 'NOT_FOUND',
      COMMENT_THREAD_RESOLVED: 'CONFLICT',
    } as const)[error.code];
    return new TRPCError({ code });
  }
  return apiError(error);
}

function serializeEntry(row: CommentRow): CommentEntry {
  return {
    workspaceId: row.workspaceId,
    id: row.id,
    threadId: row.threadId,
    authorId: row.authorId,
    bodyMd: row.bodyMd,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeThread(row: CommentThreadRow & { comments?: CommentRow[] }, comments?: CommentRow[]): CommentThread {
  return {
    workspaceId: row.workspaceId,
    id: row.id,
    pageId: row.pageId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    comments: (comments ?? row.comments ?? []).map(serializeEntry),
  };
}

/**
 * The mutation services return thread rows without their comment chains; the
 * wire contract carries the full thread, so mutation results re-read the one
 * thread inside the same transaction (its own visibility already granted).
 */
async function serializeFullThread(db: WorkspaceTenantTransaction, input: { workspaceId: string; pageId: string }, userId: string, threadId: string): Promise<CommentThread> {
  const threads: CommentThreadWithComments[] = await listPageCommentThreads(db, { ...input, userId });
  const found = threads.find((thread) => thread.id === threadId);
  if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
  return serializeThread(found);
}

/**
 * The `comment.*` procedure record (unannotated on purpose: the inferred
 * per-procedure input/output types flow into the router and the typed tRPC
 * clients). Suggested wiring — one nested record in `router.ts`:
 *
 *   import { knowledgeCommentRouterRecord } from './comment-routes';
 *   export const knowledgeApiRouter = createKnowledgeRouter({
 *     …,
 *     comment: knowledgeCommentRouterRecord,
 *   });
 */
export const knowledgeCommentRouterRecord = {
  /** The sidebar list: threads with their reply chains, in creation order. */
  list: knowledgeQuery({
    input: listCommentThreadsInputSchema,
    scopes: ['read'],
    resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
      try {
        const threads: CommentThreadWithComments[] = await listPageCommentThreads(db, {
          workspaceId: input.workspaceId,
          pageId: input.pageId,
          userId: authority.userId,
        });
        return threads.map((thread) => serializeThread(thread));
      } catch (error) {
        throw toCommentTrpcError(error);
      }
    }),
  }),

  /** Client-id creation: the CRDT anchor's threadId is the persisted thread's id. */
  create: knowledgeMutation({
    input: createCommentThreadInputSchema,
    scopes: ['write'],
    resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
      try {
        const created = await createCommentThreadWithId(db, { ...input, userId: authority.userId });
        const entry = serializeEntry(created.comment);
        return {
          // The thread holds exactly this one comment at creation.
          thread: serializeThread(created.thread, [created.comment]),
          comment: entry,
          notified: created.notified,
          existing: created.existing,
        };
      } catch (error) {
        throw toCommentTrpcError(error);
      }
    }),
  }),

  reply: knowledgeMutation({
    input: replyCommentThreadInputSchema,
    scopes: ['write'],
    resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
      try {
        const replied = await replyCommentThread(db, { ...input, userId: authority.userId });
        return {
          thread: await serializeFullThread(db, { workspaceId: input.workspaceId, pageId: replied.thread.pageId }, authority.userId, replied.thread.id),
          comment: serializeEntry(replied.comment),
          notified: replied.notified,
        };
      } catch (error) {
        throw toCommentTrpcError(error);
      }
    }),
  }),

  resolve: knowledgeMutation({
    input: commentThreadTargetInputSchema,
    scopes: ['write'],
    resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
      try {
        const resolved = await resolveCommentThread(db, { ...input, userId: authority.userId });
        return {
          thread: await serializeFullThread(db, { workspaceId: input.workspaceId, pageId: resolved.thread.pageId }, authority.userId, resolved.thread.id),
          changed: resolved.changed,
        };
      } catch (error) {
        throw toCommentTrpcError(error);
      }
    }),
  }),

  reopen: knowledgeMutation({
    input: commentThreadTargetInputSchema,
    scopes: ['write'],
    resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
      try {
        const reopened = await reopenCommentThread(db, { ...input, userId: authority.userId });
        return {
          thread: await serializeFullThread(db, { workspaceId: input.workspaceId, pageId: reopened.thread.pageId }, authority.userId, reopened.thread.id),
          changed: reopened.changed,
        };
      } catch (error) {
        throw toCommentTrpcError(error);
      }
    }),
  }),

  /** Removing one's own comment; the client drops the anchor when the thread went with it. */
  delete: knowledgeMutation({
    input: deleteOwnCommentInputSchema,
    scopes: ['write'],
    resolve: ({ ctx, input }) => ctx.withTenant(async (db, authority) => {
      try {
        return await deleteOwnComment(db, { ...input, userId: authority.userId });
      } catch (error) {
        throw toCommentTrpcError(error);
      }
    }),
  }),
};
