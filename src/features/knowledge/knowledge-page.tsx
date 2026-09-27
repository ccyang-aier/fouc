'use client';

import { IconButton } from './dense-sidebar/icon-button';

/** Knowledge consumes the shared Fouc session. Anonymous users work locally; cloud data stays scoped to the authenticated user and resource ACL. */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FolderPlus, SidebarSimple, XCircle } from '@phosphor-icons/react';
import { motion } from 'motion/react';

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
import { flattenWorkspaceList, useKnowledgeTeamspacesQuery, useKnowledgeWorkspacesQuery } from './data/workspace-queries';
import { deriveKnowledgeEntryPhase, entryPhaseShowsStage, knowledgeErrorCodeOf } from './entry-state';
import { useKnowledgeNotificationsBridge } from './notifications/notifications-queries';
import { subscribeOpenPageTarget } from './editor/open-target';
import type { TreeStageTeamspaceState } from './navigation/tree-stage';
import { KnowledgeTreeStage } from './navigation/tree-stage';
import { CreateTeamspaceDialog } from './navigation/create-teamspace-dialog';
import { PageTreeSidebar } from './navigation/page-tree-sidebar';
import { organizationErrorTextOf } from './organization/errors';
import { organizationQueryKeys } from './organization/keys';
import { ToastRegion, useOrganizationToast } from './organization/ui';
import { CreateKnowledgeBaseDialog } from './organization/create-knowledge-base-dialog';
import { LibraryCanvas } from './navigation/library-canvas';
import type { LibraryView } from './navigation/tree-stage';
import { KnowledgePageEditor } from './editor';

const GuestKnowledge = dynamic(() => import('./guest/guest-knowledge').then((module) => module.GuestKnowledge), { ssr: false });

const ACTIVE_WORKSPACE_STORAGE_KEY = 'fouc.knowledge.activeWorkspaceId';

export function KnowledgePage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { session } = useIdentity();
  const [localMode, setLocalMode] = useState(false);
  if (session.status === 'checking') return <CanvasSpinner label="正在确认 Fouc 身份" />;
  if (session.status !== 'authenticated' || localMode) return <GuestKnowledge onOpenSettings={onOpenSettings} onOpenCloud={() => setLocalMode(false)} />;
  return <KnowledgeQueryProvider key={session.user.id}><KnowledgeWorkbench onOpenSettings={onOpenSettings} onOpenLocal={() => setLocalMode(true)} /></KnowledgeQueryProvider>;
}

function KnowledgeWorkbench({ onOpenSettings, onOpenLocal }: { onOpenSettings: () => void; onOpenLocal: () => void }) {
  // The U01 QueryClient shared by every query below and by the B06 event
  // subscription's invalidations.
  const queryClient = useQueryClient();

  const { session, refresh, expireSession, openSignIn } = useIdentity();
  const retrySession = () => { void refresh(); };

  // ── Workspace scope ─────────────────────────────────────────────
  const authenticated = session.status === 'authenticated';
  const workspacesQuery = useKnowledgeWorkspacesQuery(authenticated);
  const workspaces = flattenWorkspaceList(workspacesQuery.data);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => readStoredWorkspaceId());
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0] ?? null;
  const activeId = activeWorkspace?.id ?? null;

  useEffect(() => {
    if (activeId) writeStoredWorkspaceId(activeId);
  }, [activeId]);

  const accessQuery = useKnowledgeAccessQuery(activeId ?? '', { enabled: activeId !== null });
  const teamspacesQuery = useKnowledgeTeamspacesQuery(activeId);
  const teamspaces = flattenWorkspaceList(teamspacesQuery.data);

  const phase = deriveKnowledgeEntryPhase({
    session:
      session.status === 'checking' || session.status === 'anonymous' || session.status === 'error'
        ? { status: session.status }
        : { status: 'authenticated' },
    workspaces: authenticated
      ? {
          status: workspacesQuery.status,
          errorCode: workspacesQuery.error === null ? null : knowledgeErrorCodeOf(workspacesQuery.error),
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
  // expired under us: update the global identity and return to local capabilities.
  useEffect(() => {
    if (phase === 'auth-required' && session.status === 'authenticated') expireSession();
  }, [phase, session.status, expireSession]);

  // ── B06: live workspace events → U01 cache invalidation ────────
  const stageActive = entryPhaseShowsStage(phase) && activeId !== null;
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
  // Selection self-heals across workspace switches: teamspace ids are unique,
  // so a stale id from another workspace simply matches no row. A page click
  // also selects its teamspace (the stage resolves it), keeping the canvas in
  // sync while the tree layer owns everything page-shaped.
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

  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createTeamspaceOpen, setCreateTeamspaceOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast, notify } = useOrganizationToast();

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
    <KnowledgeTreeStage
      key={`${activeId}:${session.status === 'authenticated' ? session.user.id : ''}`}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--panel)]"
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
        <CanvasSpinner label="正在更新 Fouc 身份" />
      ) : phase === 'workspaces-loading' ? (
        <CanvasSpinner label="正在加载知识库" />
      ) : phase === 'workspaces-error' ? (
        <CanvasError
          title="知识库列表加载失败"
          detail={organizationErrorTextOf(workspacesQuery.error)}
          onRetry={() => void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.workspaces })}
        />
      ) : phase === 'workspaces-empty' ? (
        <CanvasState
          tone="accent"
          icon={<FolderPlus aria-hidden className="size-5" weight="regular" />}
          title="还没有知识库"
          hint="创建第一个知识库，开始整理文件夹和文档。"
          announce="polite"
          actions={
            <Button onClick={() => setCreateWorkspaceOpen(true)}>
              <FolderPlus aria-hidden className="size-3.5" />
              新建知识库
            </Button>
          }
        />
      ) : activeWorkspace && session.status === 'authenticated' ? (
        <div className="flex h-full min-h-0">
          <PageTreeSidebar
            collapsed={sidebarCollapsed}
            onCollapse={() => setSidebarCollapsed(true)}
            onOpenSettings={onOpenSettings}
            onOpenLocal={onOpenLocal}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspace.id}
            onSelectWorkspace={(id) => { setActiveWorkspaceId(id); setSelectedTeamspaceId(null); setSelectedPageId(null); setLibraryView('all-documents'); }}
            onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
            treeArea={treeArea}
          />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {sidebarCollapsed && (selectedPageId || libraryView !== 'all-documents') ? <IconButton label="展开知识库侧边栏" onClick={() => setSidebarCollapsed(false)} className="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-md text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><SidebarSimple size={18} /></IconButton> : null}
          {selectedPageId && activeId ? (
            <KnowledgePageEditor scope={{ workspaceId: activeId, pageId: selectedPageId }} user={session.user} />
          ) : activeId ? (
            <LibraryCanvas key={activeId} workspaceId={activeId} userId={session.user.id} name={activeWorkspace.name} view={libraryView} access={accessQuery.data} teamspaces={teamspaces} folder={selectedTeamspace} onOpenPage={setSelectedPageId} onSelectFolder={(id) => { setSelectedTeamspaceId(id); setLibraryView('overview'); }} onCreateFolder={() => setCreateTeamspaceOpen(true)} onExpandSidebar={sidebarCollapsed ? () => setSidebarCollapsed(false) : undefined} notify={notify} />
          ) : null}
          </div>
        </div>
      ) : null}

      <CreateKnowledgeBaseDialog
        open={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        onCreated={(workspaceId) => {
          setActiveWorkspaceId(workspaceId);
          setSelectedPageId(null);
          setSelectedTeamspaceId(null);
          setLibraryView('all-documents');
        }}
        notify={notify}
      />
      {activeWorkspace ? (
        <CreateTeamspaceDialog
          workspaceId={activeWorkspace.id}
          open={createTeamspaceOpen}
          onClose={() => setCreateTeamspaceOpen(false)}
          onCreated={(teamspace) => { setSelectedTeamspaceId(teamspace.id); setSelectedPageId(null); setLibraryView('overview'); }}
        />
      ) : null}
      <ToastRegion toast={toast} />
    </motion.div>
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

function readStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredWorkspaceId(workspaceId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // Storage can be unavailable (private mode); the selection still works in memory.
  }
}
