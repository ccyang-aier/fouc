'use client';

import type { ComponentProps, ReactNode } from 'react';
import Image from 'next/image';
import { ChatCircleDots, Hash, Robot, User } from '@phosphor-icons/react';
import type { Channel, ChannelMember } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './channels.module.css';

export function ChannelIcon({ channel, size = 30 }: { channel?: Pick<Channel, 'color'>; size?: number }) {
  return <span className={styles.channelIcon} data-tone={channel?.color ?? 'violet'} style={{ width: size, height: size }}><Hash size={size * .57} weight="bold" aria-hidden /></span>;
}
export function ChannelAvatar({ member, size = 34 }: { member?: Pick<ChannelMember, 'name' | 'image' | 'kind'>; size?: number }) {
  return <span className={styles.avatar} data-kind={member?.kind} style={{ width: size, height: size }}>
    {member?.kind !== 'agent' && member?.name ? <UserAvatar name={member.name} image={member.image} className={styles.personAvatar} /> : member?.image ? <Image src={member.image} alt="" width={size} height={size} unoptimized /> : member?.kind === 'agent' ? <Robot size={size * .54} /> : <User size={size * .5} />}
  </span>;
}
export function ChannelTool({ label, children, ...props }: ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" data-surface="plain" {...props} aria-label={label}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
export function ChannelEmpty({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className={styles.empty}><span className={styles.emptyIcon}><ChatCircleDots size={29} weight="light" /></span><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>;
}
export function formatFileSize(size: number, locale = 'zh-CN') {
  if (size < 1024) return `${size} B`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size / (size < 1024 * 1024 ? 1024 : 1024 * 1024))} ${size < 1024 * 1024 ? 'KB' : 'MB'}`;
}
