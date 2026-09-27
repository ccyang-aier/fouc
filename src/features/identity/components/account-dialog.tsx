'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useIdentity } from '../identity-provider';
import { AuthEntryContent } from './auth-entry-content';
import { Button } from '@/components/ui/button';

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
  const { session } = useIdentity();
  if (session.status !== 'authenticated') return null;
  return <div className="text-center">
    <div aria-hidden className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xl font-medium text-[var(--accent-ink)]">{Array.from(session.user.name)[0]?.toUpperCase()}</div>
    <h2 className="text-lg font-semibold">{session.user.name}</h2>
    <p className="mt-1 text-xs text-[var(--muted)]">{session.user.email}</p>
    <p className="mt-5 rounded-xl bg-[var(--surface-subtle)] p-4 text-xs leading-6 text-[var(--muted-strong)]">这是你的 Fouc 账户。所有模块共用此身份，具体操作由所在知识库、项目和资源的授权决定。</p>
  </div>;
}
