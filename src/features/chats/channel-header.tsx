'use client';

import { BellSimpleSlash, ChatCircleDots, ChatCircleText, DotsThree, Files, Link, LockSimple, MagnifyingGlass, Plus, PushPin, Robot, SignOut, SlidersHorizontal, Star, Trash, UserPlus, UsersThree } from '@phosphor-icons/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChannelAvatar, ChannelTool } from './channel-ui';
import { ChannelSwitcher } from './channel-switcher';
import type { ChannelWorkbench } from './use-channel-workbench';
import styles from './channels.module.css';

export function ChannelHeader({ workbench: w }: { workbench: ChannelWorkbench }) {
  const { t, channel, snapshot } = w;
  const manager = snapshot?.actorRole === 'owner' || snapshot?.actorRole === 'admin';
  const canInvite = manager || channel?.permissions.invite === 'members';
  const active = snapshot?.members.filter(member => member.active) ?? [];
  const assets = snapshot?.messages.flatMap(message => message.attachments).length ?? 0;
  const favorite = channel ? w.preferences.favorites.includes(channel.id) : false;
  function toggleFavorite() { if (!channel) return; w.preferences.toggle('favorites', channel.id); w.notify('success', t(favorite ? 'favoriteRemoved' : 'favoriteSaved')); }
  return <>
    <header className={styles.header}>
      <span className={styles.chatLabel}><ChatCircleDots size={17} />{t('chats')}</span><span className={styles.headerDivider} />
      <ChannelSwitcher workbench={w} />
      {channel?.visibility === 'private' && <LockSimple className={styles.channelState} size={11} aria-label={t('private')} />}
      {channel && w.preferences.muted.includes(channel.id) && <BellSimpleSlash className={styles.channelState} size={12} aria-label={t('muted')} />}
      {channel?.description && <span className={styles.headerDescription}>{channel.description}</span>}
      <div className={styles.headerActions}>
        <ChannelTool label={t('new')} disabled={!w.canUse} onClick={() => w.setModal('create')}><Plus size={16} /></ChannelTool>
        {channel && <>
        <button type="button" className={`fouc-action ${styles.avatars}`} aria-label={t('members')} onClick={() => w.setTab('members')}>{active.slice(0, 3).map(member => <ChannelAvatar key={member.id} member={member} size={25} />)}<small>{active.length}</small></button>
        {canInvite && <ChannelTool label={t('addMembers')} onClick={() => w.setModal('invite')}><UserPlus size={17} /></ChannelTool>}
        <ChannelTool label={t('favorite')} aria-pressed={favorite} onClick={toggleFavorite}><Star size={17} weight={favorite ? 'fill' : 'regular'} /></ChannelTool>
        <ChannelTool label={t('searchMessages')} aria-pressed={w.panel === 'search'} onClick={() => { w.setTab('conversation'); w.setPanel(w.panel === 'search' ? null : 'search'); }}><MagnifyingGlass size={17} /></ChannelTool>
        <DropdownMenu><DropdownMenuTrigger className={styles.tool} aria-label={t('more')}><DotsThree size={21} /></DropdownMenuTrigger><DropdownMenuContent align="end" density="compact">
          <DropdownMenuItem onSelect={toggleFavorite}><Star />{t(favorite ? 'unfavorite' : 'favorite')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { const muted = w.preferences.muted.includes(channel.id); w.preferences.toggle('muted', channel.id); w.notify('success', t(muted ? 'unmuted' : 'muted')); }}><BellSimpleSlash />{t(w.preferences.muted.includes(channel.id) ? 'unmute' : 'mute')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { void w.action(async () => { const url = new URL(window.location.href); url.searchParams.set('view', 'chats'); url.searchParams.set('project', channel.projectId); url.searchParams.set('channel', channel.id); await navigator.clipboard.writeText(url.toString()); }, t('copied')); }}><Link />{t('copyLink')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { w.setTab('conversation'); w.setPanel('pins'); }}><PushPin />{t('pins')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void w.openAgentDialog()}><Robot />{t('addAgent')}</DropdownMenuItem>
          {manager && <DropdownMenuItem onSelect={() => w.setModal('settings')}><SlidersHorizontal />{t('settings')}</DropdownMenuItem>}
          {snapshot?.actorRole === 'owner' && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => w.setModal('deleteChannel')}><Trash />{t('deleteChannel')}</DropdownMenuItem></>}
          {snapshot && snapshot.actorRole !== 'owner' && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => w.setModal('leave')}><SignOut />{t('leave')}</DropdownMenuItem></>}
        </DropdownMenuContent></DropdownMenu></>}
      </div>
    </header>
    {channel && <nav className={styles.tabs} role="tablist" aria-label={channel.name}>
      {([{ key: 'conversation', Icon: ChatCircleDots }, { key: 'topics', Icon: ChatCircleText }, { key: 'assets', Icon: Files }, { key: 'members', Icon: UsersThree }] as const).map(({ key, Icon }) => <button type="button" role="tab" key={key} className={`fouc-action ${styles.tab}`} aria-selected={w.tab === key} onClick={() => { w.setTab(key); w.setPanel(null); }}><Icon size={15} />{t(key)}{key === 'assets' && assets > 0 && <small>{assets}</small>}{key === 'members' && <small>{active.length}</small>}</button>)}
    </nav>}
  </>;
}
