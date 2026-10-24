'use client';

import { ChatCircleDots, DotsThree, PencilSimple, Plus, PushPin, PushPinSlash, SortAscending, ChatsCircle, Trash } from '@phosphor-icons/react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Channel } from '@fouc/shared/chats';
import { useAppAlert } from '@/components/app-alert-provider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { chatConversationTitle, deleteChatConversation, pinChatConversation, renameChatConversation, useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useProjectResources } from '@/features/project/project-resources';
import { useChannelDirectory } from '@/features/chats/channel-data';
import { useChannelPreferences } from '@/features/chats/channel-preferences';
import { channelActiveView, requestChannelOpen } from '@/features/chats/channel-navigation';
import { ChannelIcon } from '@/features/chats/channel-ui';
import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/navigation-sidebar.messages';
import { SidebarSection } from './sidebar-section';
import { SidebarEntryDialog, type SidebarEntryAction } from './sidebar-entry-dialog';
import { SidebarEntryRow } from './sidebar-entry-row';
import styles from './sidebar-sections.module.css';

type EntryAction = SidebarEntryAction & { kind: 'rename' | 'delete'; resource: 'chat'; id: string };

function ChannelSidebarRow({ channel, scopeKey, principal, pinned, active, onPin }: {
  channel: Channel; scopeKey: string; principal: string; pinned: boolean; active: boolean; onPin: () => void;
}) {
  const { t } = useTranslation(messages);
  const [menuOpen, setMenuOpen] = useState(false);
  const PinIcon = pinned ? PushPinSlash : PushPin;
  const owner = channel.ownerId === principal;
  return <div className={`sidebar-nav-row ${styles.row}`} data-active={active} data-menu-open={menuOpen}>
    <button type="button" className={styles.entry} title={channel.name} aria-current={active ? 'page' : undefined} onClick={() => requestChannelOpen(scopeKey, channel.id)}><ChannelIcon channel={channel} size={16} /><span>{channel.name}</span></button>
    <div className={styles.rowActions}>
      <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.action}`} data-variant="nested" aria-label={t(pinned ? '取消置顶名称' : '置顶名称', { name: channel.name })} aria-pressed={pinned} onClick={onPin}><PinIcon size={14} weight="duotone" aria-hidden /></button></TooltipTrigger><TooltipContent side="top">{t(pinned ? '取消置顶' : '置顶')}</TooltipContent></Tooltip>
      {owner && <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><DropdownMenuTrigger className={styles.action} data-variant="nested" aria-label={t('条目更多操作', { name: channel.name })}><DotsThree size={17} weight="bold" aria-hidden /></DropdownMenuTrigger>
        {menuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuGroup><DropdownMenuItem onSelect={() => requestChannelOpen(scopeKey, channel.id, false, 'settings')}><PencilSimple />{t('重命名')}</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => requestChannelOpen(scopeKey, channel.id, false, 'delete')}><Trash />{t('删除')}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent>}
      </DropdownMenu>}
    </div>
  </div>;
}

export function SidebarProjectSections({ onNewChat, onAllChats, onOpenChat }: { onNewChat: () => void; onAllChats: () => void; onOpenChat: (entry: ChatHistoryEntry) => void }) {
  const { t, locale } = useTranslation(messages);
  const { scopeKey, principal } = useProjectResources();
  const { notify } = useAppAlert();
  const history = useChatHistory();
  const directory = useChannelDirectory();
  const preferences = useChannelPreferences(scopeKey);
  const activeView = useSyncExternalStore(channelActiveView.subscribe, channelActiveView.getSnapshot, channelActiveView.getServerSnapshot);
  const [sortByName, setSortByName] = useState(false);
  const [editing, setEditing] = useState<EntryAction | null>(null);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  const channels = sortByName ? (directory.data?.items ?? []).toSorted((a, b) => a.name.localeCompare(b.name, locale)) : directory.data?.items ?? [];
  function confirm(name: string) {
    if (!scopeKey || !editing) return false;
    if (editing.kind === 'delete') deleteChatConversation(scopeKey, editing.id);
    else renameChatConversation(scopeKey, editing.id, name);
    return true;
  }
  function action(label: string, onClick: () => void, child: ReactNode) {
    return <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.action}`} aria-label={label} onClick={onClick} disabled={!scopeKey}>{child}</button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
  }
  function newChannel() { if (scopeKey) requestChannelOpen(scopeKey, null, true); }
  function toggleChannelPin(channel: Channel) {
    try {
      const pinned = preferences.favorites.includes(channel.id);
      preferences.toggle('favorites', channel.id);
      notify('success', t(pinned ? '已取消置顶名称' : '已置顶名称', { name: channel.name }));
    } catch { notify('error', t('频道保存失败')); }
  }
  function toggleChatPin(entry: ChatHistoryEntry) {
    if (!scopeKey) return;
    pinChatConversation(scopeKey, entry.id, !entry.pinned);
    notify('success', t(entry.pinned ? '已取消置顶名称' : '已置顶名称', { name: chatConversationTitle(entry) }));
  }
  const pinnedChannels = channels.filter(channel => preferences.favorites.includes(channel.id));
  const unpinnedChannels = channels.filter(channel => !preferences.favorites.includes(channel.id));
  const pinnedChats = history.filter(entry => entry.pinned);
  const recentChats = history.filter(entry => !entry.pinned).slice(0, 6);
  function channelRow(channel: Channel) {
    return scopeKey && <ChannelSidebarRow key={`channel:${channel.id}`} channel={channel} scopeKey={scopeKey} principal={principal} pinned={preferences.favorites.includes(channel.id)} active={activeView?.scope === scopeKey && activeView.channelId === channel.id} onPin={() => toggleChannelPin(channel)} />;
  }
  function chatRow(entry: ChatHistoryEntry) {
    const name = chatConversationTitle(entry);
    return <SidebarEntryRow key={`chat:${entry.id}`} name={name} icon={<ChatCircleDots size={15} weight="duotone" className="sidebar-nav-icon shrink-0" aria-hidden />} pinned={entry.pinned} onOpen={() => onOpenChat(entry)} onPin={() => toggleChatPin(entry)} onRename={() => setEditing({ kind: 'rename', resource: 'chat', id: entry.id, name })} onDelete={() => setEditing({ kind: 'delete', resource: 'chat', id: entry.id, name })} />;
  }
  return <>
    {Boolean(pinnedChannels.length + pinnedChats.length) && <SidebarSection title={t('置顶分区')}><div className={styles.list}>{pinnedChannels.map(channelRow)}{pinnedChats.map(chatRow)}</div></SidebarSection>}
    <SidebarSection title={t('频道')} actions={<>
      <DropdownMenu open={channelMenuOpen} onOpenChange={setChannelMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('频道更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{channelMenuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuGroup>
        <DropdownMenuItem disabled={!scopeKey} onSelect={newChannel}><Plus />{t('新建频道')}</DropdownMenuItem><DropdownMenuItem disabled={!scopeKey} onSelect={onAllChats}><ChatsCircle />{t('查看全部对话')}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem disabled={channels.length < 2} onSelect={() => setSortByName(true)}><SortAscending />{t('按名称排序')}</DropdownMenuItem>
      </DropdownMenuGroup></DropdownMenuContent>}</DropdownMenu>
      {action(t('新建频道'), newChannel, <Plus size={15} />)}
    </>}>
      {unpinnedChannels.length ? <div className={styles.list}>{unpinnedChannels.map(channelRow)}</div> : directory.isError ? <button type="button" className={`fouc-action ${styles.empty}`} onClick={() => void directory.refetch()}>{t('重新加载')}</button> : <p className={styles.empty}>{t(channels.length ? '暂无其他频道' : '暂无频道')}</p>}
    </SidebarSection>
    <SidebarSection title={t('最近')} actions={<>
      <DropdownMenu open={recentMenuOpen} onOpenChange={setRecentMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('最近更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{recentMenuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuGroup><DropdownMenuItem disabled={!scopeKey} onSelect={onAllChats}><ChatsCircle weight="duotone" />{t('查看全部对话')}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent>}</DropdownMenu>
      {action(t('新对话'), onNewChat, <Plus size={15} />)}
    </>}>
      {recentChats.length ? <div className={styles.list}>{recentChats.map(chatRow)}</div> : <p className={styles.empty}>{t(history.length ? '暂无其他对话' : '暂无最近对话')}</p>}
    </SidebarSection>
    {editing && <SidebarEntryDialog action={editing} onConfirm={confirm} onClose={() => setEditing(null)} />}
  </>;
}
