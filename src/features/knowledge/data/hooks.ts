'use client';

import { useQuery } from '@tanstack/react-query';
import type { KnowledgeApiOutputs } from './api-types';
import { knowledgeQueryKeys } from './query-keys';
import { runKnowledgeCall } from './trpc-client';

/**
 * Query hooks of the knowledge data layer (U01). Each hook composes the
 * workspace key factory, the typed tRPC client, signal pass-through and the
 * error normalization in one place; U02+ follows this pattern per procedure.
 */

export type KnowledgeAccess = KnowledgeApiOutputs['access'];

export function useKnowledgeAccessQuery(workspaceId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: knowledgeQueryKeys.access(workspaceId),
    queryFn: ({ signal }) => runKnowledgeCall(workspaceId, signal, (client) => client.access.query({ workspaceId }, { signal })),
    // U02: the shell only asks for the access snapshot once a workspace is
    // actually active — an empty id would only produce transport noise.
    enabled: (options.enabled ?? true) && workspaceId.length > 0,
  });
}
