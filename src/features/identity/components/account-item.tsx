'use client';

import { CaretRight, Check, CircleNotch, SignOut, UserCircle } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIdentity } from '../identity-provider';
import { presenceDisplay, presenceOptions } from '../presence';
import '@/components/sidebar-nav-row.css';

export function AccountItem({ compact = false }: { compact?: boolean }) {
  const { session, openSignIn, signOut, presence, presencePreference, setPresence } = useIdentity();
  const [signingOut, setSigningOut] = useState(false);
  const openingProfile = useRef(false);
  const user = session.status === 'authenticated' ? session.user : null;
  const label = user?.name ?? (session.status === 'checking' ? '正在确认身份' : '未登录');
  const detail = user?.email ?? (session.status === 'error' ? '服务暂不可用，点击重试登录' : '登录以使用你的账户');
  const status = presenceDisplay(presence);
  const button = <button type="button" data-session-status={session.status} data-presence={user ? presence : undefined} data-active={!compact ? 'true' : undefined} aria-busy={session.status === 'checking'} aria-label={user ? `Fouc 账户：${user.name} · ${status.label}` : '登录 Fouc 账户'} onClick={user ? undefined : openSignIn} className={`sidebar-nav-row flex w-full items-center rounded-[6px] text-left focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${compact ? 'justify-center p-1' : 'gap-2.5 px-2 py-1'}`}>
    <span aria-hidden className="relative flex size-7 shrink-0 items-center justify-center text-[var(--muted)]">
      {user ? <span className="text-sm font-semibold text-[var(--accent-ink)]">{Array.from(user.name)[0]?.toUpperCase()}</span> : session.status === 'checking' ? <CircleNotch className="size-4 animate-spin" /> : <UserCircle size={24} weight="duotone" />}
      {user ? <span className="absolute -bottom-px -right-px flex size-2.5 items-center justify-center rounded-full ring-2 ring-[var(--shell)]" style={{ backgroundColor: status.color }}>{presence === 'do-not-disturb' ? <span className="h-px w-1.5 bg-white" /> : presence === 'away' ? <span className="size-1 rounded-full bg-[var(--panel)]" /> : null}</span> : null}
    </span>
    {!compact ? <><span className="min-w-0 flex-1"><span className="block truncate text-[10.5px] font-medium leading-4 text-[var(--muted)]">{label}</span><span className="mt-0.5 block truncate text-[9.5px] leading-3 text-[var(--muted)]">{detail}</span></span><CaretRight className="size-3.5 shrink-0 text-[var(--muted)]" /></> : null}
  </button>;
  const trigger = compact ? <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right">{label}{user ? ` · ${status.label}` : ''}</TooltipContent></Tooltip> : button;
  if (!user) return trigger;
  async function exitAccount() {
    setSigningOut(true);
    try { await signOut(); } catch { /* IdentityProvider owns error feedback. */ }
    finally { setSigningOut(false); }
  }
  return <DropdownMenu>
    {compact ? <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger></TooltipTrigger><TooltipContent side="right">{label} · {status.label}</TooltipContent></Tooltip> : <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>}
    <DropdownMenuContent side={compact ? 'right' : 'top'} align="start" sideOffset={8} className="w-[228px] rounded-xl p-1.5" onCloseAutoFocus={(event) => { if (openingProfile.current) { event.preventDefault(); openingProfile.current = false; } }}>
      <div className="px-2.5 pb-2 pt-2"><p className="truncate text-xs font-semibold">{user.name}</p><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{user.email}</p></div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => { openingProfile.current = true; openSignIn(); }}><UserCircle />个人信息</DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger><span aria-hidden className="mr-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />{status.label}<span className="ml-auto mr-2 text-[10px] text-[var(--muted)]">设置状态</span></DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-[220px] rounded-xl p-1.5">
          <DropdownMenuLabel>当前设备状态</DropdownMenuLabel>
          {presenceOptions.map((option) => <DropdownMenuItem key={option.value} role="menuitemradio" aria-checked={presencePreference === option.value} className="h-auto min-h-10 gap-2.5 py-2" onSelect={() => setPresence(option.value)}>
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
            <span className="flex-1"><span className="block">{option.label}</span><span className="mt-0.5 block text-[10px] text-[var(--muted)]">{option.description}</span></span>
            {presencePreference === option.value ? <Check weight="bold" /> : null}
          </DropdownMenuItem>)}
          <p className="px-2.5 pb-2 pt-1 text-[10px] leading-4 text-[var(--muted)]">在线时，5 分钟无操作自动显示离开。</p>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={signingOut} onSelect={() => void exitAccount()} className="text-[#c05c64]"><SignOut />{signingOut ? '正在退出…' : '退出登录'}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
