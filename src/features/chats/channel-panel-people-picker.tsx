'use client';

import { useState } from 'react';
import type { ProjectMember } from '@fouc/shared/projects';
import { Check, MagnifyingGlass } from '@phosphor-icons/react';
import { UserAvatar } from '@/components/user-avatar';
import { useTranslation } from '@/lib/i18n';
import { panelMessages } from './channel-panels.messages';
import styles from './channel-panels.module.css';

export function ChannelPeoplePicker({ people, selected, onChange, emptyLabel, autoFocus = false }: {
  people: ProjectMember[]; selected: string[]; onChange: (ids: string[]) => void; emptyLabel?: string; autoFocus?: boolean;
}) {
  const { t } = useTranslation(panelMessages);
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase();
  const matching = people.filter(person => `${person.name} ${person.email}`.toLocaleLowerCase().includes(term));
  return <div className={styles.picker}>
    <div className={styles.search}><MagnifyingGlass size={16} aria-hidden /><input data-autofocus={autoFocus ? '' : undefined} aria-label={t('searchPeople')} placeholder={t('searchPeople')} value={search} onChange={event => setSearch(event.target.value)} /></div>
    <div className={styles.peopleOptions} role="group" aria-label={t('addPeople')}>
      {matching.map(person => <button key={person.userId} type="button" className={`fouc-action ${styles.personOption}`} data-surface="plain" aria-pressed={selected.includes(person.userId)} onClick={() => onChange(selected.includes(person.userId) ? selected.filter(id => id !== person.userId) : [...selected, person.userId])}>
        <UserAvatar name={person.name} image={person.image} className={styles.smallAvatar} />
        <span className={styles.personIdentity}><strong>{person.name}</strong><small>{person.email}</small></span>
        <span className={styles.checkBox} aria-hidden>{selected.includes(person.userId) && <Check size={12} weight="bold" />}</span>
      </button>)}
      {!matching.length && <p className={styles.emptySmall}>{emptyLabel && !term ? emptyLabel : t('noPeople')}</p>}
    </div>
  </div>;
}
