'use client';

import { useState } from 'react';
import type { Page, Teamspace } from '@fouc/shared/knowledge/contracts';
import { useCreateTeamspaceMutation } from '../organization/hooks';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import type { DocumentAction } from '../dense-sidebar/document-action-menu-content';
import { usePageTreeOperations, type TreeNotifier } from './page-operations';
import { NavigationDialogPortal } from './navigation-dialog-portal';
import { CreateDocumentDialog, type DocumentCreation } from './create-document-dialog';
import { DocumentShareDialog } from '../sharing/document-share-dialog';
import { documentLink } from '../editor/document-link';
import { useSidebarCollections } from './sidebar-collections';

export function useDocumentNavigationActions({ knowledgeBaseId, userId, pages, teamspaces, canEdit, onOpenPage, notify }: {
  knowledgeBaseId: string;
  userId: string;
  pages: readonly Page[];
  teamspaces: readonly Teamspace[];
  canEdit: boolean;
  onOpenPage: (id: string) => void;
  notify: TreeNotifier;
}) {
  const operations = usePageTreeOperations(knowledgeBaseId, { canEdit, notify });
  const createFolder = useCreateTeamspaceMutation(knowledgeBaseId);
  const { collections, toggleStar, toggleDraft } = useSidebarCollections(userId, knowledgeBaseId);
  const [renaming, setRenaming] = useState<Pick<Page, 'id' | 'title'> | null>(null);
  const [title, setTitle] = useState('');
  const [creation, setCreation] = useState<{ teamspaceId?: string; parentId: string | null; resolve: (id: string | null) => void } | null>(null);
  const [sharing, setSharing] = useState<Page | null>(null);
  function create(teamspaceId?: string, parentId: string | null = null): Promise<string | null> {
    if (!canEdit) { notify('error', '没有创建文档的权限'); return Promise.resolve(null); }
    return new Promise((resolve) => setCreation({ teamspaceId, parentId, resolve }));
  }
  function closeCreation() { creation?.resolve(null); setCreation(null); }
  async function submitCreation(input: DocumentCreation) {
    try {
      const folderId = input.teamspaceId ?? (await createFolder.mutateAsync({ name: '文档', defaultAccess: 'edit' })).id;
      const id = await operations.createPage({ ...input, teamspaceId: folderId });
      if (id) { creation?.resolve(id); setCreation(null); onOpenPage(id); }
      return id;
    } catch { notify('error', '创建文档失败，请重试'); return null; }
  }
  function closeRename() { setRenaming(null); }
  function act(id: string, action: DocumentAction) {
    const page = pages.find((item) => item.id === id);
    if (!page) return;
    if (action === 'share') { setSharing(page); return; }
    if (action === 'open-tab') { window.open(documentLink(window.location.href, { knowledgeBaseId, pageId: id, source: 'server' }), '_blank', 'noopener,noreferrer'); return; }
    if (action === 'toggle-draft') { const wasDraft = collections.drafts.includes(id); toggleDraft(id); notify('success', wasDraft ? '已移出草稿' : '已加入草稿'); return; }
    if (action === 'toggle-star') { toggleStar(id); return; }
    if (!canEdit) { notify('error', '没有修改文档的权限'); return; }
    if (action === 'rename') { setRenaming(page); setTitle(page.title); }
    if (action === 'trash') void operations.recyclePage(id);
  }
  const dialogs = <>
    {creation ? <NavigationDialogPortal><CreateDocumentDialog teamspaces={teamspaces} target={creation} onClose={closeCreation} onCreate={submitCreation} /></NavigationDialogPortal> : null}
    {renaming ? <NavigationDialogPortal><ModalDialog open title="重命名文档" onClose={closeRename} footer={<><DialogButton onClick={closeRename}>取消</DialogButton><DialogButton variant="primary" disabled={operations.hasPending(renaming.id)} onClick={() => { void operations.renamePage(renaming.id, title).then(closeRename); }}>保存</DialogButton></>}><NameField label="文档名称" value={title} onChange={setTitle} autoFocus maxLength={500} /></ModalDialog></NavigationDialogPortal> : null}
    {sharing ? <NavigationDialogPortal><DocumentShareDialog title={sharing.title} target={{ knowledgeBaseId, pageId: sharing.id, source: 'server' }} onClose={() => setSharing(null)} /></NavigationDialogPortal> : null}
  </>;
  return { operations, create, act, dialogs };
}
