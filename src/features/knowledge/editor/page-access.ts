'use client';

/**
 * P03 page access query of the editor (E03).
 *
 * One `page.access` query with `action: 'view'` decides the whole gate: an
 * allow response carries the page's effective level (view < comment < edit <
 * full), which `levelSatisfies(level, 'edit')` turns into the readonly
 * decision, and a denial is terminal — B01 would refuse the collaboration
 * connection just the same. The key extends the `pages` segment so B06
 * acl.changed events invalidate it with the rest of the page tree.
 */

import { useQuery } from '@tanstack/react-query';
import type { KnowledgeApiOutputs } from '../data/api-types';
import { runKnowledgeCall } from '../data/trpc-client';
import { pageEditorGateOf } from './editor-state';
import type { PageEditorGate } from './editor-state';

export type PageAccessSnapshot = KnowledgeApiOutputs['page']['access'];

export function pageAccessQueryKey(workspaceId: string, pageId: string) {
  return [workspaceId, 'knowledge', 'pages', 'access', pageId] as const;
}

export function usePageAccessQuery(workspaceId: string, pageId: string) {
  return useQuery({
    queryKey: pageAccessQueryKey(workspaceId, pageId),
    queryFn: ({ signal }) => runKnowledgeCall(workspaceId, signal, (client) =>
      client.page.access.query({ workspaceId, pageId, action: 'view' }, { signal })),
    enabled: workspaceId.length > 0 && pageId.length > 0,
  });
}

export interface PageEditorGateState {
  gate: PageEditorGate;
  /** The raw normalized error while the gate is in its error state. */
  error: unknown;
  retry: () => void;
}

export function usePageEditorGate(workspaceId: string, pageId: string): PageEditorGateState {
  const query = usePageAccessQuery(workspaceId, pageId);
  return {
    gate: pageEditorGateOf({ isPending: query.isPending, error: query.error, data: query.data }),
    error: query.error,
    retry: () => void query.refetch(),
  };
}
