'use client';

/**
 * Comment thread queries and mutations (N02) under the U01 cache.
 *
 * One list query per page, keyed by extending the workspace `comments`
 * segment so B06 `comment.changed` events (another member's comment arriving
 * live) and every local mutation converge on the same refetch. Mutations do
 * not fabricate optimistic threads — the sidebar shows their real pending
 * state instead; the CRDT anchor is the only optimistic part of the loop.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { knowledgeQueryKeys } from '../data/query-keys';
import { invalidateKnowledgeQueries } from '../data/query-client';
import { knowledgeCommentsApi } from './comments-api';
import type { CreateKnowledgeCommentInput, ReplyKnowledgeCommentInput } from './comments-api';

export function pageCommentThreadsKey(workspaceId: string, pageId: string) {
  return [...knowledgeQueryKeys.comments(workspaceId), 'page', pageId] as const;
}

export function usePageCommentThreads(workspaceId: string | null, pageId: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: pageCommentThreadsKey(workspaceId ?? 'none', pageId ?? 'none'),
    queryFn: ({ signal }) => knowledgeCommentsApi.listThreads(workspaceId!, pageId!, signal),
    enabled: (options.enabled ?? true) && workspaceId !== null && pageId !== null,
  });
}

function useCommentInvalidation(workspaceId: string) {
  const queryClient = useQueryClient();
  return () => {
    void invalidateKnowledgeQueries(queryClient, knowledgeQueryKeys.comments(workspaceId));
  };
}

export function useCreateCommentThread(workspaceId: string) {
  const invalidate = useCommentInvalidation(workspaceId);
  return useMutation({
    mutationFn: (input: CreateKnowledgeCommentInput) => knowledgeCommentsApi.createThread(workspaceId, input),
    onSuccess: invalidate,
  });
}

export function useReplyCommentThread(workspaceId: string) {
  const invalidate = useCommentInvalidation(workspaceId);
  return useMutation({
    mutationFn: (input: ReplyKnowledgeCommentInput) => knowledgeCommentsApi.replyThread(workspaceId, input),
    onSuccess: invalidate,
  });
}

export function useResolveCommentThread(workspaceId: string) {
  const invalidate = useCommentInvalidation(workspaceId);
  return useMutation({
    mutationFn: (threadId: string) => knowledgeCommentsApi.resolveThread(workspaceId, threadId),
    onSuccess: invalidate,
  });
}

export function useReopenCommentThread(workspaceId: string) {
  const invalidate = useCommentInvalidation(workspaceId);
  return useMutation({
    mutationFn: (threadId: string) => knowledgeCommentsApi.reopenThread(workspaceId, threadId),
    onSuccess: invalidate,
  });
}

export function useDeleteComment(workspaceId: string) {
  const invalidate = useCommentInvalidation(workspaceId);
  return useMutation({
    mutationFn: (commentId: string) => knowledgeCommentsApi.deleteComment(workspaceId, commentId),
    onSuccess: invalidate,
  });
}
