'use client';

import { useState } from 'react';
import type { Teamspace } from '@fouc/shared/knowledge/contracts';
import { PermissionSelect } from '../organization/permission-select';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';

export type DocumentCreation = { teamspaceId?: string; parentId: string | null; title: string; kind: 'doc' | 'database'; icon: string | null; cover: string | null; inheritsPermissions: boolean };

export function CreateDocumentDialog({ teamspaces, target, onClose, onCreate }: {
  teamspaces: readonly Teamspace[];
  target: { teamspaceId?: string; parentId: string | null };
  onClose: () => void;
  onCreate: (input: DocumentCreation) => Promise<string | null>;
}) {
  const folderId = target.teamspaceId ?? teamspaces[0]?.id;
  const parentId = target.parentId;
  const [title, setTitle] = useState('');
  const [inherits, setInherits] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit() {
    if (busy || !title.trim()) return;
    setBusy(true); setFailed(false);
    const id = await onCreate({ teamspaceId: folderId || undefined, parentId: parentId || null, title: title.trim(), kind: 'doc', icon: null, cover: null, inheritsPermissions: inherits });
    setBusy(false);
    if (id) onClose(); else setFailed(true);
  }
  return <ModalDialog open width="w-[440px] max-w-[calc(100vw-32px)]" title="新建文档" onClose={() => { if (!busy) onClose(); }} footer={<><DialogButton disabled={busy} onClick={onClose}>取消</DialogButton><DialogButton variant="primary" disabled={busy || !title.trim()} onClick={() => void submit()}>{busy ? '创建中…' : '创建文档'}</DialogButton></>}>
    <fieldset disabled={busy} className="grid gap-4">
      <NameField label="文档名称" value={title} onChange={setTitle} onSubmit={() => void submit()} autoFocus maxLength={500} />
      <p className="text-[11px] leading-relaxed text-[var(--muted-strong)]">用于记录文字、图片与丰富的内容。</p>
      <PermissionSelect label="文档权限" value={inherits ? 'inherit' : 'independent'} disabled={busy} onChange={(value) => setInherits(value === 'inherit')} options={[
        { value: 'inherit', label: '继承上级权限', description: '使用父页面或文件夹的成员授权与默认权限。' },
        { value: 'independent', label: '独立授权', description: '创建者保留完全控制，其他成员需单独授权。' },
      ]} />
    </fieldset>
    {failed ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">创建失败，请检查错误提示后重试。</p> : null}
  </ModalDialog>;
}
