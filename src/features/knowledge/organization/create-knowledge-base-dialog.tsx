'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateWorkspaceMutation } from './hooks';
import { organizationClient, type TeamspaceAccess } from './client';
import { organizationQueryKeys } from './keys';
import { organizationErrorTextOf } from './errors';
import { DefaultAccessField } from './default-access-field';
import { DialogButton, ModalDialog, NameField } from './ui';

export function CreateKnowledgeBaseDialog({ open, onClose, onCreated, notify }: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  notify: (kind: 'success' | 'error', text: string) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'personal' | 'team'>('team');
  const [access, setAccess] = useState<TeamspaceAccess>('edit');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateWorkspaceMutation();
  const queryClient = useQueryClient();
  function close() {
    if (busy) return;
    if (createdId) onCreated(createdId);
    setName(''); setKind('team'); setAccess('edit'); setCreatedId(null); setError(null); mutation.reset(); onClose();
  }
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const id = createdId ?? (await mutation.mutateAsync({ name: name.trim(), kind })).id;
      setCreatedId(id);
      await organizationClient.createTeamspace(id, { name: '文档', defaultAccess: access });
      await queryClient.invalidateQueries({ queryKey: organizationQueryKeys.teamspaces(id) });
      onCreated(id);
      notify('success', '知识库已创建');
      setName(''); setKind('team'); setAccess('edit'); setCreatedId(null); onClose();
    } catch (cause) { setError(`创建未完成：${organizationErrorTextOf(cause)}；可重试设置权限。`); }
    finally { setBusy(false); }
  }
  return <ModalDialog open={open} onClose={close} title="新建知识库" description="选择个人或团队知识库，并设置初始文档文件夹的访问权限。" footer={<><DialogButton disabled={busy} onClick={close}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || busy} onClick={() => void submit()}>{busy ? '创建中…' : createdId ? '重试设置权限' : '创建知识库'}</DialogButton></>}>
    <NameField label="知识库名称" value={name} onChange={setName} onSubmit={() => void submit()} autoFocus placeholder="输入知识库名称" maxLength={120} />
    <fieldset disabled={busy || !!createdId} className="mt-4"><legend className="mb-2 text-[11px] font-medium text-[var(--muted-strong)]">知识库类型</legend><div className="grid grid-cols-2 gap-2">
      {(['personal', 'team'] as const).map((value) => <label key={value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${kind === value ? 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)]' : 'border-[var(--line)]'}`}><input type="radio" name="library-kind" checked={kind === value} onChange={() => setKind(value)} className="accent-[var(--accent)]" /><span><span className="block text-[12px] font-medium">{value === 'personal' ? '个人知识库' : '团队知识库'}</span><span className="mt-1 block text-[11px] text-[var(--muted-strong)]">{value === 'personal' ? '整理个人资料' : '管理成员与群组，协作编辑'}</span></span></label>)}
    </div></fieldset>
    <DefaultAccessField value={access} onChange={setAccess} disabled={busy} />
    {error ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">{error}</p> : null}
  </ModalDialog>;
}
