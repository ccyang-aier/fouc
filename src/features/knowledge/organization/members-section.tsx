'use client';

/**
 * Member directory (O02): the workspace member list with role changes and
 * removal. Management controls render only within the actor's authority
 * (`assignableRoles` / `canManageMember`); every mutation is optimistic with a
 * rollback toast on failure.
 */

import { useState } from 'react';
import { CaretDown, Trash, UsersThree } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { MemberRole } from './client';
import { useChangeMemberRoleMutation, useMembersQuery, useRemoveMemberMutation } from './hooks';
import type { MemberRow } from './list-mutations';
import { assignableRoles, canManageMember, memberRoleLabels } from './view-model';
import { ConfirmDialog, ListStateShell, LoadMoreButton, RoleBadge, SectionHeader, flattenPages, mutationErrorText, queryListState } from './ui';

function initialsOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? [...trimmed][0]!.toUpperCase() : '?';
}

export function MembersSection({ workspaceId, actorRole, notify }: {
  workspaceId: string;
  actorRole: MemberRole;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const membersQuery = useMembersQuery(workspaceId);
  const changeRoleMutation = useChangeMemberRoleMutation(workspaceId);
  const removeMutation = useRemoveMemberMutation(workspaceId);
  const [removingMember, setRemovingMember] = useState<MemberRow | null>(null);
  const members = flattenPages<MemberRow>(membersQuery.data);
  const state = queryListState(membersQuery);

  async function changeRole(member: MemberRow, role: MemberRole) {
    if (member.role === role) return;
    try {
      await changeRoleMutation.mutateAsync({ userId: member.userId, role });
      notify('success', `已将 ${member.name} 的角色改为${memberRoleLabels[role]}`);
    } catch (error) {
      notify('error', mutationErrorText('变更角色', error));
    }
  }

  async function removeMember() {
    const member = removingMember;
    if (!member) return;
    try {
      await removeMutation.mutateAsync(member.userId);
      notify('success', `已将 ${member.name} 移出工作区`);
      setRemovingMember(null);
    } catch (error) {
      notify('error', mutationErrorText('移除成员', error));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="成员"
        hint="成员目录展示工作区的全部成员；角色决定其管理与浏览权限，变更立即生效。"
      />
      <ListStateShell
        state={state}
        error={membersQuery.error}
        onRetry={() => void membersQuery.refetch()}
        emptyIcon={<UsersThree className="size-6" aria-hidden />}
        emptyTitle="此工作区暂无成员"
        emptyHint="创建工作区的所有者会出现在这里；新成员加入后会自动列出。"
      >
        <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-panel">
          <div className="grid grid-cols-[minmax(200px,1fr)_150px_64px] items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-2 text-[10px] font-medium text-[var(--muted)]">
            <span>成员</span>
            <span>角色</span>
            <span className="text-right">操作</span>
          </div>
          {members.map((member) => {
            const manageable = canManageMember(actorRole, member.role);
            const roles = assignableRoles(actorRole);
            const busy = changeRoleMutation.isPending || removeMutation.isPending;
            return (
              <div key={member.userId} className="grid grid-cols-[minmax(200px,1fr)_150px_64px] items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--surface-subtle)]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent-ink)]">{initialsOf(member.name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{member.name}</span>
                    <span className="block truncate text-[10.5px] text-[var(--muted)]">{member.email}</span>
                  </span>
                </div>
                {manageable && roles.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`变更 ${member.name} 的角色`}
                        className="flex h-[26px] items-center gap-1 rounded-[6px] border border-transparent px-1.5 outline-none transition-colors hover:border-[var(--line)] hover:bg-panel focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <RoleBadge role={member.role} />
                        <CaretDown className="size-2.5 text-[var(--muted)]" weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[150px]">
                      <DropdownMenuLabel>变更为</DropdownMenuLabel>
                      {roles.map((role) => (
                        <DropdownMenuItem key={role} disabled={busy} onSelect={() => void changeRole(member, role)} className="justify-between text-[11.5px]">
                          {memberRoleLabels[role]}
                          {member.role === role ? <span className="text-[9.5px] text-[var(--muted)]">当前</span> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div><RoleBadge role={member.role} /></div>
                )}
                <div className="flex justify-end">
                  {manageable ? (
                    <button
                      type="button"
                      aria-label={`移除 ${member.name}`}
                      title="移除成员"
                      disabled={busy}
                      onClick={() => setRemovingMember(member)}
                      className={cn('flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--err-ink)_9%,transparent)] hover:text-[var(--err-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-45')}
                    >
                      <Trash className="size-[14px]" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          <LoadMoreButton
            visible={membersQuery.hasNextPage}
            loading={membersQuery.isFetchingNextPage}
            onClick={() => void membersQuery.fetchNextPage()}
          />
        </div>
      </ListStateShell>
      <ConfirmDialog
        open={removingMember !== null}
        onClose={() => setRemovingMember(null)}
        onConfirm={() => void removeMember()}
        busy={removeMutation.isPending}
        title="移除成员"
        confirmLabel="移除"
        body={removingMember ? (
          <>
            确定将 <strong className="font-semibold text-[var(--ink)]">{removingMember.name}</strong>（{removingMember.email}）移出该工作区？
            移除后其将立即失去该工作区的访问权限，所在群组的成员关系也会一并清除。
          </>
        ) : null}
      />
    </div>
  );
}
