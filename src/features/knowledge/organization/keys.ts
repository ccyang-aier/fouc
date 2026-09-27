/**
 * Query keys of the organization surface (O02). The workspaceId namespaces
 * every workspace-scoped list so switching or invalidating one workspace can
 * never leak into another workspace's cache entries.
 */

export const organizationQueryKeys = {
  workspaces: ['organization', 'workspaces'] as const,
  knowledgeBases: (workspaceId: string) => ['organization', workspaceId, 'knowledge-bases'] as const,
  members: (workspaceId: string) => ['organization', workspaceId, 'members'] as const,
  groups: (workspaceId: string) => ['organization', workspaceId, 'groups'] as const,
  groupMembers: (workspaceId: string, groupId: string) => ['organization', workspaceId, 'groups', groupId, 'members'] as const,
  teamspaces: (workspaceId: string) => ['organization', workspaceId, 'teamspaces'] as const,
};

export type OrganizationQueryKey =
  | typeof organizationQueryKeys.workspaces
  | ReturnType<(typeof organizationQueryKeys)['knowledgeBases']>
  | ReturnType<(typeof organizationQueryKeys)['members']>
  | ReturnType<(typeof organizationQueryKeys)['groups']>
  | ReturnType<(typeof organizationQueryKeys)['groupMembers']>
  | ReturnType<(typeof organizationQueryKeys)['teamspaces']>;
