'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationClient } from '@/features/workspaces/organization-client';
import { organizationErrorTextOf } from '@/features/workspaces/organization-errors';
import { organizationQueryKeys } from './keys';
import { DialogButton, ModalDialog, NameField } from './ui';

export function CreateKnowledgeBaseDialog({ workspaceId, open, onClose, onCreated }: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => organizationClient.createKnowledgeBase(workspaceId, { name: name.trim() }),
    onSuccess: async (base) => {
      await queryClient.invalidateQueries({ queryKey: organizationQueryKeys.knowledgeBases(workspaceId) });
      onCreated(base.id);
      setName('');
      onClose();
    },
  });
  function close() { if (!mutation.isPending) { setName(''); mutation.reset(); onClose(); } }
  function submit() { if (name.trim() && !mutation.isPending) mutation.mutate(); }
  return <ModalDialog open={open} onClose={close} title="新建知识库" description="在当前工作空间创建独立知识库，并初始化文档文件夹。" footer={<><DialogButton disabled={mutation.isPending} onClick={close}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || mutation.isPending} onClick={submit}>{mutation.isPending ? '创建中…' : '创建知识库'}</DialogButton></>}>
    <NameField label="知识库名称" value={name} onChange={setName} onSubmit={submit} autoFocus placeholder="输入知识库名称" maxLength={120} />
    {mutation.isError ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">{organizationErrorTextOf(mutation.error)}</p> : null}
  </ModalDialog>;
}
