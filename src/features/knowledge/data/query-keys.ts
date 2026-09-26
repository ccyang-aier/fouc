/**
 * Workspace-namespaced query keys (U01).
 *
 * The workspaceId is the top-level namespace of every knowledge key, so a
 * workspace switch or a workspace-wide invalidation can never leak into
 * another workspace's cache entries. Fine-grained keys extend the same tuple.
 */

export const knowledgeQueryKeys = {
  /** Root of one workspace's namespace: `[workspaceId, 'knowledge']`. */
  workspace: (workspaceId: string) => [workspaceId, 'knowledge'] as const,
  /** The authenticated access snapshot (A00 `access` query). */
  access: (workspaceId: string) => [workspaceId, 'knowledge', 'access'] as const,
};

export type KnowledgeWorkspaceKey = ReturnType<(typeof knowledgeQueryKeys)['workspace']>;
export type KnowledgeQueryKey = KnowledgeWorkspaceKey | ReturnType<(typeof knowledgeQueryKeys)['access']>;
