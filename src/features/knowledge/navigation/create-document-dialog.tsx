'use client';

import { useState } from 'react';
import type { Page, Teamspace } from '@fouc/shared/knowledge/contracts';
import { DialogButton, ModalDialog, NameField } from '../organization/ui';

export type DocumentCreation = { teamspaceId?: string; parentId: string | null; title: string; kind: 'doc' | 'database'; icon: string | null; cover: string | null; inheritsPermissions: boolean };

export function CreateDocumentDialog({ teamspaces, pages, target, onClose, onCreate }: {
  teamspaces: readonly Teamspace[];
  pages: readonly Page[];
  target: { teamspaceId?: string; parentId: string | null };
  onClose: () => void;
  onCreate: (input: DocumentCreation) => Promise<string | null>;
}) {
  const [folderId, setFolderId] = useState(target.teamspaceId ?? teamspaces[0]?.id ?? '');
  const [parentId, setParentId] = useState(target.parentId ?? '');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'doc' | 'database'>('doc');
  const [icon, setIcon] = useState('');
  const [cover, setCover] = useState('');
  const [inherits, setInherits] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const fieldClass = 'mt-1.5 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-2 text-[12px] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]';
  async function submit() {
    if (busy || !title.trim()) return;
    setBusy(true); setFailed(false);
    const id = await onCreate({ teamspaceId: folderId || undefined, parentId: parentId || null, title: title.trim(), kind, icon: icon.trim() || null, cover: cover.trim() || null, inheritsPermissions: inherits });
    setBusy(false);
    if (id) onClose(); else setFailed(true);
  }
  return <ModalDialog open title="新建文档" onClose={() => { if (!busy) onClose(); }} footer={<><DialogButton disabled={busy} onClick={onClose}>取消</DialogButton><DialogButton variant="primary" disabled={busy || !title.trim()} onClick={() => void submit()}>{busy ? '创建中…' : '创建文档'}</DialogButton></>}>
    <fieldset disabled={busy} className="grid gap-4">
      <NameField label="文档名称" value={title} onChange={setTitle} onSubmit={() => void submit()} autoFocus maxLength={500} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px]">文件夹<select aria-label="文件夹" className={fieldClass} value={folderId} onChange={(event) => { setFolderId(event.target.value); setParentId(''); }}>{!teamspaces.length ? <option value="">自动创建文档文件夹</option> : teamspaces.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
        <label className="text-[11px]">父页面<select aria-label="父页面" className={fieldClass} value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">文件夹根目录</option>{pages.filter((page) => page.teamspaceId === folderId && !page.deletedAt).map((page) => <option key={page.id} value={page.id}>{page.title || '无标题页面'}</option>)}</select></label>
      </div>
      <label className="text-[11px]">页面类型<select aria-label="页面类型" className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as 'doc' | 'database')}><option value="doc">文档</option><option value="database">数据库</option></select></label>
      <div className="grid grid-cols-2 gap-3"><NameField label="图标（可选）" value={icon} onChange={setIcon} placeholder="例如：📚" maxLength={200} /><NameField label="封面（可选）" value={cover} onChange={setCover} placeholder="图片 URL" maxLength={2048} /></div>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--line)] p-3"><input type="checkbox" checked={inherits} onChange={(event) => setInherits(event.target.checked)} className="mt-0.5 accent-[var(--accent)]" /><span><span className="block text-[12px] font-medium">继承父页面或文件夹权限</span><span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted-strong)]">{inherits ? '使用上级的成员授权与默认权限。' : '不继承上级授权；创建者保留完全控制，其他成员需单独授权。'}</span></span></label>
    </fieldset>
    {failed ? <p role="alert" className="mt-3 text-[12px] text-[var(--err-ink)]">创建失败，请检查错误提示后重试。</p> : null}
  </ModalDialog>;
}
