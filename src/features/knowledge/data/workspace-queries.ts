'use client';

/**
 * Workspace-scope queries of the knowledge shell (U02): the O01 workspace list
 * and the O03 teamspace directory, composed on the read-only organization REST
 * client but driven under the U01 knowledge QueryClient and — unlike the O02
 * panel hooks — gated by `enabled`, because the shell only starts loading a
 * scope after the A04 session gate or the access snapshot in front of it has
 * actually passed. Query keys reuse the O02 factory so both surfaces stay
 * cache-coherent about the same server data.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { organizationClient } from '@/features/workspaces/organization-client';
import type { WorkspaceWithRole } from '@/features/workspaces/organization-client';
import type { Teamspace } from '@fouc/shared/knowledge/contracts';
import { knowledgeCatalogClient } from './knowledge-catalog-client';
import { organizationQueryKeys } from '../organization/keys';

const firstCursor = null as string | null;
const nextCursor = (page: { nextCursor: string | null }) => page.nextCursor;

export function useKnowledgeWorkspacesQuery(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: organizationQueryKeys.workspaces,
    queryFn: ({ signal, pageParam }) => organizationClient.listWorkspaces({ cursor: pageParam, signal }),
    enabled,
    initialPageParam: firstCursor,
    getNextPageParam: nextCursor,
  });
}

export function useKnowledgeBasesQuery(workspaceId: string | null) {
  return useInfiniteQuery({
    queryKey: organizationQueryKeys.knowledgeBases(workspaceId ?? 'none'),
    queryFn: ({ signal, pageParam }) => knowledgeCatalogClient.listKnowledgeBases(workspaceId!, { cursor: pageParam, signal }),
    enabled: workspaceId !== null,
    initialPageParam: firstCursor,
    getNextPageParam: nextCursor,
  });
}

export function useKnowledgeTeamspacesQuery(workspaceId: string | null, knowledgeBaseId: string | null) {
  return useInfiniteQuery({
    queryKey: [...organizationQueryKeys.teamspaces(workspaceId ?? 'none'), knowledgeBaseId],
    queryFn: ({ signal, pageParam }) => knowledgeCatalogClient.listTeamspaces(workspaceId!, { knowledgeBaseId: knowledgeBaseId!, cursor: pageParam, signal }),
    enabled: workspaceId !== null && knowledgeBaseId !== null,
    initialPageParam: firstCursor,
    getNextPageParam: nextCursor,
  });
}

/** Flattens the infinite pages into one list (mirrors the O02 `flattenPages` semantics). */
export function flattenWorkspaceList<T>(data: { pages: { items: T[] }[] } | undefined | null): T[] {
  return data ? data.pages.flatMap((page) => page.items) : [];
}

export type { Teamspace, WorkspaceWithRole };
