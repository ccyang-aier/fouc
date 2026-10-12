"use client";

/** Identity controls access; each knowledge base owns its resource scope. */

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LockSimple, XCircle } from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useIdentity } from '@/features/identity/identity-provider';
import { getFoucApiOrigin } from '@/lib/fouc-api-endpoint';
import { authErrorCopyFor } from '../identity/auth-errors';
import { connectKnowledgeBaseEvents, type KnowledgeBaseEvents } from './collaboration/knowledge-base-events';
import { CanvasError, CanvasSpinner, CanvasState } from './canvas-states';
import { useKnowledgeAccessQuery } from './data/hooks';
import { knowledgeKeysForSegments, knowledgeBaseRootKey } from './data/invalidation';
import { KnowledgeQueryProvider } from './data/provider';
import { invalidateKnowledgeQueries } from './data/query-client';
import { flattenKnowledgeBaseList, useKnowledgeBasesQuery, useKnowledgeTeamspacesQuery } from './data/catalog-queries';
import { deriveKnowledgeEntryPhase, knowledgeErrorCodeOf, type KnowledgeQuerySlice } from './entry-state';
import { useKnowledgeNotificationsBridge } from './notifications/notifications-queries';
import { subscribeOpenPageTarget } from './editor/open-target';
import { KnowledgeTreeStage, type TreeStageTeamspaceState, type LibraryView } from './navigation/tree-stage';
import { CreateTeamspaceDialog } from './navigation/create-teamspace-dialog';
import { PageTreeSidebar } from './navigation/page-tree-sidebar';
import { organizationErrorTextOf } from './organization/errors';
import { useAppAlert } from '@/components/app-alert-provider';
import { CreateKnowledgeBaseDialog } from './organization/create-knowledge-base-dialog';
import { LibraryCanvas } from './navigation/library-canvas';
import { KnowledgePageEditor } from './editor';
import { KnowledgeWorkbench } from './knowledge-workbench';
import { createBrowserKnowledgeResourceSelection, type KnowledgeResource } from './resource-selection';
import { useKnowledgeBaseSelection } from './use-knowledge-base-selection';
import { CreateDocumentDialog, type DocumentCreation } from './navigation/create-document-dialog';
import { NavigationDialogPortal } from './navigation/navigation-dialog-portal';
import { usePageTreeOperations } from './navigation/page-operations';
import { canEditTree } from './navigation/tree-actions';
import { useCreateTeamspaceMutation } from './organization/hooks';
import { currentDocumentLinkTarget, documentLink, readDocumentLink } from './editor/document-link';
import { createLocalLibraryStore, emptyLocalLibrary } from './local/local-library';
import type { KnowledgeBaseSummary } from './knowledge-base-header';
import { KnowledgeEmptyState } from './knowledge-empty-state';

type LocalStore = ReturnType<typeof createLocalLibraryStore>;
const LocalKnowledgeResource = dynamic(() => import('./local/local-knowledge-resource').then(module => module.LocalKnowledgeResource), { ssr: false, loading: () => <CanvasSpinner label="正在加载知识资源" /> });

export function KnowledgePage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { session } = useIdentity();
  const [selection] = useState(() => {
    const store = createBrowserKnowledgeResourceSelection('local');
    const target = typeof window === 'undefined' ? null : readDocumentLink(window.location.href);
    if (target) store.select(target.source);
    return store;
  });
  const resource = useSyncExternalStore(selection.subscribe, selection.getSnapshot, selection.getServerSnapshot);
  const target = typeof window === 'undefined' ? null : readDocumentLink(window.location.href);
  const [chosenBaseId, setChosenBaseId] = useKnowledgeBaseSelection('resources', target?.knowledgeBaseId);
  const [{ localStore, localError }] = useState(() => {
    try { return { localStore: typeof window === 'undefined' ? null : createLocalLibraryStore(window.localStorage), localError: null }; }
    catch { return { localStore: null, localError: '无法读取本机文档，请检查浏览器存储设置。' }; }
  });
  if (!resource) return <CanvasSpinner label="正在加载知识资源" />;
  return <KnowledgeQueryProvider key={session.status === 'authenticated' ? session.user.id : 'guest'}>
    <KnowledgeResources resource={resource} onSelectSource={selection.select} chosenBaseId={chosenBaseId} onSelectBase={setChosenBaseId} localStore={localStore} localError={localError} onOpenSettings={onOpenSettings} />
  </KnowledgeQueryProvider>;
}

function KnowledgeResources({ resource, onSelectSource, chosenBaseId, onSelectBase, localStore, localError, onOpenSettings }: {
  resource: KnowledgeResource; onSelectSource: (source: KnowledgeResource) => void; chosenBaseId: string | null; onSelectBase: (id: string) => void; localStore: LocalStore | null; localError: string | null; onOpenSettings: () => void;
}) {
  const { session } = useIdentity();
  const local = useSyncExternalStore(localStore?.subscribe ?? (() => () => {}), localStore?.getSnapshot ?? (() => emptyLocalLibrary), () => emptyLocalLibrary);
  const basesQuery = useKnowledgeBasesQuery(session.status === 'authenticated');
  const serverBases = flattenKnowledgeBaseList(basesQuery.data);
  const directory: KnowledgeBaseSummary[] = [...local.bases.map(base => ({ ...base, source: 'local' as const })), ...serverBases.map(base => ({ ...base, source: 'server' as const }))];
  const activeBaseId = chosenBaseId ?? directory.find(base => base.source === resource)?.id ?? null;
  const [creating, setCreating] = useState(false);
  const select = useCallback((id: string) => {
    const source = localStore?.getSnapshot().bases.some(base => base.id === id) ? 'local' : 'server';
    onSelectBase(id);
    onSelectSource(source);
  }, [localStore, onSelectBase, onSelectSource]);
  useEffect(() => subscribeOpenPageTarget(target => {
    if (target.knowledgeBaseId === activeBaseId) return;
    // Keep the requested page across the knowledge-base component remount.
    window.history.replaceState(window.history.state, '', documentLink(window.location.href, { ...target, source: resource }));
    onSelectBase(target.knowledgeBaseId);
  }), [activeBaseId, onSelectBase, resource]);
  const shared = { knowledgeBases: directory, onSelectKnowledgeBase: select, onCreateKnowledgeBase: () => setCreating(true), onOpenSettings };
  return <>
    {resource === 'local' ? localStore ? <LocalKnowledgeResource key={`local:${activeBaseId ?? 'empty'}`} store={localStore} selectedKnowledgeBaseId={activeBaseId} {...shared} /> : <UnavailableLocalResource detail={localError} {...shared} /> : <ServerKnowledgeResource key={`server:${activeBaseId ?? 'empty'}`} activeBaseId={activeBaseId} baseAvailable={serverBases.some(base => base.id === activeBaseId)} directoryState={{ status: basesQuery.isFetchNextPageError ? 'error' : basesQuery.hasNextPage || basesQuery.isFetchingNextPage ? 'pending' : basesQuery.status, errorCode: basesQuery.error ? knowledgeErrorCodeOf(basesQuery.error) : null, count: serverBases.length }} directoryError={basesQuery.error} retryDirectory={() => void basesQuery.refetch()} {...shared} />}
    <CreateKnowledgeBaseDialog key={resource} open={creating} initialSource={session.status === 'authenticated' ? resource : 'local'} onClose={() => setCreating(false)} onCreateLocal={name => {
      if (!localStore) throw new Error('本机存储不可用');
      const id = crypto.randomUUID();
      localStore.update(library => ({ ...library, bases: [...library.bases, { id, name }] }));
      return id;
    }} onCreated={(id, source) => { onSelectBase(id); onSelectSource(source); }} />
  </>;
}

function UnavailableLocalResource({ detail, knowledgeBases, onSelectKnowledgeBase, onCreateKnowledgeBase, onOpenSettings }: { detail: string | null; knowledgeBases: readonly KnowledgeBaseSummary[]; onSelectKnowledgeBase: (id: string) => void; onCreateKnowledgeBase: () => void; onOpenSettings: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return <KnowledgeWorkbench navigationScope="local:unavailable" sidebar={<PageTreeSidebar collapsed={collapsed} onCollapse={() => setCollapsed(true)} knowledgeBases={knowledgeBases} activeKnowledgeBaseId={null} onSelectKnowledgeBase={onSelectKnowledgeBase} onCreateKnowledgeBase={onCreateKnowledgeBase} onOpenSettings={onOpenSettings} treeArea={null} />} onExpandSidebar={collapsed ? () => setCollapsed(false) : undefined}>
    <CanvasError title="本机知识库无法打开" detail={detail ?? '无法读取浏览器存储'} />
  </KnowledgeWorkbench>;
}

function ServerKnowledgeResource({ activeBaseId, baseAvailable, directoryState, directoryError, retryDirectory, knowledgeBases, onSelectKnowledgeBase, onCreateKnowledgeBase, onOpenSettings }: {
  activeBaseId: string | null; baseAvailable: boolean; directoryState: KnowledgeQuerySlice; directoryError: unknown; retryDirectory: () => void; knowledgeBases: readonly KnowledgeBaseSummary[]; onSelectKnowledgeBase: (id: string) => void; onCreateKnowledgeBase: () => void; onOpenSettings: () => void;
}) {
  const queryClient = useQueryClient();
  const { session, refresh, expireSession, openSignIn } = useIdentity();
  const authenticated = session.status === 'authenticated';
  const activeId = authenticated && baseAvailable ? activeBaseId : null;
  const accessQuery = useKnowledgeAccessQuery(activeId ?? '', { enabled: activeId !== null });
  const teamspacesQuery = useKnowledgeTeamspacesQuery(accessQuery.isSuccess ? activeId : null);
  const teamspaces = flattenKnowledgeBaseList(teamspacesQuery.data);
  const phase = deriveKnowledgeEntryPhase({
    session: { status: session.status },
    knowledgeBases: authenticated ? directoryState : null,
    access: activeId ? { status: accessQuery.status, errorCode: accessQuery.error ? knowledgeErrorCodeOf(accessQuery.error) : null } : null,
    teamspaces: activeId && accessQuery.isSuccess ? { status: teamspacesQuery.status, errorCode: teamspacesQuery.error ? knowledgeErrorCodeOf(teamspacesQuery.error) : null, count: teamspaces.length } : null,
  });
  useEffect(() => { if (phase === 'auth-required' && session.status === 'authenticated') expireSession(); }, [phase, session.status, expireSession]);
  const stageActive = activeId !== null && accessQuery.isSuccess;
  useEffect(() => {
    if (!stageActive || !activeId) return;
    const controller = new AbortController();
    let connection: KnowledgeBaseEvents | undefined;
    void getFoucApiOrigin().then(({ origin }) => {
      if (controller.signal.aborted) return;
      connection = connectKnowledgeBaseEvents({ knowledgeBaseId: activeId, origin, signal: controller.signal,
        invalidate: segments => { for (const key of knowledgeKeysForSegments(activeId, segments)) void invalidateKnowledgeQueries(queryClient, key); },
        invalidateAll: () => { void invalidateKnowledgeQueries(queryClient, knowledgeBaseRootKey(activeId)); },
      });
    }).catch(() => undefined);
    return () => { controller.abort(); connection?.close(); };
  }, [stageActive, activeId, queryClient]);

  const [libraryView, setLibraryView] = useState<LibraryView>('all-documents');
  const [selectedTeamspaceId, setSelectedTeamspaceId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => activeBaseId ? currentDocumentLinkTarget(activeBaseId, 'server')?.pageId ?? null : null);
  const [editorSidebarOpen, setEditorSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [createTeamspaceOpen, setCreateTeamspaceOpen] = useState(false);
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const { notify } = useAppAlert();
  const openPage = useCallback((id: string | null) => { setSelectedPageId(id); setEditorSidebarOpen(false); }, [setSelectedPageId, setEditorSidebarOpen]);
  useKnowledgeNotificationsBridge({ active: stageActive, knowledgeBaseId: activeId, openPage });
  useEffect(() => stageActive ? subscribeOpenPageTarget(target => { if (target.knowledgeBaseId === activeId) openPage(target.pageId); }) : undefined, [stageActive, activeId, openPage]);
  const pageOperations = usePageTreeOperations(activeId, { canEdit: canEditTree(accessQuery.data), notify });
  const createTeamspace = useCreateTeamspaceMutation(activeId ?? '');
  async function createDocument(input: DocumentCreation): Promise<string | null> {
    if (!activeId) return null;
    try {
      const teamspaceId = input.teamspaceId || (await createTeamspace.mutateAsync({ name: '文档', defaultAccess: 'edit' })).id;
      const id = await pageOperations.createPage({ ...input, teamspaceId });
      if (id) { openPage(id); setCreateDocumentOpen(false); }
      return id;
    } catch { notify('error', '创建文档失败，请重试'); return null; }
  }
  const selectedTeamspace = teamspaces.find(teamspace => teamspace.id === selectedTeamspaceId) ?? null;
  const treeState: TreeStageTeamspaceState = phase === 'tree-loading' ? 'loading' : phase === 'tree-error' ? 'error' : phase === 'tree-forbidden' ? 'forbidden' : teamspaces.length ? 'ready' : 'empty';
  const treeArea = stageActive && activeId ? <KnowledgeTreeStage
    knowledgeBaseId={activeId}
    userId={authenticated ? session.user.id : ''}
    view={libraryView}
    onNavigate={view => { setLibraryView(view); setSelectedPageId(null); }}
    teamspaces={teamspaces}
    teamspaceState={treeState}
    access={accessQuery.data}
    selectedSectionId={selectedTeamspaceId}
    selectedPageId={selectedPageId}
    onSelectSection={id => { setSelectedTeamspaceId(id); setSelectedPageId(null); setLibraryView('overview'); }}
    onSelectPage={openPage}
    onRetryTeamspaces={() => void teamspacesQuery.refetch()}
    onCreateTeamspace={() => setCreateTeamspaceOpen(true)}
    notify={notify}
  /> : null;

  function renderEditor(pageId: string, onBack: () => void) {
    if (!stageActive || !activeId || !authenticated) return null;
    return <KnowledgePageEditor
      key={pageId}
      scope={{ knowledgeBaseId: activeId, pageId }}
      user={session.user}
      knowledgeBaseId={activeId}
      onBack={onBack}
      onOpenSidebar={() => setEditorSidebarOpen(true)}
      onCreateDocument={() => setCreateDocumentOpen(true)}
      canCreateDocument={canEditTree(accessQuery.data)}
    />;
  }
  const documentOpen = stageActive && Boolean(selectedPageId);
  function closeDocument() { setSelectedPageId(null); setLibraryView('all-documents'); }

  let content: ReactNode = null;
  if (phase === 'session-checking') {
    content = <CanvasSpinner label="正在确认登录状态" />;
  } else if (phase === 'session-error') {
    content = <CanvasState tone="error" icon={<XCircle size={20} />} title="无法确认登录状态" hint={authErrorCopyFor(session.status === 'error' ? session.error : null).description} actions={<><Button variant="outline" onClick={() => void refresh()}>重试</Button><Button variant="ghost" onClick={openSignIn}>前往登录</Button></>} />;
  } else if (phase === 'auth-required') {
    content = <CanvasState icon={<LockSimple size={20} />} title="此知识库需要登录" actions={<Button onClick={openSignIn}>登录并继续</Button>} />;
  } else if (phase === 'knowledge-bases-loading') {
    content = <CanvasSpinner label="正在加载知识库" />;
  } else if (phase === 'knowledge-bases-error') {
    content = <CanvasError title="知识库列表加载失败" detail={organizationErrorTextOf(directoryError)} onRetry={retryDirectory} />;
  } else if (phase === 'knowledge-bases-empty' && !activeBaseId) {
    content = <KnowledgeEmptyState onCreate={onCreateKnowledgeBase} />;
  } else if (directoryState.status === 'success' && !baseAvailable) {
    content = <CanvasState icon={<LockSimple size={20} />} title="无法访问此知识库" hint="知识库已被移除，或当前账户没有访问权限。" />;
  } else if (phase === 'knowledge-base-loading') {
    content = <CanvasSpinner label="正在确认知识库权限" />;
  } else if (phase === 'knowledge-base-error') {
    content = <CanvasError title="无法确认知识库权限" onRetry={() => void accessQuery.refetch()} />;
  } else if (phase === 'knowledge-base-forbidden') {
    content = <CanvasState icon={<LockSimple size={20} />} title="没有此知识库的访问权限" />;
  } else if (activeId && authenticated) {
    content = selectedPageId ? renderEditor(selectedPageId, closeDocument) : <LibraryCanvas
      knowledgeBaseId={activeId}
      userId={session.user.id}
      name={knowledgeBases.find(base => base.id === activeId)?.name ?? ''}
      view={libraryView}
      access={accessQuery.data}
      teamspaces={teamspaces}
      folder={selectedTeamspace}
      onOpenPage={openPage}
      onSelectFolder={id => { setSelectedTeamspaceId(id); setLibraryView('overview'); }}
      onCreateFolder={() => setCreateTeamspaceOpen(true)}
      onExpandSidebar={sidebarCollapsed ? () => setSidebarCollapsed(false) : undefined}
      notify={notify}
    />;
  }

  return <KnowledgeWorkbench
    navigationScope={`server:${authenticated ? session.user.id : 'guest'}:${activeBaseId ?? 'none'}`}
    documentOpen={documentOpen}
    sidebarOpen={documentOpen && editorSidebarOpen}
    onCloseDocument={closeDocument}
    onCloseSidebar={() => setEditorSidebarOpen(false)}
    onExpandSidebar={sidebarCollapsed ? () => setSidebarCollapsed(false) : undefined}
    renderFixedDocument={(document, onClose) => stageActive && document.target.source === 'server' && document.target.knowledgeBaseId === activeId
      ? renderEditor(document.target.pageId, onClose)
      : <CanvasState title="无法访问此文档" hint="请确认知识库与文档的访问权限。" />}
    sidebar={<PageTreeSidebar
      collapsed={documentOpen ? false : sidebarCollapsed}
      onCollapse={() => documentOpen ? setEditorSidebarOpen(false) : setSidebarCollapsed(true)}
      knowledgeBases={knowledgeBases}
      activeKnowledgeBaseId={activeBaseId}
      onSelectKnowledgeBase={onSelectKnowledgeBase}
      onCreateKnowledgeBase={onCreateKnowledgeBase}
      onOpenSettings={onOpenSettings}
      treeArea={treeArea}
    />}
    overlays={<>
      {createDocumentOpen && activeId ? <NavigationDialogPortal><CreateDocumentDialog
        teamspaces={teamspaces}
        target={{ teamspaceId: selectedTeamspaceId ?? undefined, parentId: null }}
        onClose={() => setCreateDocumentOpen(false)}
        onCreate={createDocument}
      /></NavigationDialogPortal> : null}
      {activeId ? <CreateTeamspaceDialog knowledgeBaseId={activeId} open={createTeamspaceOpen} onClose={() => setCreateTeamspaceOpen(false)} onCreated={folder => { setSelectedTeamspaceId(folder.id); setSelectedPageId(null); setLibraryView('overview'); }} /> : null}
    </>}
  >{content}</KnowledgeWorkbench>;
}
