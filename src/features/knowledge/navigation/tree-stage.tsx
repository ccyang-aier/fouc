'use client';

/**
 * The tree area composer (U03): everything between the sidebar header and the
 * account row — the four honest teamspaces states of U02, then the page layer:
 * the pages query, the optimistic operations controller, the tree with its
 * menus / renames / drags, and the recycle bin. The knowledge page only picks
 * this component and owns the selection state so the canvas stays in sync;
 * every page-tree concern lives here and below.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { CaretRight, Clock, FileText, Star, Trash, XCircle } from '@phosphor-icons/react';
import type { Teamspace } from '@fouc/shared/knowledge/contracts';
import type { KnowledgeAccess } from '../data/hooks';
import { useKnowledgePagesQuery } from '../data/pages-queries';
import { knowledgeErrorCodeOf } from '../entry-state';
import { TreeArea, TreeAreaHeader, TreeEmpty, TreeError, TreeForbidden, TreeLoading } from './page-tree-sidebar';
import { PageTree, type PageTreeHandle } from './page-tree';
import { usePageTreeOperations, type TreeNotifier } from './page-operations';
import { canEditTree, readOnlyTreeReason } from './tree-actions';
import { buildNavigationSections, recycledRootPages } from './tree-model';
import { RecycleBin } from './recycle-bin';
import { canManageOrganization } from '../organization/view-model';
import { KnowledgeBaseActions } from './knowledge-base-actions';
import { KnowledgeBaseMenu } from './knowledge-base-menu';
import { SidebarStarButton, SidebarTags, useSidebarCollections } from './sidebar-collections';
import { SidebarDocuments, sidebarDocuments } from './sidebar-documents';
import { PageAppearanceDialog } from './page-appearance-dialog';

export type TreeStageTeamspaceState = 'loading' | 'error' | 'forbidden' | 'empty' | 'ready';

export function KnowledgeTreeStage({
  userId,
  workspaceId,
  teamspaces,
  teamspaceState,
  access,
  selectedSectionId,
  selectedPageId,
  onSelectSection,
  onSelectPage,
  onRetryTeamspaces,
  onCreateTeamspace,
  notify,
}: {
  userId: string;
  workspaceId: string | null;
  teamspaces: readonly Teamspace[];
  teamspaceState: TreeStageTeamspaceState;
  access: KnowledgeAccess | undefined;
  selectedSectionId: string | null;
  selectedPageId: string | null;
  onSelectSection: (sectionId: string) => void;
  onSelectPage: (pageId: string) => void;
  onRetryTeamspaces: () => void;
  onCreateTeamspace: () => void;
  notify: TreeNotifier;
}) {
  const { collections, setCollections, toggleStar } = useSidebarCollections(userId, workspaceId);
  const [collection, setCollection] = useState<'tree' | 'all' | 'starred' | 'trash'>('tree');
  const [librariesOpen, setLibrariesOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(false);
  const [baseAction, setBaseAction] = useState<{ teamspace: Teamspace; action: 'rename' | 'delete' } | null>(null);
  const treeRef = useRef<PageTreeHandle>(null);
  const canEdit = canEditTree(access);

  const pagesQuery = useKnowledgePagesQuery(workspaceId, { enabled: teamspaceState === 'ready' });
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const operations = usePageTreeOperations(workspaceId, { canEdit, notify });

  const sections = useMemo(() => buildNavigationSections(teamspaces, pages), [teamspaces, pages]);
  const documents = useMemo(() => sidebarDocuments(sections, pages), [sections, pages]);
  const recycledRoots = useMemo(() => recycledRootPages(pages), [pages]);
  const restoringIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [pageId, kinds] of operations.pendingByPage) if (kinds.includes('restore')) ids.add(pageId);
    return ids;
  }, [operations.pendingByPage]);

  const [appearance, setAppearance] = useState<{ pageId: string; mode: 'icon' | 'cover' } | null>(null);
  const appearancePage = useMemo(
    () => (appearance === null ? null : (pages.find((page) => page.id === appearance.pageId) ?? null)),
    [appearance, pages],
  );

  const createTargetTeamspace = teamspaces.find((item) => item.id === selectedSectionId)?.id ?? teamspaces[0]?.id ?? null;

  const handleCreateChild = useCallback(
    async (target: { pageId: string | null; sectionId: string }) => {
      if (!canEdit) return;
      const created = await operations.createPage({ teamspaceId: target.sectionId, parentId: target.pageId });
      if (created !== null) {
        onSelectSection(target.sectionId);
        onSelectPage(created);
        treeRef.current?.startRename(created);
      }
    },
    [canEdit, operations, onSelectPage, onSelectSection],
  );

  function openPage(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (page) onSelectSection(page.teamspaceId);
    onSelectPage(pageId);
  }

  return (
    <>
      <nav aria-label="知识库文档导航" className="shrink-0 space-y-px px-[11px] pb-3">
        <button type="button" data-active={collection === 'all'} aria-current={collection === 'all' ? 'page' : undefined} onClick={() => setCollection('all')} className="sidebar-nav-row flex h-[30px] w-full items-center gap-2 rounded-md px-1 text-left text-[13px] text-[var(--ink-soft)]"><FileText size={15} weight="fill" className="text-[#667dc4]" />全部文档<span className="ml-auto text-[11px] text-[var(--muted)]">{documents.length}</span></button>
        <button type="button" data-active={collection === 'starred'} aria-current={collection === 'starred' ? 'page' : undefined} onClick={() => setCollection('starred')} className="sidebar-nav-row flex h-[30px] w-full items-center gap-2 rounded-md px-1 text-left text-[13px] text-[var(--ink-soft)]"><Star size={15} weight="fill" className="text-[#e9ad16]" />星标<span className="ml-auto text-[11px] text-[var(--muted)]">{documents.filter((page) => collections.starred.includes(page.id)).length}</span></button>
        <button type="button" data-active={collection === 'trash'} aria-current={collection === 'trash'  ? 'page' : undefined} onClick={() => setCollection('trash')} className="sidebar-nav-row flex h-[30px] w-full items-center gap-2 rounded-md px-1 text-left text-[13px] text-[var(--ink-soft)]"><Trash size={15} weight="fill" className="text-[#d76d68]" />回收站<span className="ml-auto text-[11px] text-[var(--muted)]">{recycledRoots.length}</span></button>
      </nav>
      <TreeAreaHeader
        expanded={librariesOpen}
        onToggle={() => setLibrariesOpen((open) => !open)}
        onCreateTeamspace={onCreateTeamspace}
        onCreatePage={createTargetTeamspace === null || !canEdit ? undefined : () => void handleCreateChild({ pageId: null, sectionId: createTargetTeamspace })}
      />
      {teamspaceState !== 'ready' ? (
        teamspaceState === 'loading' ? (
          <TreeLoading />
        ) : teamspaceState === 'error' ? (
          <TreeError onRetry={onRetryTeamspaces} />
        ) : teamspaceState === 'forbidden' ? (
          <TreeForbidden />
        ) : (
          <TreeEmpty onCreateTeamspace={onCreateTeamspace} />
        )
      ) : pagesQuery.isPending ? (
        <TreeLoading />
      ) : pagesQuery.isError ? (
        <TreePagesError code={knowledgeErrorCodeOf(pagesQuery.error)} onRetry={() => void pagesQuery.refetch()} />
      ) : (
        <TreeArea>
          {collection !== 'tree' ? <div className="mb-3 space-y-px border-b border-[var(--line)] pb-3">
            <button type="button" onClick={() => setCollection('tree')} className="mb-2 text-[11px] text-[var(--muted)]">← 返回知识库目录</button>
            {collection !== 'trash' ? <SidebarDocuments pages={collection === 'starred' ? documents.filter((page) => collections.starred.includes(page.id)) : documents} renderAction={(page) => <SidebarStarButton starred={collections.starred.includes(page.id)} onToggle={() => toggleStar(page.id)} />} selectedPageId={selectedPageId} onSelect={(page) => { onSelectSection(page.teamspaceId); onSelectPage(page.id); treeRef.current?.revealPage(page.id); }} /> : recycledRoots.length ? <RecycleBin pages={recycledRoots} restoringIds={restoringIds} onRestore={(id) => void operations.restorePage(id)} initiallyOpen /> : <p className="py-3 text-[12px] text-[var(--muted)]">回收站为空</p>}
          </div> : null}
          {!canEdit ? (
            <p role="note" className="mx-1 mb-2 rounded-[6px] border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1.5 text-[10.5px] leading-relaxed text-[var(--muted-strong)]">
              {readOnlyTreeReason}
            </p>
          ) : null}
          <div hidden={!librariesOpen}>
          <PageTree
            ref={treeRef}
            sections={sections}
            pages={pages}
            selectedSectionId={selectedSectionId}
            selectedPageId={selectedPageId}
            canEdit={canEdit}
            operations={operations}
            onSelectSection={onSelectSection}
            onSelectPage={openPage}
            onCreateChild={(target) => void handleCreateChild(target)}
            onSectionMenu={access && canManageOrganization(access.role) ? (id) => {
              const teamspace = teamspaces.find((item) => item.id === id);
              return teamspace ? <KnowledgeBaseMenu teamspace={teamspace} onCreatePage={() => void handleCreateChild({ pageId: null, sectionId: id })} onAction={(action) => setBaseAction({ teamspace, action })} /> : null;
            } : undefined}
            onEditAppearance={(pageId, mode) => setAppearance({ pageId, mode })}
          />
          </div>
          <SidebarTags pages={documents} collections={collections} onChange={setCollections} selectedPageId={selectedPageId} onSelect={(page) => { onSelectSection(page.teamspaceId); onSelectPage(page.id); }} />
          <section className="mt-[13px]">
            <button type="button" aria-expanded={recentOpen} onClick={() => setRecentOpen((open) => !open)} className="sidebar-nav-row flex h-[30px] w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] text-[var(--muted-strong)]"><Clock size={15} />最近文档<CaretRight size={10} weight="fill" className={recentOpen ? 'rotate-90' : ''} /></button>
            {recentOpen ? <SidebarDocuments pages={documents.slice(0, 10)} renderAction={(page) => <SidebarStarButton starred={collections.starred.includes(page.id)} onToggle={() => toggleStar(page.id)} />} selectedPageId={selectedPageId} indented onSelect={(page) => { onSelectSection(page.teamspaceId); onSelectPage(page.id); }} /> : null}
          </section>
        </TreeArea>
      )}
      {baseAction && workspaceId ? <KnowledgeBaseActions key={`${baseAction.teamspace.id}:${baseAction.action}`} workspaceId={workspaceId} target={baseAction} onClose={() => setBaseAction(null)} onRemoved={() => onSelectSection('')} notify={notify} /> : null}
      <PageAppearanceDialog
        key={appearance === null ? 'closed' : `${appearance.pageId}:${appearance.mode}`}
        open={appearance !== null}
        mode={appearance?.mode ?? 'icon'}
        page={appearancePage === null ? null : { id: appearancePage.id, title: appearancePage.title, icon: appearancePage.icon, cover: appearancePage.cover }}
        onClose={() => setAppearance(null)}
        onApply={(pageId, patch) => void operations.updateAppearance(pageId, patch)}
      />
    </>
  );
}

/** The honest page-read failure: names the code, offers the retry, never renders invented pages. */
function TreePagesError({ code, onRetry }: { code: string | null; onRetry: () => void }) {
  const copy: Record<string, string> = {
    FORBIDDEN: '没有读取页面目录的权限。',
    NOT_FOUND: '页面目录不可用，请刷新后重试。',
    UNAVAILABLE: '知识服务暂时不可用，请稍后重试。',
    NETWORK: '无法连接知识服务，请检查网络后重试。',
    UNAUTHENTICATED: '登录状态已过期，请重新登录。',
  };
  return (
    <div role="alert" className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <span aria-hidden className="flex size-10 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--err-ink)_28%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_8%,transparent)] text-[var(--err-ink)]">
        <XCircle className="size-5" weight="fill" />
      </span>
      <p className="text-[13px] font-medium text-[var(--ink)]">页面目录加载失败</p>
      <p className="max-w-[360px] text-[11.5px] leading-relaxed text-[var(--muted-strong)]">
        {code !== null && copy[code] ? copy[code] : '读取页面目录时出现问题。'}{' '}
        <span className="text-[var(--muted)]">（错误码 {code ?? 'NETWORK'}）</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 h-8 rounded-[6px] border border-[var(--line)] bg-[var(--panel)] px-3 text-[11.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
      >
        重试
      </button>
    </div>
  );
}
