import { knowledgeQueryKeys } from './query-keys';
import type { KnowledgeQueryKey } from './query-keys';

/**
 * B06 → U01 invalidation bridge: translates the workspace-event channel's key
 * segments into query keys of the U01 factory. This is the single place where
 * the event contract meets the cache, so a new event segment only needs one
 * mapping entry. Unknown or multi-segment shapes fail safe to the whole
 * workspace namespace — a superset invalidation can never miss the affected
 * query, while a wrong narrow key could.
 */

const keyBySegment: Record<string, (workspaceId: string) => KnowledgeQueryKey> = {
  access: knowledgeQueryKeys.access,
  pages: knowledgeQueryKeys.pages,
  comments: knowledgeQueryKeys.comments,
  notifications: knowledgeQueryKeys.notifications,
  databases: knowledgeQueryKeys.databases,
  assets: knowledgeQueryKeys.assets,
  aiTasks: knowledgeQueryKeys.aiTasks,
};

/** One event segment → one query key; anything unrecognized widens to the workspace root. */
export function knowledgeKeyForSegment(workspaceId: string, segment: readonly string[]): KnowledgeQueryKey {
  const factory = segment.length === 1 ? keyBySegment[segment[0]] : undefined;
  return factory ? factory(workspaceId) : knowledgeQueryKeys.workspace(workspaceId);
}

/** All segments of one workspace event → the deduplicated keys to invalidate. */
export function knowledgeKeysForSegments(workspaceId: string, segments: readonly (readonly string[])[]): KnowledgeQueryKey[] {
  const keys = segments.map((segment) => knowledgeKeyForSegment(workspaceId, segment));
  const unique = new Map(keys.map((key) => [key.join('\u0000'), key]));
  return [...unique.values()];
}

/** The B06 reconnect case: invalidate the whole workspace namespace. */
export function knowledgeWorkspaceRootKey(workspaceId: string): KnowledgeQueryKey {
  return knowledgeQueryKeys.workspace(workspaceId);
}
