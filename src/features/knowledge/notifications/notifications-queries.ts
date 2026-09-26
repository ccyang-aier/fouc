'use client';

/**
 * Notification inbox queries and mutations (N03) under the U01 cache.
 *
 * Both reads extend the workspace `notifications` segment, so the B06
 * `notification.created` invalidation (already wired by the knowledge
 * workbench's workspace-event subscription) refetches the bell badge and the
 * list live; mutations invalidate the same namespace, converging local writes
 * and remote events on one loop.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { knowledgeQueryKeys } from '../data/query-keys';
import { invalidateKnowledgeQueries } from '../data/query-client';
import { knowledgeNotificationsApi } from './notifications-api';
import { publishKnowledgeNotifications } from './notifications-bridge';

export function notificationInboxKey(workspaceId: string) {
  return [...knowledgeQueryKeys.notifications(workspaceId), 'inbox'] as const;
}

export function notificationUnreadCountKey(workspaceId: string) {
  return [...knowledgeQueryKeys.notifications(workspaceId), 'unread'] as const;
}

export function useKnowledgeNotificationInbox(workspaceId: string | null, options: { limit?: number } = {}) {
  return useQuery({
    queryKey: [...notificationInboxKey(workspaceId ?? 'none'), options.limit ?? 30],
    queryFn: ({ signal }) => knowledgeNotificationsApi.listInbox(workspaceId!, { limit: options.limit }, signal),
    enabled: workspaceId !== null,
  });
}

export function useKnowledgeNotificationUnreadCount(workspaceId: string | null) {
  return useQuery({
    queryKey: notificationUnreadCountKey(workspaceId ?? 'none'),
    queryFn: ({ signal }) => knowledgeNotificationsApi.unreadCount(workspaceId!, signal),
    enabled: workspaceId !== null,
  });
}

function useNotificationInvalidation(workspaceId: string) {
  const queryClient = useQueryClient();
  return () => {
    void invalidateKnowledgeQueries(queryClient, knowledgeQueryKeys.notifications(workspaceId));
  };
}

export function useMarkNotificationRead(workspaceId: string) {
  const invalidate = useNotificationInvalidation(workspaceId);
  return useMutation({
    mutationFn: (notificationId: string) => knowledgeNotificationsApi.markRead(workspaceId, notificationId),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead(workspaceId: string) {
  const invalidate = useNotificationInvalidation(workspaceId);
  return useMutation({
    mutationFn: () => knowledgeNotificationsApi.markAllRead(workspaceId),
    onSuccess: invalidate,
  });
}

/**
 * Publishes the workbench's live notification state to the shell bell. Mount
 * once inside the knowledge tree (under KnowledgeQueryProvider) with the
 * active workspace and the page-selection callback; `active: false` or unmount
 * retracts the snapshot and the bell falls back to its inert state.
 */
export function useKnowledgeNotificationsBridge(input: { active: boolean; workspaceId: string | null; openPage: (pageId: string | null) => void }) {
  const effectiveWorkspaceId = input.active ? input.workspaceId : null;
  const inbox = useKnowledgeNotificationInbox(effectiveWorkspaceId);
  const { mutate: mutateRead } = useMarkNotificationRead(effectiveWorkspaceId ?? 'none');
  const { mutate: mutateAll } = useMarkAllNotificationsRead(effectiveWorkspaceId ?? 'none');

  // Keep the jump target fresh without republishing on every parent render;
  // the stable closure reads the ref when the bell actually fires.
  const openPageRef = useRef(input.openPage);
  useEffect(() => {
    openPageRef.current = input.openPage;
  });
  const openPage = useCallback((pageId: string | null) => openPageRef.current(pageId), []);
  const runMarkRead = useCallback((notificationId: string) => void mutateRead(notificationId), [mutateRead]);
  const runMarkAll = useCallback(() => void mutateAll(), [mutateAll]);

  const { data, status } = inbox;
  useEffect(() => {
    if (!effectiveWorkspaceId) {
      publishKnowledgeNotifications(null);
      return;
    }
    publishKnowledgeNotifications({
      workspaceId: effectiveWorkspaceId,
      status: status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'ready',
      items: data?.items ?? [],
      unreadCount: data?.unreadCount ?? 0,
      markRead: runMarkRead,
      markAllRead: runMarkAll,
      openPage,
    });
    return () => publishKnowledgeNotifications(null);
  }, [effectiveWorkspaceId, data, status, openPage, runMarkRead, runMarkAll]);
}
