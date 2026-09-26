'use client';

/**
 * Group management (O02): create / rename / delete groups and manage their
 * membership. Group rows expand into a member panel that resolves user ids
 * against the workspace member directory; membership writes are optimistic.
 */

import { useMemo, useState } from 'react';
import { CaretDown, PencilSimple, Plus, Trash, UsersThree, X } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { validateOrganizationName } from './client';
import type { GroupMemberRow, MemberRole } from './client';
import { useAddGroupMemberMutation, useCreateGroupMutation, useGroupMembersQuery, useMembersQuery, useRemoveGroupMemberMutation, useRemoveGroupMutation, useRenameGroupMutation, useGroupsQuery } from './hooks';
import type { GroupRow, MemberRow } from './list-mutations';
import { canManageOrganization } from './view-model';
import { ConfirmDialog, DialogButton, ListStateShell, LoadMoreButton, ModalDialog, NameField, SectionHeader, flattenPages, mutationErrorText, queryListState } from './ui';

export function GroupsSection({ workspaceId, actorRole, notify }: {
  workspaceId: string;
  actorRole: MemberRole;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const canManage = canManageOrganization(actorRole);
  const groupsQuery = useGroupsQuery(workspaceId);
  const membersQuery = useMembersQuery(workspaceId);
  const createMutation = useCreateGroupMutation(workspaceId);
  const renameMutation = useRenameGroupMutation(workspaceId);
  const removeMutation = useRemoveGroupMutation(workspaceId);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<GroupRow | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<GroupRow | null>(null);

  const groups = flattenPages<GroupRow>(groupsQuery.data);
  const directory = flattenPages<MemberRow>(membersQuery.data);

  async function rename(group: GroupRow, name: string) {
    try {
      await renameMutation.mutateAsync({ id: group.id, name });
      notify('success', '群组已重命名');
      setRenamingGroup(null);
    } catch (error) {
      notify('error', mutationErrorText('重命名群组', error));
    }
  }

  async function remove() {
    const group = deletingGroup;
    if (!group) return;
    try {
      await removeMutation.mutateAsync(group.id);
      notify('success', `群组「${group.name}」已删除`);
      if (expandedGroupId === group.id) setExpandedGroupId(null);
      setDeletingGroup(null);
    } catch (error) {
      notify('error', mutationErrorText('删除群组', error));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="群组"
        hint="把成员编入群组后，可以按群组为主体授予页面权限。"
        action={canManage ? (
          <DialogButton variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" weight="bold" />新建群组
          </DialogButton>
        ) : undefined}
      />
      <ListStateShell
        state={queryListState(groupsQuery)}
        error={groupsQuery.error}
        onRetry={() => void groupsQuery.refetch()}
        emptyIcon={<UsersThree className="size-6" aria-hidden />}
        emptyTitle="还没有群组"
        emptyHint="群组用于把多个成员作为一个主体授权，便于按团队分配页面权限。"
        emptyAction={canManage ? (
          <DialogButton variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" weight="bold" />新建群组
          </DialogButton>
        ) : undefined}
      >
        <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-panel">
          {groups.map((group) => {
            const expanded = expandedGroupId === group.id;
            return (
              <div key={group.id} className="border-b border-[var(--line)] last:border-b-0">
                <div className={cn('flex items-center gap-2.5 px-4 py-2.5 transition-colors', expanded ? 'bg-[var(--surface-subtle)]' : 'hover:bg-[var(--surface-subtle)]')}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? '收起' : '展开'}群组「${group.name}」的成员`}
                    onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded-[6px]"
                  >
                    <CaretDown className={cn('size-3 shrink-0 text-[var(--muted)] transition-transform', expanded ? '' : '-rotate-90')} weight="bold" />
                    <UsersThree className="size-3.5 shrink-0 text-[var(--muted-strong)]" weight="bold" />
                    <span className="min-w-0 truncate text-[12px] font-medium text-[var(--ink)]">{group.name}</span>
                  </button>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconAction label={`重命名群组「${group.name}」`} title="重命名" onClick={() => setRenamingGroup(group)}><PencilSimple className="size-[14px]" /></IconAction>
                      <IconAction label={`删除群组「${group.name}」`} title="删除群组" onClick={() => setDeletingGroup(group)} danger><Trash className="size-[14px]" /></IconAction>
                    </div>
                  ) : null}
                </div>
                {expanded ? (
                  <GroupMembersPanel
                    workspaceId={workspaceId}
                    groupId={group.id}
                    directory={directory}
                    canManage={canManage}
                    notify={notify}
                  />
                ) : null}
              </div>
            );
          })}
          <LoadMoreButton
            visible={groupsQuery.hasNextPage}
            loading={groupsQuery.isFetchingNextPage}
            onClick={() => void groupsQuery.fetchNextPage()}
          />
        </div>
      </ListStateShell>

      <CreateGroupDialog
        open={creating}
        onClose={() => setCreating(false)}
        busy={createMutation.isPending}
        onSubmit={async (name) => {
          try {
            const group = await createMutation.mutateAsync(name);
            notify('success', `群组「${group.name}」已创建`);
            setCreating(false);
          } catch (error) {
            notify('error', mutationErrorText('创建群组', error));
          }
        }}
      />
      <RenameGroupDialog
        key={renamingGroup?.id ?? 'none'}
        group={renamingGroup}
        busy={renameMutation.isPending}
        onClose={() => setRenamingGroup(null)}
        onSubmit={(name) => renamingGroup && void rename(renamingGroup, name)}
      />
      <ConfirmDialog
        open={deletingGroup !== null}
        onClose={() => setDeletingGroup(null)}
        onConfirm={() => void remove()}
        busy={removeMutation.isPending}
        title="删除群组"
        confirmLabel="删除"
        body={deletingGroup ? (
          <>
            确定删除群组 <strong className="font-semibold text-[var(--ink)]">{deletingGroup.name}</strong>？
            群组内的成员关系会一并清除，成员本身不受影响。
          </>
        ) : null}
      />
    </div>
  );
}

function IconAction({ label, title, onClick, danger, children }: { label: string; title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
        danger ? 'hover:bg-[color-mix(in_srgb,var(--err-ink)_9%,transparent)] hover:text-[var(--err-ink)]' : 'hover:bg-wash hover:text-[var(--ink)]',
      )}
    >
      {children}
    </button>
  );
}

function GroupMembersPanel({ workspaceId, groupId, directory, canManage, notify }: {
  workspaceId: string;
  groupId: string;
  directory: readonly MemberRow[];
  canManage: boolean;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const membersQuery = useGroupMembersQuery(workspaceId, groupId);
  const addMutation = useAddGroupMemberMutation(workspaceId, groupId);
  const removeMutation = useRemoveGroupMemberMutation(workspaceId, groupId);
  const rows = flattenPages<GroupMemberRow>(membersQuery.data);
  const nameOf = useMemo(() => new Map(directory.map((member) => [member.userId, member])), [directory]);
  const inGroup = new Set(rows.map((row) => row.userId));
  const candidates = directory.filter((member) => !inGroup.has(member.userId));

  async function add(member: MemberRow) {
    try {
      await addMutation.mutateAsync(member.userId);
      notify('success', `已将 ${member.name} 加入群组`);
    } catch (error) {
      notify('error', mutationErrorText('添加群组成员', error));
    }
  }

  async function remove(userId: string) {
    try {
      await removeMutation.mutateAsync(userId);
      notify('success', '已移出群组');
    } catch (error) {
      notify('error', mutationErrorText('移除群组成员', error));
    }
  }

  return (
    <div className="border-t border-[var(--line)] bg-[var(--surface-subtle)] px-4 pb-3.5 pt-3">
      <ListStateShell
        state={queryListState(membersQuery)}
        error={membersQuery.error}
        onRetry={() => void membersQuery.refetch()}
        emptyTitle="群组内暂无成员"
        emptyHint="从工作区成员中选择并加入该群组。"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {rows.map((row) => {
            const member = nameOf.get(row.userId);
            return (
              <span key={row.userId} className="flex h-[26px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-panel pl-2.5 pr-1.5 text-[11px] text-[var(--ink-soft)]">
                {member?.name ?? `${row.userId.slice(0, 8)}…`}
                {canManage ? (
                  <button
                    type="button"
                    aria-label={`将 ${member?.name ?? row.userId} 移出群组`}
                    disabled={removeMutation.isPending}
                    onClick={() => void remove(row.userId)}
                    className="flex size-[18px] items-center justify-center rounded-full text-[var(--muted)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--err-ink)_10%,transparent)] hover:text-[var(--err-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-45"
                  >
                    <X className="size-2.5" weight="bold" />
                  </button>
                ) : null}
              </span>
            );
          })}
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="添加群组成员"
                  disabled={addMutation.isPending}
                  className="flex h-[26px] items-center gap-1 rounded-full border border-dashed border-[var(--line-strong)] px-2.5 text-[11px] text-[var(--muted-strong)] outline-none transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-45"
                >
                  <Plus className="size-3" weight="bold" />
                  添加成员
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[260px] w-[240px] overflow-y-auto">
                <DropdownMenuLabel>工作区成员</DropdownMenuLabel>
                {candidates.length === 0 ? (
                  <div className="px-2.5 py-2 text-[10.5px] text-[var(--muted)]">工作区成员都已在群组中</div>
                ) : candidates.map((member) => (
                  <DropdownMenuItem key={member.userId} onSelect={() => void add(member)} className="flex-col items-start gap-0">
                    <span className="text-[11.5px]">{member.name}</span>
                    <span className="text-[9.5px] text-[var(--muted)]">{member.email}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </ListStateShell>
    </div>
  );
}

function CreateGroupDialog({ open, onClose, busy, onSubmit }: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const validation = validateOrganizationName(name);
  function close() { onClose(); setName(''); setTouched(false); }
  function submit() {
    setTouched(true);
    if (validation.ok) onSubmit(validation.value);
  }
  return (
    <ModalDialog
      open={open}
      onClose={close}
      title="新建群组"
      description="群组是授权主体之一：把成员编入群组后，可以按群组授予页面权限。"
      footer={
        <>
          <DialogButton onClick={close}>取消</DialogButton>
          <DialogButton variant="primary" disabled={!validation.ok || busy} onClick={submit}>{busy ? '正在创建…' : '创建群组'}</DialogButton>
        </>
      }
    >
      <NameField
        label="群组名称"
        value={name}
        onChange={(value) => { setName(value); setTouched(true); }}
        onSubmit={submit}
        placeholder="例如：产品设计组"
        autoFocus
        invalidReason={touched && !validation.ok ? validation.reason : undefined}
      />
    </ModalDialog>
  );
}

function RenameGroupDialog({ group, busy, onClose, onSubmit }: {
  group: GroupRow | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [touched, setTouched] = useState(false);
  const validation = validateOrganizationName(name);
  const initial = group?.name ?? '';
  function close() { onClose(); setName(initial); setTouched(false); }
  return (
    <ModalDialog
      open={group !== null}
      onClose={close}
      title="重命名群组"
      footer={
        <>
          <DialogButton onClick={close}>取消</DialogButton>
          <DialogButton
            variant="primary"
            disabled={!validation.ok || validation.value === initial || busy}
            onClick={() => { setTouched(true); if (validation.ok) onSubmit(validation.value); }}
          >
            {busy ? '正在保存…' : '保存'}
          </DialogButton>
        </>
      }
    >
      <NameField
        label="群组名称"
        value={name}
        onChange={(value) => { setName(value); setTouched(true); }}
        placeholder="输入新的群组名称"
        autoFocus
        invalidReason={touched && !validation.ok ? validation.reason : undefined}
      />
    </ModalDialog>
  );
}
