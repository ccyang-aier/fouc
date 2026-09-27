'use client';

import { useMemo } from 'react';
import { FilePlus, Folder, Plus } from '@phosphor-icons/react';
import type { Teamspace } from '@fouc/shared/knowledge/contracts';
import type { KnowledgeAccess } from '../data/hooks';
import { useKnowledgePagesQuery } from '../data/pages-queries';
import { SidebarDocumentMenu } from '../dense-sidebar/sidebar-document-menu';
import { CanvasError, CanvasSpinner } from '../canvas-states';
import { buildNavigationSections, pageDisplayTitle, recycledRootPages } from './tree-model';
import { sidebarDocuments } from './sidebar-documents';
import { useSidebarCollections } from './sidebar-collections';
import { useDocumentNavigationActions } from './document-navigation-actions';
import { canEditTree } from './tree-actions';
import type { TreeNotifier } from './page-operations';
import type { LibraryView } from './tree-stage';
import styles from '../library-canvas.module.css';

const titles = { overview: '知识库', 'all-documents': '文档', starred: '星标', drafts: '草稿', trash: '回收站', projects: '文件夹', recent: '最近' };

export function LibraryCanvas({ workspaceId, userId, name, view, access, teamspaces, onOpenPage, onSelectFolder, onCreateFolder, notify, folder }: {
  workspaceId: string;
  userId: string;
  name: string;
  view: LibraryView;
  access: KnowledgeAccess | undefined;
  teamspaces: readonly Teamspace[];
  onOpenPage: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onCreateFolder: () => void;
  notify: TreeNotifier;
  folder?: Teamspace | null;
}) {
  const query = useKnowledgePagesQuery(workspaceId);
  const pages = useMemo(() => query.data ?? [], [query.data]);
  const documents = sidebarDocuments(buildNavigationSections(teamspaces, pages), pages);
  const { collections } = useSidebarCollections(userId, workspaceId);
  const actions = useDocumentNavigationActions({ workspaceId, userId, pages, teamspaces, canEdit: canEditTree(access), onOpenPage, notify });
  const listed = view === 'overview' && folder ? documents.filter((page) => page.teamspaceId === folder.id) : view === 'starred' ? documents.filter((page) => collections.starred.includes(page.id)) : view === 'drafts' ? documents.filter((page) => collections.drafts.includes(page.id)) : view === 'recent' ? documents.slice(0, 10) : documents;
  if (query.isPending) return <CanvasSpinner label="正在加载文档" />;
  if (query.isError) return <CanvasError title="文档加载失败" onRetry={() => void query.refetch()} />;
  const recycled = recycledRootPages(pages);
  return <section aria-label="知识库文档列表" className="min-h-0 flex-1 overflow-y-auto bg-white">
    <div className={styles.libraryView}>
      <header className={styles.viewHeader}>
        <div><p className={styles.eyebrow}>{name}</p><h1>{view === 'overview' ? folder?.name ?? name : titles[view]}</h1></div>
        {view !== 'trash' ? <button type="button" className={styles.primaryAction} onClick={() => view === 'projects' ? onCreateFolder() : void actions.create(folder?.id)}>{view === 'projects' ? <Plus size={15} /> : <FilePlus size={15} />}{view === 'projects' ? '新建文件夹' : '新建文档'}</button> : null}
      </header>
      <div className={styles.documentList}>
        {view === 'projects' ? teamspaces.map((folder) => <button key={folder.id} type="button" className={styles.knowledgeBaseRow} onClick={() => onSelectFolder(folder.id)}><Folder size={16} /><span>{folder.name}</span></button>) : view === 'trash' ? recycled.map((page) => <div key={page.id} className={styles.documentCard}><span className="min-w-0 flex-1 truncate px-4 py-3 text-[13px]">{page.title}</span><button type="button" aria-label={`恢复${page.title}`} disabled={actions.operations.hasPending(page.id)} onClick={() => void actions.operations.restorePage(page.id)} className="!w-auto px-4 text-[12px]">恢复</button></div>) : listed.map((page) => <div key={page.id} className={styles.documentCard}><button type="button" onClick={() => onOpenPage(page.id)}><span>{pageDisplayTitle(page)}</span><small>{page.updatedAt.slice(0, 10)}</small></button><SidebarDocumentMenu documentId={page.id} starred={collections.starred.includes(page.id)} onAction={actions.act} /></div>)}
        {(view === 'projects' ? !teamspaces.length : view === 'trash' ? !recycled.length : !listed.length) ? <p className={styles.empty}>{view === 'trash' ? '回收站为空' : '这里还没有内容'}</p> : null}
      </div>
    </div>
    {actions.dialogs}
  </section>;
}
