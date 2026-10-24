'use client';

import { useState } from 'react';
import { CaretDown, Check, Hash, Plus, Star } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSearch, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ChannelWorkbench } from './use-channel-workbench';
import { ChannelIcon } from './channel-ui';
import styles from './channels.module.css';

export function ChannelSwitcher({ workbench: w }: { workbench: ChannelWorkbench }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites'>('all');
  const { t, channel } = w;
  const term = search.trim().toLocaleLowerCase();
  const channels = w.channels.filter(item =>
    `${item.name} ${item.description}`.toLocaleLowerCase().includes(term)
    && (filter !== 'favorites' || w.preferences.favorites.includes(item.id))
    && (filter !== 'unread' || item.id !== channel?.id && Date.parse(item.updatedAt) > Date.parse(w.preferences.read[item.id] ?? '1970-01-01')))
    .sort((a, b) => Number(w.preferences.favorites.includes(b.id)) - Number(w.preferences.favorites.includes(a.id)));
  return <DropdownMenu open={open} onOpenChange={value => { setOpen(value); if (!value) setSearch(''); }}>
    <DropdownMenuTrigger className={styles.channelTrigger} aria-label={t('switchChannel')}>
      {channel ? <ChannelIcon channel={channel} size={21} /> : <Hash size={17} />}<span>{channel?.name ?? t('channels')}</span><CaretDown size={11} />
    </DropdownMenuTrigger>
    {open && <DropdownMenuContent align="start" density="compact" className={styles.channelMenu}>
      <DropdownMenuSearch value={search} onValueChange={setSearch} placeholder={t('searchChannels')} clearLabel={t('clearSearch')} />
      <div className={styles.switchFilters} role="group" aria-label={t('channels')}>{(['all', 'unread', 'favorites'] as const).map(value => <button type="button" className="fouc-action" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(value)}</button>)}</div>
      <div className={styles.channelOptions}>{channels.map(item => <DropdownMenuItem key={item.id} className={styles.channelOption} onSelect={() => w.select(item.id)}>
        <ChannelIcon channel={item} size={18} /><span>{item.name}</span>{item.id !== channel?.id && !w.preferences.muted.includes(item.id) && Date.parse(item.updatedAt) > Date.parse(w.preferences.read[item.id] ?? '1970-01-01') && <i className={styles.unreadMarker} aria-label={t('unread')} />}{w.preferences.favorites.includes(item.id) && <Star size={11} />}{item.id === channel?.id && <Check size={12} />}
      </DropdownMenuItem>)}{!channels.length && <div className={styles.switchEmpty}>{t(w.directory.isLoading ? 'loading' : w.directory.isError ? 'loadError' : search || filter !== 'all' ? 'noMatch' : 'noChannelYet')}</div>}{w.directory.isError && <DropdownMenuItem onSelect={event => { event.preventDefault(); void w.directory.refetch(); }}>{t('retry')}</DropdownMenuItem>}</div>
      <DropdownMenuSeparator /><DropdownMenuItem disabled={!w.canUse} onSelect={() => w.setModal('create')}><Plus size={14} />{t('new')}</DropdownMenuItem>
    </DropdownMenuContent>}
  </DropdownMenu>;
}
