'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { sessionExpiredEvent } from '@/lib/authenticated-fetch';
import { createIdentitySessionStore, type IdentitySession } from './session-store';
import { authErrorCopyFor } from './auth-errors';
import { AccountDialog } from './components/account-dialog';
import { createPresenceStore } from './presence-store';
import type { PresencePreference, PresenceStatus } from './presence';

type IdentityContextValue = {
  session: IdentitySession;
  refresh: () => Promise<IdentitySession>;
  completeSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  expireSession: () => void;
  openSignIn: () => void;
  presence: PresenceStatus;
  presencePreference: PresencePreference;
  setPresence: (value: PresencePreference) => void;
};
const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createIdentitySessionStore);
  const session = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const userId = session.status === 'authenticated' ? session.user.id : null;
  const presenceStore = useMemo(() => createPresenceStore(userId), [userId]);
  const presence = useSyncExternalStore(presenceStore.subscribe, presenceStore.getSnapshot, presenceStore.getServerSnapshot);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    void store.refresh();
    const onFocus = () => { void store.refresh(); };
    const onExpired = () => { if (store.getSnapshot().status === 'authenticated') { store.expire(); setNotice('登录已过期，你可以继续使用本机知识库'); } };
    window.addEventListener('focus', onFocus);
    window.addEventListener(sessionExpiredEvent, onExpired);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('fouc.identity');
      channel.current.onmessage = () => { void store.refresh(true); };
    }
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener(sessionExpiredEvent, onExpired); channel.current?.close(); };
  }, [store]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (session.status !== 'authenticated') return;
    const timer = window.setTimeout(() => { void store.refresh(true); }, Math.min(Math.max(0, Date.parse(session.expiresAt) - Date.now()), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [session, store]);
  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const refresh = useCallback(() => store.refresh(true), [store]);
  const openSignIn = useCallback(() => setDialogOpen(true), []);
  const completeSignIn = useCallback(async () => {
    await store.completeSignIn();
    setNotice('登录成功，欢迎回来');
    setDialogOpen(false);
    channel.current?.postMessage('session-changed');
  }, [store]);
  const signOut = useCallback(async () => {
    try {
      await store.signOut();
      setNotice('已退出登录，本机文档仍然保留');
      setDialogOpen(false);
      channel.current?.postMessage('session-changed');
    } catch (error) { setNotice(authErrorCopyFor(error).description); throw error; }
  }, [store]);
  const expireSession = useCallback(() => {
    store.expire();
    setNotice('登录已过期，你可以继续使用本机知识库');
  }, [store]);
  const value = useMemo<IdentityContextValue>(() => ({ session, refresh, openSignIn, completeSignIn, signOut, expireSession, presence: presence.status, presencePreference: presence.preference, setPresence: presenceStore.setPreference }), [session, refresh, openSignIn, completeSignIn, signOut, expireSession, presence, presenceStore]);
  return <IdentityContext.Provider value={value}>
    {children}
    <AccountDialog open={dialogOpen} onClose={closeDialog} />
    {notice ? <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[150] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-3 text-[12px] text-[var(--ink)] shadow-lg">{notice}</div> : null}
  </IdentityContext.Provider>;
}

export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('IdentityProvider must wrap the Fouc application.');
  return value;
}
