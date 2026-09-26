'use client';

/**
 * The knowledge workbench entry (U02): the app shell of the new knowledge
 * model. Entry runs through the real gates in order — the A04 session check
 * (anonymous goes to `/auth`, an unavailable auth service is an honest error
 * with retry), the O01 workspace list, the A00 access snapshot over the U01
 * tRPC client, and the O03 teamspace directory — and one pure state machine
 * (`entry-state.ts`) maps those onto the rendered phase, so no screen ever
 * invents data. Once a workspace is active the three-column stage mounts
 * (navigation sidebar / canvas / reserved review-AI rail) and the B06
 * workspace-event subscription wires live invalidation into the U01 cache.
 *
 * The page tree is the U03 skeleton: sections and keyboard/selection rules are
 * final, pages arrive with the page read API, and sections say so honestly.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FolderPlus, XCircle } from '@phosphor-icons/react';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';

import type { KnowledgeAuthUser } from './auth/auth-api';
import { authErrorCopyFor } from './auth/auth-errors';
import { buildAuthEntryUrl, fetchKnowledgeSessionUser, redirectToKnowledgeSignIn } from './auth/session';
import { connectKnowledgeWorkspaceEvents, type KnowledgeWorkspaceEvents } from './collaboration/workspace-events';
import { CanvasError, CanvasRedirect, CanvasSpinner, CanvasState } from './canvas-states';
import { getKnowledgeApiOrigin } from './data/endpoint';
import { useKnowledgeAccessQuery } from './data/hooks';
import { knowledgeKeysForSegments, knowledgeWorkspaceRootKey } from './data/invalidation';
import { KnowledgeQueryProvider } from './data/provider';
import { invalidateKnowledgeQueries } from './data/query-client';
import { flattenWorkspaceList, useKnowledgeTeamspacesQuery, useKnowledgeWorkspacesQuery } from './data/workspace-queries';
import { deriveKnowledgeEntryPhase, entryPhaseShowsStage, knowledgeErrorCodeOf } from './entry-state';
import { AssistantRail, AssistantRailToggle } from './assistant-rail';
import { CreateTeamspaceDialog } from './navigation/create-teamspace-dialog';
import {
  PageTreeSidebar,
  SidebarFooter,
  TreeArea,
  TreeAreaHeader,
  TreeEmpty,
  TreeError,
  TreeForbidden,
  TreeLoading,
  TreeReady,
} from './navigation/page-tree-sidebar';
import { buildNavigationSections } from './navigation/tree-model';
import { organizationErrorTextOf } from './organization/errors';
import { organizationQueryKeys } from './organization/keys';
import { ToastRegion, useOrganizationToast } from './organization/ui';
import { CreateWorkspaceDialog } from './organization/workspace-bar';
import { WorkspaceCanvas } from './workspace-canvas';

const ACTIVE_WORKSPACE_STORAGE_KEY = 'fouc.knowledge.activeWorkspaceId';

type SessionGate =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'error'; error: unknown }
  | { status: 'authenticated'; user: KnowledgeAuthUser };

export function KnowledgePage({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <KnowledgeQueryProvider>
      <KnowledgeWorkbench onOpenSettings={onOpenSettings} />
    </KnowledgeQueryProvider>
  );
}

function KnowledgeWorkbench({ onOpenSettings }: { onOpenSettings: () => void }) {
  // The U01 QueryClient shared by every query below and by the B06 event
  // subscription's invalidations.
  const queryClient = useQueryClient();

  // ── A04 session gate ────────────────────────────────────────────
  const [session, setSession] = useState<SessionGate>({ status: 'checking' });
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchKnowledgeSessionUser()
      .then((user) => {
        if (!cancelled) setSession(user ? { status: 'authenticated', user } : { status: 'anonymous' });
      })
      .catch((error: unknown) => {
        if (!cancelled) setSession({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionAttempt]);

  /** Retry flips the gate back to checking in the event handler; the effect only fetches. */
  const retrySession = () => {
    setSession({ status: 'checking' });
    setSessionAttempt((attempt) => attempt + 1);
  };

  // Anonymous at the entry goes to the plain sign-in page; a session that
  // expires mid-flight (phase below) goes through the A04 return-to flow.
  useEffect(() => {
    if (session.status === 'anonymous') window.location.assign(buildAuthEntryUrl());
  }, [session.status]);

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
  // expired under us: hand the current location to the sign-in entry.
  useEffect(() => {
    if (phase === 'auth-redirect' && session.status !== 'anonymous') redirectToKnowledgeSignIn('expired');
  }, [phase, session.status]);

  // ── B06: live workspace events → U01 cache invalidation ────────
  const stageActive = entryPhaseShowsStage(phase) && activeId !== null;
  const eventsWorkspaceId = stageActive ? activeId : null;
  useEffect(() => {
    if (!eventsWorkspaceId) return undefined;
    const controller = new AbortController();
    let connection: KnowledgeWorkspaceEvents | undefined;
    void getKnowledgeApiOrigin()
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
  // so a stale id from another workspace simply matches no row.
  const [selectedTeamspaceId, setSelectedTeamspaceId] = useState<string | null>(null);

  const sections = useMemo(() => buildNavigationSections(teamspaces, []), [teamspaces]);
  const selectedTeamspace = teamspaces.find((teamspace) => teamspace.id === selectedTeamspaceId) ?? null;

  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createTeamspaceOpen, setCreateTeamspaceOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const { toast, notify } = useOrganizationToast();

  const retryTeamspaces = () => void teamspacesQuery.refetch();

  const treeArea = (
    <>
      <TreeAreaHeader onCreateTeamspace={() => setCreateTeamspaceOpen(true)} />
      {phase === 'tree-loading' ? (
        <TreeLoading />
      ) : phase === 'tree-error' ? (
        <TreeError onRetry={retryTeamspaces} />
      ) : phase === 'tree-forbidden' ? (
        <TreeForbidden />
      ) : sections.length === 0 ? (
        <TreeEmpty onCreateTeamspace={() => setCreateTeamspaceOpen(true)} />
      ) : (
        <TreeArea>
          <TreeReady sections={sections} selectedSectionId={selectedTeamspaceId} onSelectSection={setSelectedTeamspaceId} />
        </TreeArea>
      )}
    </>
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
          onSignIn={() => window.location.assign(buildAuthEntryUrl())}
        />
      ) : phase === 'auth-redirect' ? (
        <CanvasRedirect />
      ) : phase === 'workspaces-loading' ? (
        <CanvasSpinner label="正在加载工作区" />
      ) : phase === 'workspaces-error' ? (
        <CanvasError
          title="工作区列表加载失败"
          detail={organizationErrorTextOf(workspacesQuery.error)}
          onRetry={() => void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.workspaces })}
        />
      ) : phase === 'workspaces-empty' ? (
        <CanvasState
          tone="accent"
          icon={<FolderPlus aria-hidden className="size-5" weight="regular" />}
          title="还没有可用的工作区"
          hint="工作区是知识库组织的顶层边界；创建第一个工作区后，页面树会在这里展开。"
          announce="polite"
          actions={
            <Button onClick={() => setCreateWorkspaceOpen(true)}>
              <FolderPlus aria-hidden className="size-3.5" />
              新建工作区
            </Button>
          }
        />
      ) : activeWorkspace && session.status === 'authenticated' ? (
        <div className="flex h-full min-h-0">
          <PageTreeSidebar
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspace.id}
            onSelectWorkspace={setActiveWorkspaceId}
            onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
            treeArea={treeArea}
            footer={<SidebarFooter user={session.user} onOpenSettings={onOpenSettings} />}
          />
          <WorkspaceCanvas
            phase={
              phase === 'workspace-loading' || phase === 'workspace-error' || phase === 'workspace-forbidden'
                ? phase
                : 'ready'
            }
            workspace={activeWorkspace}
            access={accessQuery.data}
            user={session.user}
            teamspaces={teamspaces}
            selectedTeamspace={selectedTeamspace}
            errorText={accessQuery.error === null ? undefined : knowledgeAccessErrorText(accessQuery.error)}
            onRetry={() => void accessQuery.refetch()}
            actions={<AssistantRailToggle open={railOpen} onToggle={() => setRailOpen((open) => !open)} />}
          />
          <AssistantRail open={railOpen} onClose={() => setRailOpen(false)} />
        </div>
      ) : null}

      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
        onCreated={(workspaceId) => {
          setActiveWorkspaceId(workspaceId);
          notify('success', '工作区已创建');
        }}
        notify={notify}
      />
      {activeWorkspace ? (
        <CreateTeamspaceDialog
          workspaceId={activeWorkspace.id}
          open={createTeamspaceOpen}
          onClose={() => setCreateTeamspaceOpen(false)}
          onCreated={(teamspace) => setSelectedTeamspaceId(teamspace.id)}
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

function knowledgeAccessErrorText(error: unknown): string {
  const code = knowledgeErrorCodeOf(error);
  const copy: Record<string, string> = {
    UNAVAILABLE: '知识服务暂时不可用，请稍后重试。',
    NETWORK: '无法连接知识服务，请检查网络后重试。',
    TIMEOUT: '连接知识服务超时，请重试。',
    RATE_LIMITED: '请求过于频繁，请稍后重试。',
    ENDPOINT: '知识服务地址未配置，无法建立连接。',
    PAYMENT_REQUIRED: '该操作需要更高的访问权限。',
  };
  return (code && copy[code]) ?? '确认工作区访问时出现问题，请重试。';
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
