'use client';

import { BellSimpleSlash, DotsThree, Link, MagnifyingGlass, PushPin, Robot, SignOut, SlidersHorizontal, Star, Trash, UserPlus } from '@/components/icons';
import type { ChannelMember } from '@fouc/shared/chats';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChannelAvatar, ChannelTool } from './channel-ui';
import type { ChannelWorkbench } from './use-channel-workbench';
import styles from './channels.module.css';

export function ChannelHeaderActions({ workbench: w, members }: { workbench: ChannelWorkbench; members: ChannelMember[] }) {
  const { t, channel, snapshot } = w;
  if (!channel) return null;
  const { id: channelId, projectId } = channel;
  const manager = snapshot?.actorRole === 'owner' || snapshot?.actorRole === 'admin';
  const favorite = w.preferences.favorites.includes(channel.id);
  const muted = w.preferences.muted.includes(channel.id);
  function toggleFavorite() { w.preferences.toggle('favorites', channelId); w.notify('success', t(favorite ? 'favoriteRemoved' : 'favoriteSaved')); }
  function copyLink() {
    void w.action(async () => {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'chats'); url.searchParams.set('project', projectId); url.searchParams.set('channel', channelId);
      await navigator.clipboard.writeText(url.toString());
    }, t('copied'));
  }
  return <div className={styles.headerActions}>
    <Button type="button" variant="ghost" data-surface="plain" className={styles.headerMembers} aria-label={t('activeMembers', { count: members.length })} aria-pressed={w.tab === 'members'} onClick={() => { w.setTab('members'); w.setPanel(null); }}>
      <span className={styles.headerPortraits} aria-hidden>{members.slice(0, 3).map(member => <ChannelAvatar key={member.id} member={member} size={20} />)}</span>
      <span>{t('activeMembers', { count: members.length })}</span>
    </Button>
    <span className={styles.headerActionDivider} aria-hidden />
    <ChannelTool className={styles.headerTool} label={t('searchMessages')} aria-pressed={w.panel === 'search'} onClick={() => { w.setTab('conversation'); w.setPanel(w.panel === 'search' ? null : 'search'); }}><MagnifyingGlass size={16} /></ChannelTool>
    <DropdownMenu><DropdownMenuTrigger className={`${styles.tool} ${styles.headerTool}`} aria-label={t('channelActions')}><DotsThree size={19} /></DropdownMenuTrigger><DropdownMenuContent className={styles.menu} align="end" density="compact">
      {(manager || channel.permissions.invite === 'members') && <DropdownMenuItem onSelect={() => w.setModal('invite')}><UserPlus />{t('addMembers')}</DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => void w.openAgentDialog()}><Robot />{t('addAgent')}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => { w.setTab('conversation'); w.setPanel('pins'); }}><PushPin />{t('pins')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={toggleFavorite}><Star />{t(favorite ? 'unfavorite' : 'favorite')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => { w.preferences.toggle('muted', channel.id); w.notify('success', t(muted ? 'unmuted' : 'muted')); }}><BellSimpleSlash />{t(muted ? 'unmute' : 'mute')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={copyLink}><Link />{t('copyLink')}</DropdownMenuItem>
      {manager && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => w.setModal('settings')}><SlidersHorizontal />{t('settings')}</DropdownMenuItem></>}
      {snapshot?.actorRole === 'owner' && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => w.setModal('deleteChannel')}><Trash />{t('deleteChannel')}</DropdownMenuItem></>}
      {snapshot && snapshot.actorRole !== 'owner' && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => w.setModal('leave')}><SignOut />{t('leave')}</DropdownMenuItem></>}
    </DropdownMenuContent></DropdownMenu>
  </div>;
}
