'use client';

/**
 * Comment thread client surface (N02) on the U01 tRPC transport.
 *
 * Same contract as the pages client: the shared `comment` contracts own every
 * input and output shape, the `comment.*` HTTP routes are mounted by the API
 * task, so until then each call fails honestly with the transport's NOT_FOUND
 * — never with fabricated threads. Calls go through the tRPC client's dynamic
 * entry points and every response is re-validated at this boundary.
 */

import {
  commentThreadSchema,
  commentThreadTransitionResultSchema,
  createCommentThreadInputSchema,
  createCommentThreadResultSchema,
  deleteOwnCommentInputSchema,
  deleteOwnCommentResultSchema,
  listCommentThreadsInputSchema,
  replyCommentThreadInputSchema,
  replyCommentThreadResultSchema,
} from '@fouc/shared/knowledge/comments';
import type {
  CommentThread,
  CommentThreadTransitionResult,
  CreateCommentThreadResult,
  DeleteOwnCommentResult,
  ReplyCommentThreadResult,
} from '@fouc/shared/knowledge/comments';
import { getKnowledgeApiOrigin } from '../data/endpoint';
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

export type ReplyKnowledgeCommentInput = { threadId: string; bodyMd: string; mentions?: string[] };
export type CreateKnowledgeCommentInput = { pageId: string; threadId: string; commentId: string; bodyMd: string; mentions?: string[] };

export type KnowledgeCommentsApi = {
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
    async listThreads(workspaceId, pageId, signal) {
      const input = listCommentThreadsInputSchema.parse({ workspaceId, pageId });
      const payload = await run(workspaceId, signal, (client) => client.query('comment.list', input, { signal }));
      return parseCommentPayload(threadListResultSchema, payload, 'comment.list');
    },
    async createThread(workspaceId, input, signal) {
      const wire = { workspaceId, pageId: input.pageId, threadId: input.threadId, commentId: input.commentId, bodyMd: input.bodyMd, mentions: input.mentions ?? [] };
      assertCommentInput(createCommentThreadInputSchema, wire, 'comment.create');
      const payload = await run(workspaceId, signal, (client) => client.mutation('comment.create', wire, { signal }));
      return parseCommentPayload(createCommentThreadResultSchema, payload, 'comment.create');
    },
    async replyThread(workspaceId, input, signal) {
      const wire = { workspaceId, threadId: input.threadId, bodyMd: input.bodyMd, mentions: input.mentions ?? [] };
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
export const knowledgeCommentsApi = createKnowledgeCommentsApi({ resolveOrigin: () => getKnowledgeApiOrigin().then(({ origin }) => origin) });
