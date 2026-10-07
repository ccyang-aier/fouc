"use client";

import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { knowledgeCatalogClient } from './knowledge-catalog-client';
import { organizationQueryKeys } from '../organization/keys';

const firstCursor = null as string | null;
const nextCursor = (page: { nextCursor: string | null }) => page.nextCursor;

export function useKnowledgeBasesQuery(enabled: boolean = true) {
  const query = useInfiniteQuery({
    queryKey: organizationQueryKeys.knowledgeBases,
    queryFn: ({ signal, pageParam }) => knowledgeCatalogClient.listKnowledgeBases({ cursor: pageParam, signal }),
    enabled,
    initialPageParam: firstCursor,
    getNextPageParam: nextCursor,
  });
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  useEffect(() => {
    if (enabled && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [enabled, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  return query;

}

export function useKnowledgeTeamspacesQuery(knowledgeBaseId: string | null) {
  return useInfiniteQuery({
    queryKey: organizationQueryKeys.teamspaces(knowledgeBaseId ?? 'none'),
    queryFn: ({ signal, pageParam }) => knowledgeCatalogClient.listTeamspaces(knowledgeBaseId!, { cursor: pageParam, signal }),
    enabled: knowledgeBaseId !== null,
    initialPageParam: firstCursor,
    getNextPageParam: nextCursor,
  });
}

export function flattenKnowledgeBaseList<T>(data: { pages: { items: T[] }[] } | undefined | null): T[] {
  return data ? data.pages.flatMap((page) => page.items) : [];
}
