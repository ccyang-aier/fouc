'use client';

/**
 * Query and mutation hooks of the organization surface (O02).
 *
 * Queries page by the backend's UUID cursor; every mutation is optimistic: the
 * onMutate step snapshots the cached list and applies a pure reducer, failures
 * restore the snapshot (the UI then surfaces the structured error), and settling
 * re-syncs with the server. Mutations never retry — writes are not idempotent.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationClient } from '@/features/workspaces/organization-client';
import type { MemberRole, OrganizationPage, WorkspaceWithRole } from '@/features/workspaces/organization-client';
import { knowledgeCatalogClient, type TeamspaceAccess } from '../data/knowledge-catalog-client';
import { applyOptimisticList, restoreOptimisticList } from './cache';
import type { OptimisticSnapshot } from './cache';
import { isRetryableOrganizationError } from '@/features/workspaces/organization-errors';
import { organizationQueryKeys } from './keys';
import type { GroupRow, MemberRow, TeamspaceRow } from './list-mutations';
import { applyMemberRole, applyTeamspacePatch, patchByKey, removeByKey, upsertByKey } from './list-mutations';

export function createOrganizationQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: (failureCount, error) => isRetryableOrganizationError(error) && failureCount < 2 },
    },
  });
}

/** The organization surface carries its own QueryClient until the knowledge app mounts a shared one. */
export function OrganizationQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createOrganizationQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const firstPageParam = null as string | null;
const getNextCursor = (page: { nextCursor: string | null }) => page.nextCursor;

type GroupMemberRow = { workspaceId: string; groupId: string; userId: string };

export function useWorkspacesQuery() {
  return useInfiniteQuery({
    queryKey: organizationQueryKeys.workspaces,
    queryFn: ({ signal, pageParam }) => organizationClient.listWorkspaces({ cursor: pageParam, signal }),
    initialPageParam: firstPageParam,
    getNextPageParam: getNextCursor,
  });
}

function useWorkspaceListQuery<T>(
  key: readonly unknown[],
  load: (cursor: string | null, signal: AbortSignal | undefined) => Promise<OrganizationPage<T>>,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ signal, pageParam }) => load(pageParam, signal),
    enabled,
    initialPageParam: firstPageParam,
    getNextPageParam: getNextCursor,
  });
}

export function useMembersQuery(workspaceId: string | null) {
  return useWorkspaceListQuery(
    organizationQueryKeys.members(workspaceId ?? 'none'),
    (cursor, signal) => organizationClient.listMembers(workspaceId!, { cursor, signal }),
    workspaceId !== null,
  );
}

export function useGroupsQuery(workspaceId: string | null) {
  return useWorkspaceListQuery(
    organizationQueryKeys.groups(workspaceId ?? 'none'),
    (cursor, signal) => organizationClient.listGroups(workspaceId!, { cursor, signal }),
    workspaceId !== null,
  );
}

export function useGroupMembersQuery(workspaceId: string | null, groupId: string | null) {
  return useWorkspaceListQuery(
    organizationQueryKeys.groupMembers(workspaceId ?? 'none', groupId ?? 'none'),
    (cursor, signal) => organizationClient.listGroupMembers(workspaceId!, groupId!, { cursor, signal }),
    workspaceId !== null && groupId !== null,
  );
}

export function useTeamspacesQuery(workspaceId: string | null) {
  return useWorkspaceListQuery(
    organizationQueryKeys.teamspaces(workspaceId ?? 'none'),
    (cursor, signal) => knowledgeCatalogClient.listTeamspaces(workspaceId!, { cursor, signal }),
    workspaceId !== null,
  );
}

/** One optimistic list mutation: snapshot, apply reducer, rollback on failure, re-sync on settle. */
function useOptimisticListMutation<TInput, TResult, TRow>(
  key: readonly unknown[],
  call: (input: TInput) => Promise<TResult>,
  optimistic: (input: TInput) => (items: TRow[]) => TRow[],
  applyResult?: (result: TResult, queryClient: QueryClient) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onMutate: (input: TInput) => ({ snapshot: applyOptimisticList<TRow>(queryClient, key, optimistic(input)) }),
    onError: (_error: unknown, _input: TInput, context: { snapshot: OptimisticSnapshot } | undefined) =>
      restoreOptimisticList(queryClient, context?.snapshot ?? null),
    ...(applyResult
      ? { onSuccess: (result: TResult) => applyResult(result, queryClient) }
      : {}),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  const key = organizationQueryKeys.workspaces;
  return useMutation({
    mutationFn: (input: { name: string; kind: 'personal' | 'team' }) => organizationClient.createWorkspace(input),
    onMutate: ({ name, kind }) => {
      const optimistic: WorkspaceWithRole = { id: pendingId(), name: name.trim(), kind, settings: {}, role: 'owner' };
      return { tempId: optimistic.id, snapshot: applyOptimisticList<WorkspaceWithRole>(queryClient, key, (items) => [...items, optimistic]) };
    },
    onSuccess: (created, _input, context) => {
      applyOptimisticList<WorkspaceWithRole>(queryClient, key, (items) => upsertByKey(removeByKey(items, (row) => row.id, context.tempId), (row) => row.id, created));
    },
    onError: (_error, _input, context) => restoreOptimisticList(queryClient, (context as { snapshot: OptimisticSnapshot } | undefined)?.snapshot ?? null),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useChangeMemberRoleMutation(workspaceId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.members(workspaceId),
    (input: { userId: string; role: MemberRole }) => organizationClient.changeMemberRole(workspaceId, input),
    ({ userId, role }) => (items: MemberRow[]) => applyMemberRole(items, userId, role),
    (member, queryClient) => {
      applyOptimisticList<MemberRow>(queryClient, organizationQueryKeys.members(workspaceId), (items) => patchByKey(items, (row) => row.userId, member.userId, { role: member.role }));
    },
  );
}

export function useRemoveMemberMutation(workspaceId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.members(workspaceId),
    (userId: string) => organizationClient.removeMember(workspaceId, userId),
    (userId) => (items: MemberRow[]) => removeByKey(items, (row) => row.userId, userId),
  );
}

export function useCreateGroupMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = organizationQueryKeys.groups(workspaceId);
  return useMutation({
    mutationFn: (name: string) => organizationClient.createGroup(workspaceId, { name }),
    onMutate: (name) => {
      const optimistic: GroupRow = { workspaceId, id: pendingId(), name: name.trim() };
      return { tempId: optimistic.id, snapshot: applyOptimisticList<GroupRow>(queryClient, key, (items) => [...items, optimistic]) };
    },
    onSuccess: (created, _name, context) => {
      applyOptimisticList<GroupRow>(queryClient, key, (items) => upsertByKey(removeByKey(items, (row) => row.id, context.tempId), (row) => row.id, created));
    },
    onError: (_error, _name, context) => restoreOptimisticList(queryClient, (context as { snapshot: OptimisticSnapshot } | undefined)?.snapshot ?? null),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useRenameGroupMutation(workspaceId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.groups(workspaceId),
    (input: { id: string; name: string }) => organizationClient.renameGroup(workspaceId, input),
    ({ id, name }) => (items: GroupRow[]) => patchByKey(items, (row) => row.id, id, { name: name.trim() }),
    (group, queryClient) => {
      applyOptimisticList<GroupRow>(queryClient, organizationQueryKeys.groups(workspaceId), (items) => patchByKey(items, (row) => row.id, group.id, { name: group.name }));
    },
  );
}

export function useRemoveGroupMutation(workspaceId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.groups(workspaceId),
    (groupId: string) => organizationClient.removeGroup(workspaceId, groupId),
    (groupId) => (items: GroupRow[]) => removeByKey(items, (row) => row.id, groupId),
  );
}

export function useAddGroupMemberMutation(workspaceId: string, groupId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.groupMembers(workspaceId, groupId),
    (userId: string) => organizationClient.addGroupMember(workspaceId, groupId, userId),
    (userId) => (items: GroupMemberRow[]) => upsertByKey(items, (row) => row.userId, { workspaceId, groupId, userId }),
  );
}

export function useRemoveGroupMemberMutation(workspaceId: string, groupId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.groupMembers(workspaceId, groupId),
    (userId: string) => organizationClient.removeGroupMember(workspaceId, groupId, userId),
    (userId) => (items: GroupMemberRow[]) => removeByKey(items, (row) => row.userId, userId),
  );
}

export function useCreateTeamspaceMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = organizationQueryKeys.teamspaces(workspaceId);
  return useMutation({
    mutationFn: (input: { knowledgeBaseId: string; name: string; defaultAccess: TeamspaceAccess }) => knowledgeCatalogClient.createTeamspace(workspaceId, input),
    onMutate: ({ knowledgeBaseId, name, defaultAccess }) => {
      const optimistic: TeamspaceRow = { workspaceId, knowledgeBaseId, id: pendingId(), name: name.trim(), defaultAccess };
      return { tempId: optimistic.id, snapshot: applyOptimisticList<TeamspaceRow>(queryClient, key, (items) => [...items, optimistic]) };
    },
    onSuccess: (created, _input, context) => {
      applyOptimisticList<TeamspaceRow>(queryClient, key, (items) => upsertByKey(removeByKey(items, (row) => row.id, context.tempId), (row) => row.id, created));
    },
    onError: (_error, _input, context) => restoreOptimisticList(queryClient, (context as { snapshot: OptimisticSnapshot } | undefined)?.snapshot ?? null),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateTeamspaceMutation(workspaceId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.teamspaces(workspaceId),
    (input: { id: string; patch: { name?: string; defaultAccess?: TeamspaceAccess } }) => knowledgeCatalogClient.updateTeamspace(workspaceId, input.id, input.patch),
    ({ id, patch }) => (items: TeamspaceRow[]) => applyTeamspacePatch(items, id, patch),
    (teamspace, queryClient) => {
      applyOptimisticList<TeamspaceRow>(queryClient, organizationQueryKeys.teamspaces(workspaceId), (items) => patchByKey(items, (row) => row.id, teamspace.id, { name: teamspace.name, defaultAccess: teamspace.defaultAccess }));
    },
  );
}

export function useRemoveTeamspaceMutation(workspaceId: string) {
  return useOptimisticListMutation(
    organizationQueryKeys.teamspaces(workspaceId),
    (teamspaceId: string) => knowledgeCatalogClient.removeTeamspace(workspaceId, teamspaceId),
    (teamspaceId) => (items: TeamspaceRow[]) => removeByKey(items, (row) => row.id, teamspaceId),
  );
}

function pendingId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `pending-${crypto.randomUUID()}` : `pending-${Date.now()}-${Math.random()}`;
}
