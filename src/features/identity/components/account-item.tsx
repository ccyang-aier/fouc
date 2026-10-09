'use client';

import { ArrowsLeftRight, CaretDown, CaretRight, Check, CircleNotch, SignOut, User, UserCircle } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user-avatar';
import { useIdentity } from '../identity-provider';
import { presenceDisplay, presenceOptions } from '../presence';
import { LogoutConfirmDialog } from './logout-confirm-dialog';
import styles from './account-item.module.css';

export function AccountItem({ compact = false }: { compact?: boolean }) {
  const { session, openSignIn, openSwitchAccount, presence, presencePreference, setPresence } = useIdentity();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const openingDialog = useRef(false);
  const user = session.status === 'authenticated' ? session.user : null;
  const label = user?.name ?? (session.status === 'checking' ? '正在确认身份' : '未登录');
  const detail = session.status === 'error' ? '登录服务暂不可用' : '登录你的 Fouc 账户';
  const status = presenceDisplay(presence);
  const button = <button
    type="button"
    data-account-trigger
    data-session-status={session.status}
    data-presence={user ? presence : undefined}
    aria-busy={session.status === 'checking'}
    aria-label={user ? `Fouc 账户：${user.name} · ${status.label}` : session.status === 'error' ? '登录服务暂不可用，点击重试登录' : '登录 Fouc 账户'}
    onClick={user ? undefined : openSignIn}
    className={`fouc-action ${styles.trigger} ${compact ? styles.compact : ''}`}
  >
    <span aria-hidden className={`${styles.avatarWrap} ${!user ? styles.guestAvatar : ''}`}>
      {user ? <UserAvatar name={user.name} image={user.image} className={styles.avatar} /> : session.status === 'checking' ? <CircleNotch size={17} className="animate-spin" /> : <User size={18} />}
      {user ? <span className={styles.presence} style={{ backgroundColor: status.color }}>
        {presence === 'do-not-disturb' ? <span className={styles.presenceDash} /> : presence === 'away' ? <span className={styles.presenceHole} /> : null}
      </span> : null}
    </span>
    {!compact ? <>
      <span className={styles.identityText}>
        <span className={styles.name}>{label}</span>
        <span className={styles.detail}>{user ? <>{status.label}<span aria-hidden className={styles.detailDivider}>·</span>Fouc 账户</> : detail}</span>
      </span>
      <span aria-hidden className={styles.chevron}>{user ? <CaretDown size={14} /> : <CaretRight size={14} />}</span>
    </> : null}
  </button>;
  if (!user) return compact ? <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right">{label} · {detail}</TooltipContent></Tooltip> : button;

  return <>
    <DropdownMenu>
    {compact ? <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger></TooltipTrigger><TooltipContent side="right">{label} · {status.label}</TooltipContent></Tooltip> : <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>}
    <DropdownMenuContent
      side={compact ? 'right' : 'top'}
      align="start"
      sideOffset={8}
      className={styles.menu}
      onCloseAutoFocus={(event) => { if (openingDialog.current) { event.preventDefault(); openingDialog.current = false; } }}
    >
      <div className={styles.menuHeader}>
        <span className={`${styles.avatarWrap} ${styles.menuAvatar}`}><UserAvatar name={user.name} image={user.image} className={`${styles.avatar} ${styles.menuAvatar}`} /><span aria-hidden className={styles.presence} style={{ backgroundColor: status.color }} /></span>
        <div className={styles.identityText}><p className={styles.menuName}>{user.name}</p><p className={styles.menuEmail}>{user.email}</p></div>
      </div>
      <DropdownMenuSeparator className={styles.separator} />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={styles.menuItem}>
          <span aria-hidden className={styles.statusDot} style={{ backgroundColor: status.color }} />
          {status.label}
          <span className={styles.menuHint}>设置状态</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={styles.statusMenu}>
          <DropdownMenuLabel>当前设备状态</DropdownMenuLabel>
          {presenceOptions.map((option) => <DropdownMenuItem key={option.value} role="menuitemradio" aria-checked={presencePreference === option.value} className={styles.statusItem} onSelect={() => setPresence(option.value)}>
            <span aria-hidden className={styles.statusDot} style={{ backgroundColor: option.color }} />
            <span className={styles.statusText}><span>{option.label}</span><span className={styles.statusDescription}>{option.description}</span></span>
            {presencePreference === option.value ? <Check weight="bold" /> : null}
          </DropdownMenuItem>)}
          <p className={styles.statusNote}>在线时，5 分钟无操作自动显示离开。</p>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem className={styles.menuItem} onSelect={() => { openingDialog.current = true; openSignIn(); }}><UserCircle />个人信息</DropdownMenuItem>
      <DropdownMenuItem className={styles.menuItem} onSelect={() => { openingDialog.current = true; openSwitchAccount(); }}><ArrowsLeftRight />切换账户</DropdownMenuItem>
      <DropdownMenuSeparator className={styles.separator} />
      <DropdownMenuItem variant="destructive" className={styles.menuItem} onSelect={() => { openingDialog.current = true; setLogoutOpen(true); }}><SignOut />退出登录</DropdownMenuItem>
    </DropdownMenuContent>
    </DropdownMenu>
    <LogoutConfirmDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
  </>;
}
