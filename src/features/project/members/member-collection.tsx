'use client';

import { ArrowRight } from '@phosphor-icons/react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import cardStyles from '@/components/ui/resource-card.module.css';
import { joinedDate, memberPortraits, type DirectoryMember, type MemberStatus } from './members.data';
import { messages } from './members.messages';
import styles from './members.module.css';

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const { t } = useTranslation(messages);
  return <span className={styles.badge} data-status={status}>{t(status)}</span>;
}
export function MemberPortrait({ member, className }: { member: DirectoryMember; className?: string }) {
  const image = member.portrait === null ? null : memberPortraits[member.portrait];
  return <UserAvatar name={member.name} image={image} className={cn(styles.avatar, className)} />;
}
export function MemberCollection({ members, mode, onOpen }: { members: DirectoryMember[]; mode: 'grid' | 'list'; onOpen: (member: DirectoryMember) => void }) {
  const { t, locale } = useTranslation(messages);
  if (mode === 'list') return <div className={styles.tableScroll}><table className={styles.table} aria-label={t('list')}>
    <thead><tr><th>{t('name')}</th><th>{t('department')}</th><th>{t('joined')}</th><th>{t('email')}</th><th>{t('status')}</th><th><span className="sr-only">{t('details')}</span></th></tr></thead>
    <tbody>{members.map(member => <tr key={member.id}>
      <td><button type="button" className={`fouc-action ${styles.person}`} onClick={() => onOpen(member)}><MemberPortrait member={member} className={styles.listAvatar} /><span><span>{member.name}</span><small>{member.position}</small></span></button></td>
      <td>{member.department}</td><td>{joinedDate(member.joinedOn, locale)}</td><td>{member.email}</td><td><MemberStatusBadge status={member.status} /></td>
      <td><button type="button" className={`fouc-action ${styles.detailButton}`} aria-label={t('open', { name: member.name })} onClick={() => onOpen(member)}><ArrowRight size={18} /></button></td>
    </tr>)}</tbody>
  </table></div>;
  return <ul className={styles.grid} aria-label={t('grid')}>{members.map(member => <li key={member.id} className={styles.cardFrame}>
    <button type="button" className={cn(cardStyles.card, styles.card)} aria-label={t('open', { name: member.name })} onClick={() => onOpen(member)}>
      <span className={styles.cardTop}><MemberPortrait member={member} /><MemberStatusBadge status={member.status} /></span>
      <strong className={styles.memberName}>{member.name}</strong>
      <span className={styles.position}>{member.position || '—'}</span>
      <span className={styles.memberFacts}>
        <span><span>{t('department')}</span><span>{member.department || '—'}</span></span>
        <span><span>{t('joined')}</span><time dateTime={member.joinedOn}>{joinedDate(member.joinedOn, locale)}</time></span>
      </span>
      <span className={styles.cardFooter}><span className={styles.contact}><span>{member.email}</span><span>{member.phone || '—'}</span></span><ArrowRight size={18} aria-hidden /></span>
    </button>
  </li>)}</ul>;
}
