'use client';

import { ArrowRight } from '@phosphor-icons/react';
import type { ProjectMember } from '@fouc/shared/projects';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import cardStyles from '@/components/ui/resource-card.module.css';
import { messages } from './members.messages';
import styles from './members.module.css';

export function MemberRoleBadge({ role }: { role: ProjectMember['role'] }) {
  const { t } = useTranslation(messages);
  return <span className={styles.badge} data-role={role}>{t(role)}</span>;
}

export function MemberCollection({ members, actorId, mode, onOpen }: {
  members: ProjectMember[]; actorId: string; mode: 'grid' | 'list'; onOpen: (member: ProjectMember) => void;
}) {
  const { t, locale } = useTranslation(messages);
  const joined = (member: ProjectMember) => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(member.joinedAt));
  if (mode === 'list') return <div className={styles.tableScroll}><table className={styles.table} aria-label={t('list')}>
    <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('joined')}</th><th><span className="sr-only">{t('details')}</span></th></tr></thead>
    <tbody>{members.map(member => <tr key={member.userId}>
      <td><button type="button" className={`fouc-action ${styles.person}`} onClick={() => onOpen(member)}><UserAvatar name={member.name} image={member.image} className={styles.listAvatar} /><span><span>{member.name}</span>{member.userId === actorId && <small>{t('you')}</small>}</span></button></td>
      <td>{member.email}</td><td><MemberRoleBadge role={member.role} /></td><td><time dateTime={member.joinedAt}>{joined(member)}</time></td>
      <td><button type="button" className={`fouc-action ${styles.detailButton}`} aria-label={t('open', { name: member.name })} onClick={() => onOpen(member)}><ArrowRight size={18} /></button></td>
    </tr>)}</tbody>
  </table></div>;
  return <ul className={styles.grid} aria-label={t('grid')}>{members.map(member => <li key={member.userId}>
    <button type="button" className={cn(cardStyles.card, styles.card)} aria-label={t('open', { name: member.name })} onClick={() => onOpen(member)}>
      <span className={styles.cardTop}><UserAvatar name={member.name} image={member.image} className={styles.avatar} /><MemberRoleBadge role={member.role} /></span>
      <strong className={styles.memberName}><span>{member.name}</span>{member.userId === actorId && <small>{t('you')}</small>}</strong>
      <span className={styles.position}>{t('positionUnset')}</span>
      <span className={styles.memberFacts}>
        <span><span>{t('department')}</span><span className={styles.unset}>{t('notProvided')}</span></span>
        <span><span>{t('joining')}</span><time dateTime={member.joinedAt}>{joined(member)}</time></span>
      </span>
      <span className={styles.cardFooter}><span className={styles.contact}><span>{member.email}</span><span>{t('phoneUnset')}</span></span><ArrowRight size={19} aria-hidden /></span>
    </button>
  </li>)}</ul>;
}
