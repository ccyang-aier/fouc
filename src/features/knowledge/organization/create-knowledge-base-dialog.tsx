'use client';

import { useState } from 'react';
import { useCreateWorkspaceMutation } from './hooks';
import { DialogButton, ModalDialog, NameField, mutationErrorText } from './ui';

/** The original library creation UI uses the workspace API as its storage boundary. */
export function CreateKnowledgeBaseDialog({ open, onClose, onCreated, notify }: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const [name, setName] = useState('');
  const mutation = useCreateWorkspaceMutation();
  function close() { setName(''); mutation.reset(); onClose(); }
  async function submit() {
    if (!name.trim() || mutation.isPending) return;
    try {
      const base = await mutation.mutateAsync({ name: name.trim(), kind: 'personal' });
      onCreated(base.id);
      notify('success', '知识库已创建');
      close();
    } catch (error) { notify('error', mutationErrorText('创建知识库', error)); }
  }
  return <ModalDialog open={open} onClose={close} title="新建知识库" footer={<><DialogButton onClick={close}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || mutation.isPending} onClick={() => void submit()}>{mutation.isPending ? '创建中…' : '创建知识库'}</DialogButton></>}><NameField label="知识库名称" value={name} onChange={setName} onSubmit={() => void submit()} autoFocus placeholder="输入知识库名称" maxLength={120} /></ModalDialog>;
}
