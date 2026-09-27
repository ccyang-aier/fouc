'use client';

import { useState } from 'react';
import type { Page, Teamspace } from '@fouc/shared/knowledge/contracts';
import { useCreateTeamspaceMutation } from '../organization/hooks';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import type { DocumentAction } from '../dense-sidebar/document-action-menu-content';
import { usePageTreeOperations, type TreeNotifier } from './page-operations';
import { NavigationDialogPortal } from './navigation-dialog-portal';
import { CreateDocumentDialog, type DocumentCreation } from './create-document-dialog';
import { PageAppearanceDialog } from './page-appearance-dialog';
import { useSidebarCollections } from './sidebar-collections';

export function useDocumentNavigationActions({ workspaceId, userId, pages, teamspaces, canEdit, onOpenPage, notify }: {
  workspaceId: string;
  userId: string;
  pages: readonly Page[];
  teamspaces: readonly Teamspace[];
  canEdit: boolean;
  onOpenPage: (id: string) => void;
  notify: TreeNotifier;
}) {
  const operations = usePageTreeOperations(workspaceId, { canEdit, notify });
  const createFolder = useCreateTeamspaceMutation(workspaceId);
  const { collections, toggleStar, toggleDraft } = useSidebarCollections(userId, workspaceId);
  const [renaming, setRenaming] = useState<Pick<Page, 'id' | 'title'> | null>(null);
  const [title, setTitle] = useState('');
  const [creation, setCreation] = useState<{ teamspaceId?: string; parentId: string | null; resolve: (id: string | null) => void } | null>(null);
  const [appearance, setAppearance] = useState<{ page: Page; mode: 'icon' | 'cover' } | null>(null);
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
    if (action === 'toggle-draft') { const wasDraft = collections.drafts.includes(id); toggleDraft(id); notify('success', wasDraft ? '已移出草稿' : '已加入草稿'); return; }
    if (action === 'toggle-star') { toggleStar(id); return; }
    if (!canEdit) { notify('error', '没有修改文档的权限'); return; }
    if (action === 'rename') { setRenaming(page); setTitle(page.title); }
    if (action === 'trash') void operations.recyclePage(id);
    if (action === 'create-child') void create(page.teamspaceId, id);
    if (action === 'set-icon' || action === 'set-cover') setAppearance({ page, mode: action === 'set-icon' ? 'icon' : 'cover' });
    if (action === 'move-up' || action === 'move-down' || action === 'indent' || action === 'outdent') void operations.movePageByKeyboard(id, action === 'move-up' ? 'up' : action === 'move-down' ? 'down' : action);
  }
  const dialogs = <>
    {creation ? <NavigationDialogPortal><CreateDocumentDialog teamspaces={teamspaces} target={creation} onClose={closeCreation} onCreate={submitCreation} /></NavigationDialogPortal> : null}
    {renaming ? <NavigationDialogPortal><ModalDialog open title="重命名文档" onClose={closeRename} footer={<><DialogButton onClick={closeRename}>取消</DialogButton><DialogButton variant="primary" disabled={operations.hasPending(renaming.id)} onClick={() => { void operations.renamePage(renaming.id, title).then(closeRename); }}>保存</DialogButton></>}><NameField label="文档名称" value={title} onChange={setTitle} autoFocus maxLength={500} /></ModalDialog></NavigationDialogPortal> : null}
    {appearance ? <NavigationDialogPortal><PageAppearanceDialog key={`${appearance.page.id}:${appearance.mode}`} open page={appearance.page} mode={appearance.mode} onClose={() => setAppearance(null)} onApply={(id, patch) => void operations.updateAppearance(id, patch)} /></NavigationDialogPortal> : null}
  </>;
  return { operations, create, act, dialogs };
}
