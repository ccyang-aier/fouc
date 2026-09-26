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
  /** Page tree / navigation / page metadata (page.* and acl.changed events). */
  pages: (workspaceId: string) => [workspaceId, 'knowledge', 'pages'] as const,
  /** Comment threads (comment.changed events). */
  comments: (workspaceId: string) => [workspaceId, 'knowledge', 'comments'] as const,
  /** Notification inbox (notification.created events). */
  notifications: (workspaceId: string) => [workspaceId, 'knowledge', 'notifications'] as const,
  /** Database rows (database.rows.changed events). */
  databases: (workspaceId: string) => [workspaceId, 'knowledge', 'databases'] as const,
  /** Asset metadata and processing states (asset.updated events). */
  assets: (workspaceId: string) => [workspaceId, 'knowledge', 'assets'] as const,
  /** AI task states (ai.task.changed events). */
  aiTasks: (workspaceId: string) => [workspaceId, 'knowledge', 'aiTasks'] as const,
};

export type KnowledgeWorkspaceKey = ReturnType<(typeof knowledgeQueryKeys)['workspace']>;
export type KnowledgeQueryKey =
  | KnowledgeWorkspaceKey
  | ReturnType<(typeof knowledgeQueryKeys)['access']>
  | ReturnType<(typeof knowledgeQueryKeys)['pages']>
  | ReturnType<(typeof knowledgeQueryKeys)['comments']>
  | ReturnType<(typeof knowledgeQueryKeys)['notifications']>
  | ReturnType<(typeof knowledgeQueryKeys)['databases']>
  | ReturnType<(typeof knowledgeQueryKeys)['assets']>
  | ReturnType<(typeof knowledgeQueryKeys)['aiTasks']>;
