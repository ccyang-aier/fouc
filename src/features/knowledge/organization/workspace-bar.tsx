'use client';

/**
 * Workspace bar of the organization panel (O02): the switcher over the user's
 * real workspace memberships (personal / team, with own role) and the creation
 * dialog. Switching re-scopes every directory section below it.
 */

import { useState } from 'react';
import { CaretDown, Check, Plus, User, UsersThree } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { validateOrganizationName } from './client';
import type { WorkspaceWithRole } from './client';
import { useCreateWorkspaceMutation } from './hooks';
import { DialogButton, KindBadge, ModalDialog, NameField, RoleBadge, mutationErrorText } from './ui';

export function WorkspaceSwitcher({ workspaces, activeId, onSelect, onCreate }: {
  workspaces: readonly WorkspaceWithRole[];
  activeId: string | null;
  onSelect: (workspaceId: string) => void;
  onCreate: () => void;
}) {
  const active = workspaces.find((workspace) => workspace.id === activeId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="切换工作区"
          className="flex h-8 min-w-[220px] max-w-[340px] items-center gap-2 rounded-[6px] border border-[var(--line)] bg-panel px-2.5 outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {active ? (
            <>
              {active.kind === 'team' ? <UsersThree className="size-3.5 shrink-0 text-[var(--accent-ink)]" weight="bold" /> : <User className="size-3.5 shrink-0 text-[var(--muted-strong)]" weight="bold" />}
              <span className="min-w-0 flex-1 truncate text-left text-[11.5px] font-medium text-[var(--ink)]">{active.name}</span>
              <KindBadge kind={active.kind} />
            </>
          ) : (
            <span className="flex-1 text-left text-[11.5px] text-[var(--muted)]">选择工作区</span>
          )}
          <CaretDown className="size-3 shrink-0 text-[var(--muted)]" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        <DropdownMenuLabel>我的工作区</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} onSelect={() => onSelect(workspace.id)} className="h-9 gap-2">
            {workspace.kind === 'team' ? <UsersThree className="size-3.5 shrink-0" weight="bold" /> : <User className="size-3.5 shrink-0" weight="bold" />}
            <span className="min-w-0 flex-1 truncate text-[11.5px]">{workspace.name}</span>
            <KindBadge kind={workspace.kind} />
            <RoleBadge role={workspace.role} />
            {workspace.id === activeId ? <Check className="size-3.5 shrink-0 text-[var(--accent-ink)]" weight="bold" /> : <span className="w-3.5" aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate} className="gap-2 text-[var(--accent-ink)]">
          <Plus className="size-3.5 shrink-0" weight="bold" />
          新建工作区
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const kindOptions = [
  { kind: 'personal' as const, icon: User, title: '个人工作区', hint: '只属于自己的知识空间，之后仍可邀请成员转为团队' },
  { kind: 'team' as const, icon: UsersThree, title: '团队工作区', hint: '为多人协作准备，创建后即可管理成员与群组' },
];

export function CreateWorkspaceDialog({ open, onClose, onCreated, notify }: {
  open: boolean;
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'personal' | 'team'>('team');
  const [touched, setTouched] = useState(false);
  const createMutation = useCreateWorkspaceMutation();
  const validation = validateOrganizationName(name);

  function reset() {
    setName('');
    setKind('team');
    setTouched(false);
  }

  function close() {
    onClose();
    reset();
  }

  async function submit() {
    setTouched(true);
    if (!validation.ok) return;
    try {
      const created = await createMutation.mutateAsync({ name: validation.value, kind });
      notify('success', `工作区「${created.name}」已创建`);
      onCreated(created.id);
      close();
    } catch (error) {
      notify('error', mutationErrorText('创建工作区', error));
    }
  }

  return (
    <ModalDialog
      open={open}
      onClose={close}
      title="新建工作区"
      description="工作区是知识库组织的顶层边界：成员、群组与团队空间都归属于某个工作区。"
      footer={
        <>
          <DialogButton onClick={close}>取消</DialogButton>
          <DialogButton variant="primary" disabled={!validation.ok || createMutation.isPending} onClick={() => void submit()}>
            {createMutation.isPending ? '正在创建…' : '创建工作区'}
          </DialogButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <NameField
          label="名称"
          value={name}
          onChange={(value) => { setName(value); setTouched(true); }}
          onSubmit={() => void submit()}
          placeholder="例如：产品团队"
          autoFocus
          invalidReason={touched && !validation.ok ? validation.reason : undefined}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-[var(--muted-strong)]">类型</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="工作区类型">
            {kindOptions.map((option) => {
              const selected = kind === option.kind;
              const Icon = option.icon;
              return (
                <button
                  key={option.kind}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setKind(option.kind)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-[8px] border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                    selected ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-panel hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--ink)]">
                    <Icon className={cn('size-3.5', selected ? 'text-[var(--accent-ink)]' : 'text-[var(--muted-strong)]')} weight="bold" />
                    {option.title}
                  </span>
                  <span className="text-[10px] leading-relaxed text-[var(--muted)]">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
