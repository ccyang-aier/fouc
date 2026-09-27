'use client';

import { useState } from 'react';
import type { Page, Teamspace } from '@fouc/shared/knowledge/contracts';
import { useCreateTeamspaceMutation } from '../organization/hooks';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import type { DocumentAction } from '../dense-sidebar/document-action-menu-content';
import { usePageTreeOperations, type TreeNotifier } from './page-operations';
import { NavigationDialogPortal } from './navigation-dialog-portal';
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
  const { toggleStar } = useSidebarCollections(userId, workspaceId);
  const [renaming, setRenaming] = useState<Pick<Page, 'id' | 'title'> | null>(null);
  const [title, setTitle] = useState('');
  const [createdPageId, setCreatedPageId] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<{ page: Page; mode: 'icon' | 'cover' } | null>(null);
  async function create(teamspaceId?: string, parentId: string | null = null) {
    if (!canEdit) { notify('error', '没有创建文档的权限'); return null; }
    try {
      const folderId = teamspaceId ?? teamspaces[0]?.id ?? (await createFolder.mutateAsync({ name: '文档', defaultAccess: 'edit' })).id;
      const id = await operations.createPage({ teamspaceId: folderId, parentId });
      if (id) {
        setCreatedPageId(id);
        setRenaming({ id, title: '' });
        setTitle('');
      }
      return id;
    } catch {
      notify('error', '创建文档失败，请重试');
      return null;
    }
  }
  function closeRename() {
    setRenaming(null);
    if (createdPageId) onOpenPage(createdPageId);
    setCreatedPageId(null);
  }
  function act(id: string, action: DocumentAction) {
    const page = pages.find((item) => item.id === id);
    if (!page) return;
    if (action === 'toggle-star') { toggleStar(id); return; }
    if (!canEdit) { notify('error', '没有修改文档的权限'); return; }
    if (action === 'rename') { setRenaming(page); setTitle(page.title); }
    if (action === 'trash') void operations.recyclePage(id);
    if (action === 'create-child') void create(page.teamspaceId, id);
    if (action === 'set-icon' || action === 'set-cover') setAppearance({ page, mode: action === 'set-icon' ? 'icon' : 'cover' });
    if (action === 'move-up' || action === 'move-down' || action === 'indent' || action === 'outdent') void operations.movePageByKeyboard(id, action === 'move-up' ? 'up' : action === 'move-down' ? 'down' : action);
  }
  const dialogs = <>
    {renaming ? <NavigationDialogPortal><ModalDialog open title="重命名文档" onClose={closeRename} footer={<><DialogButton onClick={closeRename}>取消</DialogButton><DialogButton variant="primary" disabled={operations.hasPending(renaming.id)} onClick={() => { void operations.renamePage(renaming.id, title).then(closeRename); }}>保存</DialogButton></>}><NameField label="文档名称" value={title} onChange={setTitle} autoFocus maxLength={500} /></ModalDialog></NavigationDialogPortal> : null}
    {appearance ? <NavigationDialogPortal><PageAppearanceDialog key={`${appearance.page.id}:${appearance.mode}`} open page={appearance.page} mode={appearance.mode} onClose={() => setAppearance(null)} onApply={(id, patch) => void operations.updateAppearance(id, patch)} /></NavigationDialogPortal> : null}
  </>;
  return { operations, create, act, dialogs };
}
