import { z } from 'zod';
import { entityIdSchema, pageScopeSchema, timestampSchema, workspaceScopeSchema } from '../contracts/primitives';

/**
 * Comment wire contracts (N02, design §4.6).
 *
 * The thread body lives in Postgres (N01 service); the CRDT `comment` mark
 * carries only the `threadId`. These are the wire shapes of the future
 * `comment.*` tRPC procedures: inputs are client-friendly (thread/comment ids
 * arrive from the client so the mark applied while composing and the persisted
 * thread share one id), outputs are the N01 rows with dates serialized as
 * ISO strings.
 *
 * Kept as a standalone module (not re-exported by `contracts/index.ts`) until
 * the router task owns the merge; import as `@fouc/shared/knowledge/comments`.
 */

export const commentThreadStatuses = ['open', 'resolved'] as const;
export const commentThreadStatusSchema = z.enum(commentThreadStatuses);
export type CommentThreadStatus = z.infer<typeof commentThreadStatusSchema>;

/** Mirrors the comment body CHECK (btrim length 1..50000); the service trims first. */
export const commentBodySchema = z.string().trim().min(1).max(50_000);

/** Mentions are structured verified user ids, never text parsed out of a body. */
export const commentMentionsSchema = z.array(entityIdSchema).max(100);

export const commentEntrySchema = z.strictObject({
  workspaceId: entityIdSchema,
  id: entityIdSchema,
  threadId: entityIdSchema,
  authorId: entityIdSchema,
  bodyMd: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type CommentEntry = z.infer<typeof commentEntrySchema>;

export const commentThreadSchema = z.strictObject({
  workspaceId: entityIdSchema,
  id: entityIdSchema,
  pageId: entityIdSchema,
  status: commentThreadStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  comments: z.array(commentEntrySchema),
});
export type CommentThread = z.infer<typeof commentThreadSchema>;

export const listCommentThreadsInputSchema = pageScopeSchema;
export type ListCommentThreadsInput = z.infer<typeof listCommentThreadsInputSchema>;

export const createCommentThreadInputSchema = pageScopeSchema.extend({
  /** Client-generated so the optimistic CRDT anchor and the persisted thread share one id. */
  threadId: entityIdSchema,
  commentId: entityIdSchema,
  bodyMd: commentBodySchema,
  mentions: commentMentionsSchema.default([]),
}).refine((input) => new Set(input.mentions).size === input.mentions.length);
export type CreateCommentThreadInput = z.input<typeof createCommentThreadInputSchema>;

export const replyCommentThreadInputSchema = workspaceScopeSchema.extend({
  threadId: entityIdSchema,
  bodyMd: commentBodySchema,
  mentions: commentMentionsSchema.default([]),
}).refine((input) => new Set(input.mentions).size === input.mentions.length);
export type ReplyCommentThreadInput = z.input<typeof replyCommentThreadInputSchema>;

export const commentThreadTargetInputSchema = workspaceScopeSchema.extend({ threadId: entityIdSchema });
export type CommentThreadTargetInput = z.infer<typeof commentThreadTargetInputSchema>;

export const deleteOwnCommentInputSchema = workspaceScopeSchema.extend({ commentId: entityIdSchema });
export type DeleteOwnCommentInput = z.infer<typeof deleteOwnCommentInputSchema>;

/** Service results as they cross the wire (dates serialized, ids untouched). */
export const createCommentThreadResultSchema = z.strictObject({
  thread: commentThreadSchema,
  comment: commentEntrySchema,
  notified: z.array(entityIdSchema),
  /** True when an idempotent retry found the exact thread and comment already persisted. */
  existing: z.boolean(),
});
export type CreateCommentThreadResult = z.infer<typeof createCommentThreadResultSchema>;

export const replyCommentThreadResultSchema = z.strictObject({
  thread: commentThreadSchema,
  comment: commentEntrySchema,
  notified: z.array(entityIdSchema),
});
export type ReplyCommentThreadResult = z.infer<typeof replyCommentThreadResultSchema>;

export const commentThreadTransitionResultSchema = z.strictObject({
  thread: commentThreadSchema,
  changed: z.boolean(),
});
export type CommentThreadTransitionResult = z.infer<typeof commentThreadTransitionResultSchema>;

export const deleteOwnCommentResultSchema = z.strictObject({
  /** The thread was removed with its last comment — the CRDT anchor should follow. */
  threadDeleted: z.boolean(),
});
export type DeleteOwnCommentResult = z.infer<typeof deleteOwnCommentResultSchema>;
