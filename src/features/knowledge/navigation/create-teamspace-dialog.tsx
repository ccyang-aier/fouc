'use client';

import { useState } from 'react';
import { useCreateTeamspaceMutation } from '../organization/hooks';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';
import { organizationErrorTextOf } from '@/features/workspaces/organization-errors';
import type { Teamspace } from '@fouc/shared/knowledge/contracts';
import type { TeamspaceAccess } from '../data/knowledge-catalog-client';
import { DefaultAccessField } from '../organization/default-access-field';

export function CreateTeamspaceDialog({ workspaceId, knowledgeBaseId, open, onClose, onCreated }: {
  workspaceId: string;
  knowledgeBaseId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (folder: Teamspace) => void;
}) {
  const [name, setName] = useState('');
  const [access, setAccess] = useState<TeamspaceAccess>('edit');
  const mutation = useCreateTeamspaceMutation(workspaceId);
  function close() { setName(''); setAccess('edit'); mutation.reset(); onClose(); }
  function submit() {
    if (!name.trim() || mutation.isPending) return;
    mutation.mutate({ knowledgeBaseId, name: name.trim(), defaultAccess: access }, { onSuccess: (folder) => { onCreated(folder); close(); } });
  }
  return <ModalDialog open={open} onClose={close} title="新建文件夹" footer={<><DialogButton onClick={close}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || mutation.isPending} onClick={submit}>{mutation.isPending ? '创建中…' : '创建文件夹'}</DialogButton></>}><NameField label="文件夹名称" value={name} onChange={setName} onSubmit={submit} autoFocus placeholder="输入文件夹名称" /><DefaultAccessField value={access} onChange={setAccess} disabled={mutation.isPending} />{mutation.isError ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">{organizationErrorTextOf(mutation.error)}</p> : null}</ModalDialog>;
}
