'use client';

import { CaretRight, CircleNotch, UserCircle } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIdentity } from '../identity-provider';

export function AccountItem({ compact = false }: { compact?: boolean }) {
  const { session, openSignIn } = useIdentity();
  const user = session.status === 'authenticated' ? session.user : null;
  const label = user?.name ?? (session.status === 'checking' ? '正在确认身份' : '未登录');
  const detail = user?.email ?? (session.status === 'error' ? '服务暂不可用，点击重试登录' : '登录以使用你的账户');
  const button = <button type="button" data-session-status={session.status} aria-busy={session.status === 'checking'} aria-label={user ? `Fouc 账户：${user.name}` : '登录 Fouc 账户'} onClick={openSignIn} className={`flex w-full items-center rounded-lg text-left transition-colors hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${compact ? 'justify-center p-2' : 'gap-2.5 px-2 py-2.5'}`}>
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] shadow-sm">
      {user ? <span className="text-xs font-medium text-[var(--accent-ink)]">{Array.from(user.name)[0]?.toUpperCase()}</span> : session.status === 'checking' ? <CircleNotch className="size-4 animate-spin" /> : <UserCircle size={22} weight="duotone" />}
    </span>
    {!compact ? <><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[var(--ink)]">{label}</span><span className="mt-0.5 block truncate text-[10.5px] text-[var(--muted)]">{detail}</span></span><CaretRight className="size-3.5 shrink-0 text-[var(--muted)]" /></> : null}
  </button>;
  return compact ? <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : button;
}
