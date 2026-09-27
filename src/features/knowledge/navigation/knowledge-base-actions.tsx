'use client';

import { useState } from 'react';
import { useRemoveTeamspaceMutation, useUpdateTeamspaceMutation } from '../organization/hooks';
import type { Teamspace } from '../organization/client';
import { ConfirmDialog, DialogButton, ModalDialog, NameField, mutationErrorText } from '../organization/ui';
import { NavigationDialogPortal } from './navigation-dialog-portal';
import type { TreeNotifier } from './page-operations';

export function KnowledgeBaseActions({ workspaceId, target, onClose, onRemoved, notify }: {
  workspaceId: string;
  target: { teamspace: Teamspace; action: 'rename' | 'delete' };
  onClose: () => void;
  onRemoved: (id: string) => void;
  notify: TreeNotifier;
}) {
  const [name, setName] = useState(target.teamspace.name);
  const update = useUpdateTeamspaceMutation(workspaceId);
  const remove = useRemoveTeamspaceMutation(workspaceId);
  async function submit() {
    if (update.isPending || remove.isPending || (target.action === 'rename' && !name.trim())) return;
    try {
      if (target.action === 'rename') {
        await update.mutateAsync({ id: target.teamspace.id, patch: { name: name.trim() } });
      } else {
        await remove.mutateAsync(target.teamspace.id);
        onRemoved(target.teamspace.id);
      }
      notify('success', target.action === 'rename' ? '知识库已重命名' : '知识库已删除');
      onClose();
    } catch (error) {
      notify('error', mutationErrorText(target.action === 'rename' ? '重命名知识库' : '删除知识库', error));
    }
  }
  if (target.action === 'delete') return <NavigationDialogPortal><ConfirmDialog open onClose={onClose} onConfirm={() => void submit()} title="删除知识库" body={`确定删除「${target.teamspace.name}」？仅空知识库可以删除；包含文档或回收站内容时，服务会拒绝删除。`} confirmLabel={remove.isPending ? '删除中…' : '删除'} busy={remove.isPending} /></NavigationDialogPortal>;
  return <NavigationDialogPortal><ModalDialog open onClose={onClose} title="重命名知识库" footer={<><DialogButton onClick={onClose}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || update.isPending} onClick={() => void submit()}>{update.isPending ? '保存中…' : '保存'}</DialogButton></>}><NameField label="知识库名称" value={name} onChange={setName} autoFocus onSubmit={() => void submit()} /></ModalDialog></NavigationDialogPortal>;
}
