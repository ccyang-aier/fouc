'use client';

/** Identity controls resource access, never the selected knowledge resource. */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FolderPlus, LockSimple, XCircle } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';

import { useIdentity } from '@/features/identity/identity-provider';
import dynamic from 'next/dynamic';
import { authErrorCopyFor } from '../identity/auth-errors';

import { connectKnowledgeWorkspaceEvents, type KnowledgeWorkspaceEvents } from './collaboration/workspace-events';
import { CanvasError, CanvasSpinner, CanvasState } from './canvas-states';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { useKnowledgeAccessQuery } from './data/hooks';
import { knowledgeKeysForSegments, knowledgeWorkspaceRootKey } from './data/invalidation';
import { KnowledgeQueryProvider } from './data/provider';
import { invalidateKnowledgeQueries } from './data/query-client';
import { flattenWorkspaceList, useKnowledgeBasesQuery, useKnowledgeTeamspacesQuery } from './data/workspace-queries';
import { deriveKnowledgeEntryPhase, entryPhaseShowsStage, knowledgeErrorCodeOf } from './entry-state';
import { useKnowledgeNotificationsBridge } from './notifications/notifications-queries';
import { subscribeOpenPageTarget } from './editor/open-target';
import type { TreeStageTeamspaceState } from './navigation/tree-stage';
import { KnowledgeTreeStage } from './navigation/tree-stage';
import { CreateTeamspaceDialog } from './navigation/create-teamspace-dialog';
import { PageTreeSidebar } from './navigation/page-tree-sidebar';
import { organizationErrorTextOf } from '@/features/workspaces/organization-errors';
import { ToastRegion, useOrganizationToast } from './organization/ui';
import { CreateKnowledgeBaseDialog } from './organization/create-knowledge-base-dialog';
import { LibraryCanvas } from './navigation/library-canvas';
import type { LibraryView } from './navigation/tree-stage';
import { KnowledgePageEditor } from './editor';
import { KnowledgeWorkbench } from './knowledge-workbench';
import { createBrowserKnowledgeResourceSelection } from './resource-selection';
import { useKnowledgeBaseSelection } from './use-knowledge-base-selection';
import { useWorkspace } from '@/features/workspaces/workspace-provider';
import { CreateDocumentDialog, type DocumentCreation } from './navigation/create-document-dialog';
import { NavigationDialogPortal } from './navigation/navigation-dialog-portal';
import { usePageTreeOperations } from './navigation/page-operations';
import { canEditTree } from './navigation/tree-actions';
import { useCreateTeamspaceMutation } from './organization/hooks';

const LocalKnowledgeResource = dynamic(() => import('./local/local-knowledge-resource').then((module) => module.LocalKnowledgeResource), { ssr: false, loading: () => <CanvasSpinner label="正在加载知识资源" /> });

export function KnowledgePage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { session } = useIdentity();
  const { activeSpace } = useWorkspace();
  const [selection] = useState(() => createBrowserKnowledgeResourceSelection(activeSpace.id, activeSpace.kind === 'server' ? 'workspace' : 'local'));
  const resource = useSyncExternalStore(selection.subscribe, selection.getSnapshot, selection.getServerSnapshot);
  if (!resource) return <CanvasSpinner label="正在加载知识资源" />;
  if (resource === 'local' && activeSpace.kind === 'local') return <LocalKnowledgeResource workspaceId={activeSpace.id} onOpenSettings={onOpenSettings} onOpenWorkspace={() => selection.select('workspace')} />;
  // Private query caches must never survive account changes. Device content is never implicitly uploaded.
  return <KnowledgeQueryProvider key={`${activeSpace.id}:${session.status === 'authenticated' ? session.user.id : 'unauthenticated'}`}><WorkspaceKnowledgeResource localSelected={resource === 'local'} onOpenSettings={onOpenSettings} onOpenLocal={() => selection.select('local')} onOpenWorkspace={() => selection.select('workspace')} /></KnowledgeQueryProvider>;
}

function WorkspaceKnowledgeResource({ onOpenSettings, onOpenLocal, onOpenWorkspace, localSelected }: { onOpenSettings: () => void; onOpenLocal: () => void; onOpenWorkspace: () => void; localSelected: boolean }) {
  // The U01 QueryClient shared by every query below and by the B06 event
  // subscription's invalidations.
  const queryClient = useQueryClient();

  const { session, refresh, expireSession, openSignIn } = useIdentity();
  const retrySession = () => { void refresh(); };

  // ── Workspace scope ─────────────────────────────────────────────
  const authenticated = session.status === 'authenticated';
  const { activeSpace, serverDirectory, refreshWorkspaces } = useWorkspace();
  const workspaces = authenticated ? serverDirectory.items : [];
  const activeWorkspace = activeSpace.kind === 'server' ? workspaces.find((workspace) => workspace.id === activeSpace.id) ?? null : null;
  const activeId = activeWorkspace?.id ?? null;

  const accessQuery = useKnowledgeAccessQuery(activeId ?? '', { enabled: activeId !== null });
  const basesQuery = useKnowledgeBasesQuery(localSelected ? null : activeId);
  const knowledgeBases = flattenWorkspaceList(basesQuery.data);
  const [chosenBaseId, setChosenBaseId] = useKnowledgeBaseSelection(`${activeSpace.id}:${authenticated ? session.user.id : 'anonymous'}:server`);
  const activeBase = knowledgeBases.find((base) => base.id === chosenBaseId) ?? knowledgeBases[0] ?? null;
  const teamspacesQuery = useKnowledgeTeamspacesQuery(localSelected ? null : activeId, activeBase?.id ?? null);
  const teamspaces = flattenWorkspaceList(teamspacesQuery.data);

  const phase = deriveKnowledgeEntryPhase({
    session:
      session.status === 'checking' || session.status === 'anonymous' || session.status === 'error'
        ? { status: session.status }
        : { status: 'authenticated' },
    workspaces: authenticated
      ? {
          status: serverDirectory.status,
          errorCode: knowledgeErrorCodeOf(serverDirectory.error),
          count: workspaces.length,
        }
      : null,
    access: activeId
      ? { status: accessQuery.status, errorCode: accessQuery.error === null ? null : knowledgeErrorCodeOf(accessQuery.error) }
      : null,
    teamspaces: activeId && accessQuery.isSuccess
      ? {
          status: teamspacesQuery.status,
          errorCode: teamspacesQuery.error === null ? null : knowledgeErrorCodeOf(teamspacesQuery.error),
          count: teamspaces.length,
        }
      : null,
  });

  // An authenticated surface that turns UNAUTHENTICATED means the session
  // expired under us: revoke private access without changing the chosen resource.
  useEffect(() => {
    if (phase === 'auth-required' && session.status === 'authenticated') expireSession();
  }, [phase, session.status, expireSession]);

  // ── B06: live workspace events → U01 cache invalidation ────────
  const stageActive = !localSelected && entryPhaseShowsStage(phase) && activeId !== null;
  const eventsWorkspaceId = stageActive ? activeId : null;
  useEffect(() => {
    if (!eventsWorkspaceId) return undefined;
    const controller = new AbortController();
    let connection: KnowledgeWorkspaceEvents | undefined;
    void getFoucApiOrigin()
      .then(({ origin }) => {
        if (controller.signal.aborted) return;
        connection = connectKnowledgeWorkspaceEvents({
          workspaceId: eventsWorkspaceId,
          origin,
          signal: controller.signal,
          invalidate: (segments) => {
            for (const key of knowledgeKeysForSegments(eventsWorkspaceId, segments)) {
              void invalidateKnowledgeQueries(queryClient, key);
            }
          },
          invalidateAll: () => {
            void invalidateKnowledgeQueries(queryClient, knowledgeWorkspaceRootKey(eventsWorkspaceId));
          },
        });
      })
      .catch(() => undefined); // Endpoint failures surface through the queries themselves.
    return () => {
      controller.abort();
      connection?.close();
    };
  }, [eventsWorkspaceId, queryClient]);

  // ── Tree selection and creation dialogs ─────────────────────────
  // The whole resource adapter remounts on global workspace changes, resetting
  // editor, folder and filter state and disposing the old event subscription.
  const [libraryView, setLibraryView] = useState<LibraryView>('all-documents');
  const [selectedTeamspaceId, setSelectedTeamspaceId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // ── N03: publish the live inbox (unread badge, rows, jump) to the shell bell ──
  useKnowledgeNotificationsBridge({ active: stageActive, workspaceId: activeId, openPage: setSelectedPageId });

  // ── L02: block-reference cards ask the shell to open their source page ──
  // (the highlight itself rides the staged one-shot channel the editor consumes).
  useEffect(() => {
    if (!stageActive) return undefined;
    return subscribeOpenPageTarget((target) => {
      if (target.workspaceId === activeId) setSelectedPageId(target.pageId);
    });
  }, [stageActive, activeId]);

  const selectedTeamspace = teamspaces.find((teamspace) => teamspace.id === selectedTeamspaceId) ?? null;

  const [createKnowledgeBaseOpen, setCreateKnowledgeBaseOpen] = useState(false);
  const [createTeamspaceOpen, setCreateTeamspaceOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(false);
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const { toast, notify } = useOrganizationToast();
  const pageOperations = usePageTreeOperations(activeId, { canEdit: canEditTree(accessQuery.data), notify });
  const createTeamspace = useCreateTeamspaceMutation(activeId ?? '');

  async function createDocument(input: DocumentCreation): Promise<string | null> {
    if (!activeBase || !activeId) return null;
    try {
      const teamspaceId = input.teamspaceId || (await createTeamspace.mutateAsync({ knowledgeBaseId: activeBase.id, name: '文档', defaultAccess: 'edit' })).id;
      const id = await pageOperations.createPage({ ...input, teamspaceId });
      if (id) { setSelectedPageId(id); setCreateDocumentOpen(false); }
      return id;
    } catch { notify('error', '创建文档失败，请重试'); return null; }
  }

  const retryTeamspaces = () => void teamspacesQuery.refetch();

  const treeTeamspaceState: TreeStageTeamspaceState =
    phase === 'tree-loading'
      ? 'loading'
      : phase === 'tree-error'
        ? 'error'
        : phase === 'tree-forbidden'
          ? 'forbidden'
          : teamspaces.length === 0
            ? 'empty'
            : 'ready';

  const treeArea = (
    <KnowledgeTreeStage knowledgeBaseId={activeBase?.id ?? ''}
      key={`${activeId}:${activeBase?.id}:${session.status === 'authenticated' ? session.user.id : ''}`}
      userId={session.status === 'authenticated' ? session.user.id : ''}
      view={libraryView}
      onNavigate={(view) => { setLibraryView(view); setSelectedPageId(null); }}
      workspaceId={activeId}
      teamspaces={teamspaces}
      teamspaceState={treeTeamspaceState}
      access={accessQuery.data}
      selectedSectionId={selectedTeamspaceId}
      selectedPageId={selectedPageId}
      onSelectSection={(id) => { setSelectedTeamspaceId(id); setSelectedPageId(null); setLibraryView('overview'); }}
      onSelectPage={setSelectedPageId}
      onRetryTeamspaces={retryTeamspaces}
      onCreateTeamspace={() => setCreateTeamspaceOpen(true)}
      notify={notify}
    />
  );

  // Device copies inside a server workspace still require that workspace's
  // membership. Switching source must not bypass its authorization boundary.
  if (localSelected && authenticated && activeWorkspace && accessQuery.isSuccess) {
    return <LocalKnowledgeResource workspaceId={activeWorkspace.id} onOpenSettings={onOpenSettings} onOpenWorkspace={onOpenWorkspace} />;
  }

  return (
    <KnowledgeWorkbench
      documentOpen={Boolean(selectedPageId)}
      sidebarOpen={Boolean(selectedPageId) && editorSidebarOpen}
      onCloseSidebar={() => setEditorSidebarOpen(false)}
      sidebar={<PageTreeSidebar
        collapsed={selectedPageId ? false : sidebarCollapsed}
        onCollapse={() => selectedPageId ? setEditorSidebarOpen(false) : setSidebarCollapsed(true)}
        onOpenSettings={onOpenSettings}
        onOpenLocal={onOpenLocal}
        knowledgeBases={knowledgeBases}
        activeKnowledgeBaseId={activeBase?.id ?? null}
        onSelectKnowledgeBase={(id) => { setChosenBaseId(id); setSelectedTeamspaceId(null); setSelectedPageId(null); setLibraryView('all-documents'); }}
        onCreateKnowledgeBase={authenticated ? () => setCreateKnowledgeBaseOpen(true) : openSignIn}
        createLabel="新建知识库"
        treeArea={stageActive ? treeArea : null}
      />}
      onExpandSidebar={sidebarCollapsed ? () => setSidebarCollapsed(false) : undefined}
      overlays={<>
        {createDocumentOpen && activeBase ? <NavigationDialogPortal><CreateDocumentDialog teamspaces={teamspaces} target={{ teamspaceId: selectedTeamspaceId ?? undefined, parentId: null }} onClose={() => setCreateDocumentOpen(false)} onCreate={createDocument} /></NavigationDialogPortal> : null}
        {activeId ? <CreateKnowledgeBaseDialog workspaceId={activeId} open={createKnowledgeBaseOpen} onClose={() => setCreateKnowledgeBaseOpen(false)} onCreated={(id) => { setChosenBaseId(id); setSelectedTeamspaceId(null); setSelectedPageId(null); setLibraryView('all-documents'); notify('success', '知识库已创建'); }} /> : null}
        {activeWorkspace && activeBase ? <CreateTeamspaceDialog knowledgeBaseId={activeBase.id} workspaceId={activeWorkspace.id} open={createTeamspaceOpen} onClose={() => setCreateTeamspaceOpen(false)} onCreated={(teamspace) => { setSelectedTeamspaceId(teamspace.id); setSelectedPageId(null); setLibraryView('overview'); }} /> : null}
        <ToastRegion toast={toast} />
      </>}
    >
      {phase === 'session-checking' ? (
        <CanvasSpinner label="正在确认登录状态" />
      ) : phase === 'session-error' ? (
        <SessionErrorState
          description={authErrorCopyFor(session.status === 'error' ? session.error : null).description}
          onRetry={retrySession}
          onSignIn={openSignIn}
        />
      ) : phase === 'auth-required' ? (
        <CanvasState icon={<LockSimple aria-hidden className="size-5" />} title="此知识资源需要登录" hint="登录后继续访问当前选择的资源。你也可以通过知识库菜单选择本机文档。" actions={<Button onClick={openSignIn}>登录并继续</Button>} />
      ) : phase === 'workspaces-loading' ? (
        <CanvasSpinner label="正在加载知识库" />
      ) : phase === 'workspaces-error' ? (
        <CanvasError
          title="知识库列表加载失败"
          detail={organizationErrorTextOf(serverDirectory.error)}
          onRetry={refreshWorkspaces}
        />
      ) : authenticated && serverDirectory.status === 'success' && activeSpace.kind === 'server' && !activeWorkspace ? (
        <CanvasState icon={<LockSimple aria-hidden className="size-5" />} title="无法访问当前工作空间" hint="当前账户不是此空间的成员，或空间已被移除。请选择有访问权限的工作空间。" />
      ) : authenticated && serverDirectory.status === 'success' && activeSpace.kind === 'local' && workspaces.length > 0 ? (
        <CanvasState icon={<FolderPlus aria-hidden className="size-5" />} title="当前工作空间没有服务端知识资源" hint="本机工作空间不会自动关联其它空间的数据。请从最左侧选择服务端工作空间，或继续使用此空间的本机文档。" actions={<Button variant="outline" onClick={onOpenLocal}>返回本机文档</Button>} />
      ) : phase === 'workspaces-empty' ? (
        <CanvasState
          tone="accent"
          icon={<FolderPlus aria-hidden className="size-5" weight="regular" />}
          title="还没有服务端工作空间"
          hint="从最左侧创建或选择工作空间，或继续使用当前空间的本机文档。"
          announce="polite"
          actions={<Button variant="outline" onClick={onOpenLocal}>返回本机文档</Button>}
        />
      ) : localSelected && accessQuery.isPending ? (
        <CanvasSpinner label="正在确认工作空间权限" />
      ) : localSelected && accessQuery.isError ? (
        <CanvasError title="无法访问当前工作空间" detail="无法确认此空间的资源访问权限，请重试或选择其它工作空间。" onRetry={() => void accessQuery.refetch()} />
      ) : basesQuery.isError ? (
        <CanvasError title="知识库列表加载失败" detail={organizationErrorTextOf(basesQuery.error)} onRetry={() => void basesQuery.refetch()} />
      ) : activeWorkspace && basesQuery.isPending ? (
        <CanvasSpinner label="正在加载知识库" />
      ) : activeWorkspace && !activeBase ? (
        <CanvasState title="还没有知识库" hint="一个工作空间可以包含多个独立知识库。" actions={<Button onClick={() => setCreateKnowledgeBaseOpen(true)}>新建知识库</Button>} />
      ) : activeWorkspace && session.status === 'authenticated' ? (
        <>
          {selectedPageId && activeId ? (
            <KnowledgePageEditor
              scope={{ workspaceId: activeId, pageId: selectedPageId }}
              user={session.user}
              collectionName={activeBase?.name ?? '知识库'}
              knowledgeBaseId={activeBase?.id ?? ''}
              onBack={() => { setSelectedPageId(null); setEditorSidebarOpen(false); setLibraryView('all-documents'); }}
              onToggleSidebar={() => setEditorSidebarOpen((value) => !value)}
              onCreateDocument={() => setCreateDocumentOpen(true)}
              canCreateDocument={canEditTree(accessQuery.data)}
            />
          ) : activeId ? (
            <LibraryCanvas knowledgeBaseId={activeBase?.id ?? ''} key={`${activeId}:${activeBase?.id}`} workspaceId={activeId} userId={session.user.id} name={activeBase?.name ?? ''} view={libraryView} access={accessQuery.data} teamspaces={teamspaces} folder={selectedTeamspace} onOpenPage={setSelectedPageId} onSelectFolder={(id) => { setSelectedTeamspaceId(id); setLibraryView('overview'); }} onCreateFolder={() => setCreateTeamspaceOpen(true)} onExpandSidebar={sidebarCollapsed ? () => setSidebarCollapsed(false) : undefined} notify={notify} />
          ) : null}
        </>
      ) : null}
    </KnowledgeWorkbench>
  );
}

function SessionErrorState({ description, onRetry, onSignIn }: { description: string; onRetry: () => void; onSignIn: () => void }) {
  return (
    <CanvasState
      tone="error"
      announce="assertive"
      icon={<XCircle aria-hidden className="size-5" weight="fill" />}
      title="无法确认登录状态"
      hint={description}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
          <Button variant="ghost" size="sm" onClick={onSignIn}>
            前往登录
          </Button>
        </>
      }
    />
  );
}
