'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useIdentity } from '../identity-provider';
import { AuthEntryContent } from './auth-entry-content';
import { Button } from '@/components/ui/button';
import { foucAuthApi } from '../auth-api';
import { authErrorCopyFor } from '../auth-errors';
import { presenceDisplay } from '../presence';

/** Native dialog supplies focus trapping, Escape and focus restoration without another overlay system. */
export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { session, signOut } = useIdentity();
  const [signingOut, setSigningOut] = useState(false);
  async function exitAccount() {
    setSigningOut(true);
    try { await signOut(); } catch { /* The provider displays the failure and retains the identity. */ }
    finally { setSigningOut(false); }
  }
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-label={session.status === 'authenticated' ? 'Fouc 账户' : '登录 Fouc'} className="m-auto max-h-[calc(100dvh-40px)] w-[420px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-0 text-[var(--ink)] shadow-[0_28px_100px_rgba(20,30,40,0.22)] backdrop:bg-black/25 backdrop:backdrop-blur-[5px]">
    {open ? <div className="relative px-8 pb-8 pt-9">
      <button type="button" aria-label="关闭账户窗口" onClick={onClose} className="absolute right-4 top-4 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"><X size={16} /></button>
      {session.status === 'authenticated' ? <AccountDetails /> : <AuthEntryContent targetPath={window.location.pathname + window.location.search} onSuccess={onClose} />}
      {session.status === 'authenticated' ? <Button variant="outline" className="mt-6 w-full" disabled={signingOut} aria-busy={signingOut} onClick={() => void exitAccount()}>{signingOut ? '正在退出…' : '退出登录'}</Button> : null}
    </div> : null}
  </dialog>;
}

function AccountDetails() {
  const { session, refresh, presence } = useIdentity();
  const [name, setName] = useState(session.status === 'authenticated' ? session.user.name : '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  if (session.status !== 'authenticated') return null;
  const user = session.user;
  const status = presenceDisplay(presence);
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await foucAuthApi.updateProfile({ name: name.trim() });
      await refresh();
      setFeedback({ error: false, text: '个人信息已保存' });
    } catch (error) { setFeedback({ error: true, text: authErrorCopyFor(error).description }); }
    finally { setSaving(false); }
  }
  return <div className="text-center">
    <div aria-hidden className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xl font-medium text-[var(--accent-ink)]">{Array.from(session.user.name)[0]?.toUpperCase()}</div>
    <h2 className="text-lg font-semibold">个人信息</h2>
    <p className="mt-1 text-xs text-[var(--muted)]">管理你的 Fouc 账户资料</p>
    <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: status.color }} />{status.label}</span>
    <form onSubmit={(event) => void saveProfile(event)} className="mt-6 space-y-4 text-left">
      <label className="block text-xs text-[var(--muted-strong)]">显示名称<input aria-label="显示名称" required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setFeedback(null); }} className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--focus-ring)]" /></label>
      <div><p className="text-xs text-[var(--muted-strong)]">邮箱</p><p className="mt-2 flex items-center justify-between rounded-lg bg-[var(--surface-subtle)] px-3 py-3 text-xs"><span className="truncate">{user.email}</span><span className="ml-2 shrink-0 text-[10px] text-[#35a879]">已验证</span></p></div>
      {feedback ? <p role={feedback.error ? 'alert' : 'status'} className={`text-xs ${feedback.error ? 'text-[#c05c64]' : 'text-[#35a879]'}`}>{feedback.text}</p> : null}
      <Button type="submit" className="w-full" disabled={saving || !name.trim() || name.trim() === user.name} aria-busy={saving}>{saving ? '正在保存…' : '保存修改'}</Button>
    </form>
  </div>;
}
