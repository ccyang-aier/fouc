"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '@/features/identity/identity-provider';
import { knowledgeCatalogClient } from '../data/knowledge-catalog-client';
import { organizationErrorTextOf } from './errors';
import { organizationQueryKeys } from './keys';
import { DialogButton, ModalDialog, NameField } from './ui';

export function CreateKnowledgeBaseDialog({ open, onClose, onCreated, onCreateLocal, initialSource = 'local' }: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, source: 'local' | 'server') => void;
  onCreateLocal: (name: string) => string;
  initialSource?: 'local' | 'server';
}) {
  const { session } = useIdentity();
  const [name, setName] = useState('');
  const [source, setSource] = useState<'local' | 'server'>(initialSource);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => source === 'local' ? { id: onCreateLocal(name.trim()) } : knowledgeCatalogClient.createKnowledgeBase({ name: name.trim() }),
    onSuccess: async (base) => {
      if (source === 'server') await queryClient.invalidateQueries({ queryKey: organizationQueryKeys.knowledgeBases });
      onCreated(base.id, source);
      setName('');
      onClose();
    },
  });
  function close() { if (!mutation.isPending) { setName(''); mutation.reset(); onClose(); } }
  function submit() { if (name.trim() && !mutation.isPending) mutation.mutate(); }
  return <ModalDialog open={open} onClose={close} title="新建知识库" footer={<><DialogButton disabled={mutation.isPending} onClick={close}>取消</DialogButton><DialogButton variant="primary" disabled={!name.trim() || mutation.isPending || (source === 'server' && session.status !== 'authenticated')} onClick={submit}>{mutation.isPending ? '创建中…' : '创建知识库'}</DialogButton></>}>
    <NameField label="知识库名称" value={name} onChange={setName} onSubmit={submit} autoFocus placeholder="输入知识库名称" maxLength={120} />
    {session.status === 'authenticated' ? <label className="mt-4 flex flex-col gap-1.5 text-[11px] text-[var(--muted-strong)]">保存位置<select value={source} onChange={event => setSource(event.target.value as 'local' | 'server')} disabled={mutation.isPending} className="h-8 cursor-pointer rounded border border-[var(--control-border)] bg-[var(--panel)] px-2 text-[12px] outline-none focus:border-[var(--accent)]"><option value="local">本机</option><option value="server">服务端</option></select></label> : null}
    {mutation.isError ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">{source === 'local' ? '本机保存失败，请检查浏览器存储空间。' : organizationErrorTextOf(mutation.error)}</p> : null}
  </ModalDialog>;
}
