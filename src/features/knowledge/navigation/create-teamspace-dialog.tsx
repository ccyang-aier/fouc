'use client';

import { useState } from 'react';
import { useCreateTeamspaceMutation } from '../organization/hooks';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import { organizationErrorTextOf } from '../organization/errors';
import type { Teamspace } from '../organization/client';

export function CreateTeamspaceDialog({ workspaceId, open, onClose, onCreated }: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (folder: Teamspace) => void;
}) {
  const [name, setName] = useState('');
  const mutation = useCreateTeamspaceMutation(workspaceId);
  function close() { setName(''); mutation.reset(); onClose(); }
  function submit() {
    if (!name.trim() || mutation.isPending) return;
    mutation.mutate({ name: name.trim(), defaultAccess: 'edit' }, { onSuccess: (folder) => { onCreated(folder); close(); } });
  }
  return <ModalDialog open={open} onClose={close} title="新建文件夹" footer={<><DialogButton onClick={close}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || mutation.isPending} onClick={submit}>{mutation.isPending ? '创建中…' : '创建文件夹'}</DialogButton></>}><NameField label="文件夹名称" value={name} onChange={setName} onSubmit={submit} autoFocus placeholder="输入文件夹名称" />{mutation.isError ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">{organizationErrorTextOf(mutation.error)}</p> : null}</ModalDialog>;
}
