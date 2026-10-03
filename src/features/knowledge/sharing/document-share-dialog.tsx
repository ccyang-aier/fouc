'use client';

import { useState } from 'react';
import { LinkSimple } from '@phosphor-icons/react';
import { DialogButton, ModalDialog } from '../organization/ui';
import { documentLink, type DocumentLinkTarget } from '../editor/document-link';

export function DocumentShareDialog({ title, target, onClose }: { title: string; target: DocumentLinkTarget; onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const link = documentLink(window.location.href, target);
  async function copy() {
    try { await navigator.clipboard.writeText(link); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <ModalDialog open title="分享文档" description="已有访问权限的成员可以通过链接打开文档。" onClose={onClose} footer={<><DialogButton onClick={onClose}>关闭</DialogButton><DialogButton variant="primary" autoFocus onClick={() => void copy()}>复制链接</DialogButton></>}>
    <p className="truncate text-[13px] font-medium text-[var(--ink)]" title={title}>{title || '无标题文档'}</p>
    <label className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[var(--muted-strong)]"><LinkSimple size={16} weight="bold" className="shrink-0" aria-hidden /><input aria-label="文档分享链接" className="min-w-0 flex-1 bg-transparent text-xs text-[var(--ink-soft)] outline-none" readOnly value={link} onFocus={event => event.target.select()} /></label>
    {status !== 'idle' && <p role={status === 'failed' ? 'alert' : 'status'} className="text-xs text-[var(--muted-strong)]">{status === 'copied' ? '已复制链接' : '复制失败，请选择链接后手动复制。'}</p>}
  </ModalDialog>;
}
