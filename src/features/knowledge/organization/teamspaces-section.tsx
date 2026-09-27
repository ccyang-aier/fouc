'use client';

/**
 * Teamspace management (O02): create / rename / delete teamspaces and edit the
 * root default access (`view/comment/edit/full` or null). Changing the default
 * on an existing teamspace first shows the P02 rebuild notice and requires an
 * explicit confirmation: existing grants fail immediately and a rebuild
 * restores access under the new default.
 */

import { useKnowledgeBasesQuery, flattenWorkspaceList } from '../data/workspace-queries';
import type { KnowledgeBase } from '@fouc/shared/knowledge/contracts';
import { useState } from 'react';
import { FolderOpen, PencilSimple, ShieldCheck, Trash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { validateOrganizationName } from '@/features/workspaces/organization-client';
import type { MemberRole, TeamspaceAccess } from '@/features/workspaces/organization-client';
import { useCreateTeamspaceMutation, useRemoveTeamspaceMutation, useTeamspacesQuery, useUpdateTeamspaceMutation } from './hooks';
import type { TeamspaceRow } from './list-mutations';
import { canManageOrganization, defaultAccessOptions, defaultAccessRebuildNotice, needsAccessRebuildConfirmation } from './view-model';
import { AccessBadge, ConfirmDialog, DialogButton, ListStateShell, LoadMoreButton, ModalDialog, NameField, SectionHeader, flattenPages, mutationErrorText, queryListState } from './ui';

export function TeamspacesSection({ workspaceId, actorRole, notify }: {
  workspaceId: string;
  actorRole: MemberRole;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const basesQuery = useKnowledgeBasesQuery(workspaceId);
  const bases = flattenWorkspaceList(basesQuery.data);
  const canManage = canManageOrganization(actorRole);
  const teamspacesQuery = useTeamspacesQuery(workspaceId);
  const createMutation = useCreateTeamspaceMutation(workspaceId);
  const updateMutation = useUpdateTeamspaceMutation(workspaceId);
  const removeMutation = useRemoveTeamspaceMutation(workspaceId);
  const [creating, setCreating] = useState(false);
  const [accessTarget, setAccessTarget] = useState<TeamspaceRow | null>(null);
  const [renaming, setRenaming] = useState<TeamspaceRow | null>(null);
  const [deleting, setDeleting] = useState<TeamspaceRow | null>(null);
  const teamspaces = flattenPages<TeamspaceRow>(teamspacesQuery.data);

  async function applyAccess(target: TeamspaceRow, access: TeamspaceAccess) {
    try {
      await updateMutation.mutateAsync({ id: target.id, patch: { defaultAccess: access } });
      notify('success', `「${target.name}」的根默认权限已更新，正在重算页面授权`);
      setAccessTarget(null);
    } catch (error) {
      notify('error', mutationErrorText('修改根默认权限', error));
    }
  }

  async function rename(target: TeamspaceRow, name: string) {
    try {
      await updateMutation.mutateAsync({ id: target.id, patch: { name } });
      notify('success', '团队空间已重命名');
      setRenaming(null);
    } catch (error) {
      notify('error', mutationErrorText('重命名团队空间', error));
    }
  }

  async function remove() {
    const target = deleting;
    if (!target) return;
    try {
      await removeMutation.mutateAsync(target.id);
      notify('success', `团队空间「${target.name}」已删除`);
      setDeleting(null);
    } catch (error) {
      notify('error', mutationErrorText('删除团队空间', error));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="团队空间"
        hint="页面树的顶层容器；根默认权限决定工作区成员对其页面的默认访问级别。"
        action={canManage ? (
          <DialogButton variant="primary" onClick={() => setCreating(true)}>新建团队空间</DialogButton>
        ) : undefined}
      />
      <ListStateShell
        state={queryListState(teamspacesQuery)}
        error={teamspacesQuery.error}
        onRetry={() => void teamspacesQuery.refetch()}
        emptyIcon={<FolderOpen className="size-6" aria-hidden />}
        emptyTitle="还没有团队空间"
        emptyHint="团队空间是页面的顶层容器；根默认权限决定工作区成员对其中页面的默认访问级别。"
        emptyAction={canManage ? (
          <DialogButton variant="primary" onClick={() => setCreating(true)}>新建团队空间</DialogButton>
        ) : undefined}
      >
        <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-panel">
          {teamspaces.map((teamspace) => (
            <div key={teamspace.id} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--surface-subtle)]">
              <FolderOpen className="size-4 shrink-0 text-[var(--muted-strong)]" weight="bold" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{teamspace.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                  根默认权限
                  <AccessBadge access={teamspace.defaultAccess} />
                </span>
              </div>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAccessTarget(teamspace)}
                    className="flex h-[26px] items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-panel px-2 text-[10.5px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <ShieldCheck className="size-3.5" weight="bold" />
                    默认权限
                  </button>
                  <RowIconAction label={`重命名团队空间「${teamspace.name}」`} title="重命名" onClick={() => setRenaming(teamspace)}><PencilSimple className="size-[14px]" /></RowIconAction>
                  <RowIconAction label={`删除团队空间「${teamspace.name}」`} title="删除" danger onClick={() => setDeleting(teamspace)}><Trash className="size-[14px]" /></RowIconAction>
                </div>
              ) : null}
            </div>
          ))}
          <LoadMoreButton
            visible={teamspacesQuery.hasNextPage}
            loading={teamspacesQuery.isFetchingNextPage}
            onClick={() => void teamspacesQuery.fetchNextPage()}
          />
        </div>
      </ListStateShell>

      <CreateTeamspaceDialog
        bases={bases}
        open={creating}
        busy={createMutation.isPending}
        onClose={() => setCreating(false)}
        onSubmit={async (name, defaultAccess, knowledgeBaseId) => {
          try {
            const created = await createMutation.mutateAsync({ name, defaultAccess, knowledgeBaseId });
            notify('success', `团队空间「${created.name}」已创建`);
            setCreating(false);
          } catch (error) {
            notify('error', mutationErrorText('创建团队空间', error));
          }
        }}
      />
      <AccessDialog
        key={accessTarget?.id ?? 'none'}
        teamspace={accessTarget}
        busy={updateMutation.isPending}
        onClose={() => setAccessTarget(null)}
        onConfirm={(access) => accessTarget && void applyAccess(accessTarget, access)}
      />
      <RenameTeamspaceDialog
        key={renaming?.id ?? 'none'}
        teamspace={renaming}
        busy={updateMutation.isPending}
        onClose={() => setRenaming(null)}
        onSubmit={(name) => renaming && void rename(renaming, name)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        busy={removeMutation.isPending}
        title="删除团队空间"
        confirmLabel="删除"
        body={deleting ? (
          <>
            确定删除团队空间 <strong className="font-semibold text-[var(--ink)]">{deleting.name}</strong>？
            只有完全不含页面（包括回收站页面）的团队空间可以删除；删除后不可恢复。
          </>
        ) : null}
      />
    </div>
  );
}

function RowIconAction({ label, title, onClick, danger, children }: { label: string; title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
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

/** Radio list of the four levels plus "explicit only" (null). */
function AccessOptions({ value, onChange, disabled }: { value: TeamspaceAccess; onChange: (value: TeamspaceAccess) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="根默认权限">
      {defaultAccessOptions.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-start gap-2.5 rounded-[8px] border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-45',
              selected ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-panel hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]',
            )}
          >
            <span aria-hidden className={cn('mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-full border', selected ? 'border-[var(--accent)]' : 'border-[var(--line-strong)]')}>
              {selected ? <span className="size-1.5 rounded-full bg-[var(--accent)]" /> : null}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-[11.5px] font-medium', selected ? 'text-[var(--accent-ink)]' : 'text-[var(--ink)]')}>{option.label}</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--muted)]">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CreateTeamspaceDialog({ bases, open, busy, onClose, onSubmit }: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  bases: KnowledgeBase[];
  onSubmit: (name: string, defaultAccess: TeamspaceAccess, knowledgeBaseId: string) => void;
}) {
  const [name, setName] = useState('');
  const [access, setAccess] = useState<TeamspaceAccess>(null);
  const [chosenBaseId, setChosenBaseId] = useState('');
  const baseId = bases.find((base) => base.id === chosenBaseId)?.id ?? bases[0]?.id;
  const [touched, setTouched] = useState(false);
  const validation = validateOrganizationName(name);
  function close() { onClose(); setName(''); setAccess(null); setTouched(false); }
  function submit() {
    setTouched(true);
    if (validation.ok && baseId) onSubmit(validation.value, access, baseId);
  }
  return (
    <ModalDialog
      open={open}
      onClose={close}
      title="新建团队空间"
      description="创建后可以在其中建立页面树；根默认权限之后仍可调整。"
      width="w-[480px]"
      footer={
        <>
          <DialogButton onClick={close}>取消</DialogButton>
          <DialogButton variant="primary" disabled={!validation.ok || !baseId || busy} onClick={submit}>{busy ? '正在创建…' : '创建'}</DialogButton>
        </>
      }
    >
      <div className="flex flex-col gap-4"><label className="text-xs">所属知识库<select aria-label="所属知识库" value={baseId ?? ''} onChange={(event) => setChosenBaseId(event.target.value)} className="mt-2 block w-full rounded-md border border-[var(--line)] bg-panel p-2">{!bases.length ? <option value="">请先创建知识库</option> : bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</select></label>
        <NameField
          label="名称"
          value={name}
          onChange={(value) => { setName(value); setTouched(true); }}
          onSubmit={submit}
          placeholder="例如：产品文档"
          autoFocus
          invalidReason={touched && !validation.ok ? validation.reason : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-[var(--muted-strong)]">根默认权限</span>
          <AccessOptions value={access} onChange={setAccess} />
        </div>
      </div>
    </ModalDialog>
  );
}

function AccessDialog({ teamspace, busy, onClose, onConfirm }: {
  teamspace: TeamspaceRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (access: TeamspaceAccess) => void;
}) {
  const [access, setAccess] = useState<TeamspaceAccess>(teamspace?.defaultAccess ?? null);
  const current = teamspace?.defaultAccess ?? null;
  const changed = teamspace !== null && needsAccessRebuildConfirmation(current, access);
  return (
    <ModalDialog
      open={teamspace !== null}
      onClose={onClose}
      title="根默认权限"
      description={teamspace ? `「${teamspace.name}」内所有根页面将按此级别向工作区成员开放。` : undefined}
      width="w-[480px]"
      footer={
        <>
          <DialogButton onClick={onClose}>取消</DialogButton>
          <DialogButton variant="primary" disabled={!changed || busy} onClick={() => onConfirm(access)}>
            {busy ? '正在应用…' : '确认变更'}
          </DialogButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <AccessOptions value={access} onChange={setAccess} disabled={busy} />
        {changed ? (
          <p className="flex gap-2 rounded-[8px] border border-[var(--warn-soft-line)] bg-[var(--warn-soft)] px-3 py-2.5 text-[10.5px] leading-relaxed text-[var(--warn-ink)]">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" weight="bold" />
            {defaultAccessRebuildNotice}
          </p>
        ) : (
          <p className="text-[10.5px] text-[var(--muted)]">调整后选择“确认变更”生效；当前值与服务器一致时不产生写请求。</p>
        )}
      </div>
    </ModalDialog>
  );
}

function RenameTeamspaceDialog({ teamspace, busy, onClose, onSubmit }: {
  teamspace: TeamspaceRow | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(teamspace?.name ?? '');
  const [touched, setTouched] = useState(false);
  const validation = validateOrganizationName(name);
  const initial = teamspace?.name ?? '';
  function close() { onClose(); setName(initial); setTouched(false); }
  return (
    <ModalDialog
      open={teamspace !== null}
      onClose={close}
      title="重命名团队空间"
      footer={
        <>
          <DialogButton onClick={close}>取消</DialogButton>
          <DialogButton variant="primary" disabled={!validation.ok || validation.value === initial || busy} onClick={() => { setTouched(true); if (validation.ok) onSubmit(validation.value); }}>
            {busy ? '正在保存…' : '保存'}
          </DialogButton>
        </>
      }
    >
      <NameField
        label="名称"
        value={name}
        onChange={(value) => { setName(value); setTouched(true); }}
        placeholder="输入新的名称"
        autoFocus
        invalidReason={touched && !validation.ok ? validation.reason : undefined}
      />
    </ModalDialog>
  );
}
