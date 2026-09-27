'use client';

/**
 * Organization panel (O02): the Workspace / members / groups / teamspace
 * management surface. Mount point for future knowledge-app wiring (U02+):
 * `import { OrganizationPanel } from '@/features/knowledge/organization'`.
 *
 * The panel owns the workspace scope: the switcher re-scopes every directory
 * section below it, and the actor's role in the active workspace decides which
 * management controls render at all.
 */

import { useState } from 'react';
import { FolderOpen } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { WorkspaceWithRole } from '@/features/workspaces/organization-client';
import { GroupsSection } from './groups-section';
import { OrganizationQueryProvider, useWorkspacesQuery } from './hooks';
import { MembersSection } from './members-section';
import { TeamspacesSection } from './teamspaces-section';
import { DialogButton, ListStateShell, RoleBadge, ToastRegion, flattenPages, queryListState, useOrganizationToast } from './ui';
import { CreateWorkspaceDialog, WorkspaceSwitcher } from './workspace-bar';

type SectionId = 'members' | 'groups' | 'teamspaces';

const sections: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'members', label: '成员' },
  { id: 'groups', label: '群组' },
  { id: 'teamspaces', label: '团队空间' },
];

export function OrganizationPanel() {
  return (
    <OrganizationQueryProvider>
      <OrganizationPanelBody />
    </OrganizationQueryProvider>
  );
}

function OrganizationPanelBody() {
  const workspacesQuery = useWorkspacesQuery();
  const workspaces = flattenPages<WorkspaceWithRole>(workspacesQuery.data);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('members');
  const [creating, setCreating] = useState(false);
  const { toast, notify } = useOrganizationToast();

  const activeWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0] ?? null;
  const workspacesState = queryListState(workspacesQuery);

  return (
    <section aria-label="组织管理" className="relative flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      <header className="flex h-[42px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-[18px]">
        <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <span>知识库</span>
          <span aria-hidden className="text-[var(--line-strong)]">/</span>
          <strong className="truncate font-medium text-[var(--muted-strong)]">组织管理</strong>
        </nav>
        {activeWorkspace ? (
          <span className="flex h-7 shrink-0 items-center gap-1.5 text-[10px] text-[var(--muted-strong)]">
            我的角色
            <RoleBadge role={activeWorkspace.role} />
          </span>
        ) : null}
      </header>

      {workspacesState === 'ready' && activeWorkspace ? (
        <>
          <div className="flex h-[46px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-[18px]">
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeId={activeWorkspace.id}
              onSelect={setSelectedWorkspaceId}
              onCreate={() => setCreating(true)}
            />
            <nav aria-label="组织分区" className="flex h-full items-center gap-1">
              {sections.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setSection(item.id)}
                    className={cn(
                      'relative h-full px-3 text-[11.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]',
                      active ? 'text-[var(--ink)]' : 'text-[var(--muted-strong)] hover:text-[var(--ink)]',
                    )}
                  >
                    {item.label}
                    <span aria-hidden className={cn('absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-colors', active ? 'bg-[var(--accent)]' : 'bg-transparent')} />
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="mx-auto flex h-full w-full max-w-[900px] flex-col overflow-y-auto px-6 py-5">
              {section === 'members' ? (
                <MembersSection workspaceId={activeWorkspace.id} actorRole={activeWorkspace.role} notify={notify} />
              ) : section === 'groups' ? (
                <GroupsSection workspaceId={activeWorkspace.id} actorRole={activeWorkspace.role} notify={notify} />
              ) : (
                <TeamspacesSection workspaceId={activeWorkspace.id} actorRole={activeWorkspace.role} notify={notify} />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[900px] px-6 py-5">
            <ListStateShell
              state={workspacesState}
              error={workspacesQuery.error}
              onRetry={() => void workspacesQuery.refetch()}
              emptyIcon={<FolderOpen className="size-6" aria-hidden />}
              emptyTitle="还没有工作区"
              emptyHint="创建第一个工作区后，即可管理成员、群组与团队空间。"
              emptyAction={<DialogButton variant="primary" onClick={() => setCreating(true)}>新建工作区</DialogButton>}
            >
              {null}
            </ListStateShell>
          </div>
        </div>
      )}

      <CreateWorkspaceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(workspaceId) => {
          setSelectedWorkspaceId(workspaceId);
          setSection('members');
        }}
        notify={notify}
      />
      <ToastRegion toast={toast} />
    </section>
  );
}
