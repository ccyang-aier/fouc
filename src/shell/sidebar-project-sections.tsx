'use client';

import { ChatCircleDots, DotsThree, Hash, Plus, SortAscending, ChatsCircle } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { chatConversationTitle, deleteChatConversation, pinChatConversation, renameChatConversation, useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useProjectResources } from '@/features/project/project-resources';
import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/navigation-sidebar.messages';
import { SidebarSection } from './sidebar-section';
import { SidebarEntryDialog, type SidebarEntryAction } from './sidebar-entry-dialog';
import { SidebarEntryRow } from './sidebar-entry-row';
import { saveSidebarChannels, useSidebarChannels, type SidebarChannel } from './sidebar-channels';
import styles from './sidebar-sections.module.css';

type EntryAction = (SidebarEntryAction & { kind: 'create'; resource: 'channel' }) | (SidebarEntryAction & { kind: 'rename' | 'delete'; id: string });

export function SidebarProjectSections({ onNewChat, onAllChats, onOpenChat }: { onNewChat: () => void; onAllChats: () => void; onOpenChat: (entry: ChatHistoryEntry) => void }) {
  const { t, locale } = useTranslation(messages);
  const { scopeKey } = useProjectResources();
  const { notify } = useAppAlert();
  const history = useChatHistory();
  const channels = useSidebarChannels(scopeKey);
  const [editing, setEditing] = useState<EntryAction | null>(null);
  // Mount menus only when opened so their portal host follows native dialogs.
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  function saveChannels(next: SidebarChannel[]) {
    if (!scopeKey) return false;
    try { saveSidebarChannels(scopeKey, next); return true; }
    catch { notify('error', t('频道保存失败')); return false; }
  }
  function confirm(name: string) {
    if (!scopeKey || !editing) return false;
    if (editing.resource === 'channel') {
      if (editing.kind === 'delete') return saveChannels(channels.filter(item => item.id !== editing.id));
      if (editing.kind === 'rename') return saveChannels(channels.map(item => item.id === editing.id ? { ...item, name } : item));
      return saveChannels([...channels, { id: crypto.randomUUID(), name }]);
    }
    if (editing.kind === 'delete') deleteChatConversation(scopeKey, editing.id);
    else renameChatConversation(scopeKey, editing.id, name);
    return true;
  }
  function action(label: string, onClick: () => void, child: ReactNode) {
    return <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.action}`} aria-label={label} onClick={onClick} disabled={!scopeKey}>{child}</button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
  }
  function newChannel() { setEditing({ kind: 'create', resource: 'channel', name: '' }); }
  const sortedChannels = [...channels].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  return <>
    <SidebarSection title={t('频道')} actions={<>
      <DropdownMenu open={channelMenuOpen} onOpenChange={setChannelMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('频道更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{channelMenuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuGroup>
        <DropdownMenuItem disabled={!scopeKey} onSelect={newChannel}><Plus />{t('新建频道')}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem disabled={channels.length < 2} onSelect={() => saveChannels([...channels].sort((a, b) => a.name.localeCompare(b.name, locale)))}><SortAscending />{t('按名称排序')}</DropdownMenuItem>
      </DropdownMenuGroup></DropdownMenuContent>}</DropdownMenu>
      {action(t('新建频道'), newChannel, <Plus size={15} />)}
    </>}>
      {channels.length ? <div className={styles.list}>{sortedChannels.map(channel => {
        const rename = () => setEditing({ kind: 'rename', resource: 'channel', id: channel.id, name: channel.name });
        return <SidebarEntryRow key={channel.id} name={channel.name} label={t('编辑频道名称', { name: channel.name })} icon={<Hash size={15} className="sidebar-nav-icon shrink-0" aria-hidden />} pinned={channel.pinned} onOpen={rename} onPin={() => saveChannels(channels.map(item => item.id === channel.id ? { ...item, pinned: !item.pinned } : item))} onRename={rename} onDelete={() => setEditing({ kind: 'delete', resource: 'channel', id: channel.id, name: channel.name })} />;
      })}</div> : <p className={styles.empty}>{t('暂无频道')}</p>}
    </SidebarSection>
    <SidebarSection title={t('最近')} actions={<>
      <DropdownMenu open={recentMenuOpen} onOpenChange={setRecentMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('最近更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{recentMenuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuGroup><DropdownMenuItem disabled={!scopeKey} onSelect={onAllChats}><ChatsCircle weight="duotone" />{t('查看全部对话')}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent>}</DropdownMenu>
      {action(t('新对话'), onNewChat, <Plus size={15} />)}
    </>}>
      {history.length ? <div className={styles.list}>{history.slice(0, 6).map(entry => {
        const name = chatConversationTitle(entry);
        return <SidebarEntryRow key={entry.id} name={name} icon={<ChatCircleDots size={15} weight="duotone" className="sidebar-nav-icon shrink-0" aria-hidden />} pinned={entry.pinned} onOpen={() => onOpenChat(entry)} onPin={() => { if (scopeKey) pinChatConversation(scopeKey, entry.id, !entry.pinned); }} onRename={() => setEditing({ kind: 'rename', resource: 'chat', id: entry.id, name })} onDelete={() => setEditing({ kind: 'delete', resource: 'chat', id: entry.id, name })} />;
      })}</div> : <p className={styles.empty}>{t('暂无最近对话')}</p>}
    </SidebarSection>
    {editing && <SidebarEntryDialog action={editing} nameExists={editing.resource === 'channel' ? name => channels.some(item => (editing.kind === 'create' || item.id !== editing.id) && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()) : undefined} onConfirm={confirm} onClose={() => setEditing(null)} />}
  </>;
}
