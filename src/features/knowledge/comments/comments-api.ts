'use client';

import {
  commentThreadSchema,
  setCommentLikeInputSchema,
  setCommentLikeResultSchema,
  commentThreadTransitionResultSchema,
  createCommentThreadInputSchema,
  createCommentThreadResultSchema,
  deleteOwnCommentInputSchema,
  deleteOwnCommentResultSchema,
  listCommentThreadsInputSchema,
  replyCommentThreadInputSchema,
  replyCommentThreadResultSchema,
  updateOwnCommentInputSchema,
  updateOwnCommentResultSchema,
} from '@fouc/shared/knowledge/comments';
import type {
  CommentThread,
  CommentThreadKind,
  SetCommentLikeResult,
  CommentThreadTransitionResult,
  CreateCommentThreadResult,
  DeleteOwnCommentResult,
  ReplyCommentThreadResult,
  UpdateOwnCommentResult,
} from '@fouc/shared/knowledge/comments';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { KnowledgeDataError, normalizeKnowledgeError } from '../data/errors';
import { createKnowledgeUntypedClientCache, type KnowledgeFetch, type KnowledgeUntypedTrpcClient } from '../data/trpc-client';

const threadListResultSchema = commentThreadSchema.array();

/** A response the shared contracts reject is an unavailable service, never data to render. */
function parseCommentPayload<T>(schema: { safeParse(payload: unknown): { success: true; data: T } | { success: false } }, payload: unknown, procedure: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new KnowledgeDataError('UNAVAILABLE', { message: `评论服务 ${procedure} 返回的数据不符合契约。` });
  }
  return parsed.data;
}

/** Client-side mirrors of the shared input schemas fail fast as INVALID_REQUEST. */
function assertCommentInput(schema: { safeParse(payload: unknown): { success: true } | { success: false } }, input: unknown, procedure: string): void {
  if (!schema.safeParse(input).success) {
    throw new KnowledgeDataError('INVALID_REQUEST', { message: `${procedure} 的输入不符合评论契约。` });
  }
}

export type ReplyKnowledgeCommentInput = { threadId: string; replyToCommentId?: string; bodyMd: string; mentions?: string[] };
export type CreateKnowledgeCommentInput = { pageId: string; threadId: string; commentId: string; kind: CommentThreadKind; anchorKind: 'page' | 'selection'; bodyMd: string; mentions?: string[] };

export type KnowledgeCommentsApi = {
  updateComment(workspaceId: string, commentId: string, bodyMd: string): Promise<UpdateOwnCommentResult>;
  setLike(workspaceId: string, commentId: string, liked: boolean): Promise<SetCommentLikeResult>;
  listThreads(workspaceId: string, pageId: string, signal?: AbortSignal): Promise<CommentThread[]>;
  createThread(workspaceId: string, input: CreateKnowledgeCommentInput, signal?: AbortSignal): Promise<CreateCommentThreadResult>;
  replyThread(workspaceId: string, input: ReplyKnowledgeCommentInput, signal?: AbortSignal): Promise<ReplyCommentThreadResult>;
  resolveThread(workspaceId: string, threadId: string, signal?: AbortSignal): Promise<CommentThreadTransitionResult>;
  reopenThread(workspaceId: string, threadId: string, signal?: AbortSignal): Promise<CommentThreadTransitionResult>;
  deleteComment(workspaceId: string, commentId: string, signal?: AbortSignal): Promise<DeleteOwnCommentResult>;
};

/** Builds the comment surface over one transport: an origin resolver plus a fetch implementation. */
export function createKnowledgeCommentsApi(deps: { resolveOrigin: () => Promise<string> | string; fetchImpl?: KnowledgeFetch }): KnowledgeCommentsApi {
  const cache = createKnowledgeUntypedClientCache(deps.fetchImpl);
  const run = async <T,>(workspaceId: string, signal: AbortSignal | undefined, invoke: (client: KnowledgeUntypedTrpcClient) => Promise<T>): Promise<T> => {
    try {
      const origin = await deps.resolveOrigin();
      return await invoke(cache.get(origin, workspaceId));
    } catch (cause) {
      throw normalizeKnowledgeError(cause, signal);
    }
  };

  return {
    async updateComment(workspaceId, commentId, bodyMd) {
      const wire = { workspaceId, commentId, bodyMd };
      assertCommentInput(updateOwnCommentInputSchema, wire, 'comment.update');
      const payload = await run(workspaceId, undefined, client => client.mutation('comment.update', wire));
      return parseCommentPayload(updateOwnCommentResultSchema, payload, 'comment.update');
    },
    async setLike(workspaceId, commentId, liked) {
      const wire = setCommentLikeInputSchema.parse({ workspaceId, commentId, liked });
      const payload = await run(workspaceId, undefined, client => client.mutation('comment.like', wire));
      return parseCommentPayload(setCommentLikeResultSchema, payload, 'comment.like');
    },
    async listThreads(workspaceId, pageId, signal) {
      const input = listCommentThreadsInputSchema.parse({ workspaceId, pageId });
      const payload = await run(workspaceId, signal, (client) => client.query('comment.list', input, { signal }));
      return parseCommentPayload(threadListResultSchema, payload, 'comment.list');
    },
    async createThread(workspaceId, input, signal) {
      const wire = { workspaceId, pageId: input.pageId, threadId: input.threadId, commentId: input.commentId, kind: input.kind, anchorKind: input.anchorKind, bodyMd: input.bodyMd, mentions: input.mentions ?? [] };
      assertCommentInput(createCommentThreadInputSchema, wire, 'comment.create');
      const payload = await run(workspaceId, signal, (client) => client.mutation('comment.create', wire, { signal }));
      return parseCommentPayload(createCommentThreadResultSchema, payload, 'comment.create');
    },
    async replyThread(workspaceId, input, signal) {
      const wire = { workspaceId, threadId: input.threadId, replyToCommentId: input.replyToCommentId, bodyMd: input.bodyMd, mentions: input.mentions ?? [] };
      assertCommentInput(replyCommentThreadInputSchema, wire, 'comment.reply');
      const payload = await run(workspaceId, signal, (client) => client.mutation('comment.reply', wire, { signal }));
      return parseCommentPayload(replyCommentThreadResultSchema, payload, 'comment.reply');
    },
    async resolveThread(workspaceId, threadId, signal) {
      const wire = { workspaceId, threadId };
      const payload = await run(workspaceId, signal, (client) => client.mutation('comment.resolve', wire, { signal }));
      return parseCommentPayload(commentThreadTransitionResultSchema, payload, 'comment.resolve');
    },
    async reopenThread(workspaceId, threadId, signal) {
      const wire = { workspaceId, threadId };
      const payload = await run(workspaceId, signal, (client) => client.mutation('comment.reopen', wire, { signal }));
      return parseCommentPayload(commentThreadTransitionResultSchema, payload, 'comment.reopen');
    },
    async deleteComment(workspaceId, commentId, signal) {
      const wire = { workspaceId, commentId };
      assertCommentInput(deleteOwnCommentInputSchema, wire, 'comment.delete');
      const payload = await run(workspaceId, signal, (client) => client.mutation('comment.delete', wire, { signal }));
      return parseCommentPayload(deleteOwnCommentResultSchema, payload, 'comment.delete');
    },
  };
}

/** The browser binding the React hooks call. */
export const knowledgeCommentsApi = createKnowledgeCommentsApi({ resolveOrigin: () => getFoucApiOrigin().then(({ origin }) => origin) });
