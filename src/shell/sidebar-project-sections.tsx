'use client';

import { ChatCircleDots, DotsThree, Hash, Plus, SortAscending, ChatsCircle } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useProjectResources } from '@/features/project/project-resources';
import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/navigation-sidebar.messages';
import { SidebarSection } from './sidebar-section';
import { SidebarChannelDialog } from './sidebar-channel-dialog';
import { saveSidebarChannels, useSidebarChannels, type SidebarChannel } from './sidebar-channels';
import styles from './sidebar-sections.module.css';

export function SidebarProjectSections({ onNewChat, onAllChats, onOpenChat }: { onNewChat: () => void; onAllChats: () => void; onOpenChat: (entry: ChatHistoryEntry) => void }) {
  const { t, locale } = useTranslation(messages);
  const { scopeKey } = useProjectResources();
  const { notify } = useAppAlert();
  const history = useChatHistory();
  const channels = useSidebarChannels(scopeKey);
  const [editing, setEditing] = useState<SidebarChannel | 'new' | null>(null);
  // Resolve the portal host when opening, after any native channel dialog has closed.
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  function saveChannels(next: SidebarChannel[]) {
    if (!scopeKey) return false;
    try { saveSidebarChannels(scopeKey, next); return true; }
    catch { notify('error', t('频道保存失败')); return false; }
  }
  function action(label: string, onClick: () => void, child: ReactNode) {
    return <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.action}`} aria-label={label} onClick={onClick} disabled={!scopeKey}>{child}</button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
  }
  return <>
    <SidebarSection title={t('频道')} actions={<>
      <DropdownMenu open={channelMenuOpen} onOpenChange={setChannelMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('频道更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{channelMenuOpen && <DropdownMenuContent side="right" align="start" density="compact">
        <DropdownMenuItem disabled={!scopeKey} onSelect={() => setEditing('new')}><Plus />{t('新建频道')}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem disabled={channels.length < 2} onSelect={() => saveChannels([...channels].sort((a, b) => a.name.localeCompare(b.name, locale)))}><SortAscending />{t('按名称排序')}</DropdownMenuItem>
      </DropdownMenuContent>}</DropdownMenu>
      {action(t('新建频道'), () => setEditing('new'), <Plus size={15} />)}
    </>}>
      {channels.length ? <div className={styles.list}>{channels.map(channel => <button type="button" key={channel.id} className={`sidebar-nav-row ${styles.row}`} aria-label={t('编辑频道名称', { name: channel.name })} onClick={() => setEditing(channel)}><Hash size={15} className="sidebar-nav-icon shrink-0" aria-hidden /><span>{channel.name}</span></button>)}</div> : <p className={styles.empty}>{t('暂无频道')}</p>}
    </SidebarSection>
    <SidebarSection title={t('最近')} actions={<>
      <DropdownMenu open={recentMenuOpen} onOpenChange={setRecentMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('最近更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{recentMenuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuItem disabled={!scopeKey} onSelect={onAllChats}><ChatsCircle weight="duotone" />{t('查看全部对话')}</DropdownMenuItem></DropdownMenuContent>}</DropdownMenu>
      {action(t('新对话'), onNewChat, <Plus size={15} />)}
    </>}>
      {history.length ? <div className={styles.list}>{history.slice(0, 6).map(entry => <button type="button" key={entry.id} onClick={() => onOpenChat(entry)} className={`sidebar-nav-row ${styles.row}`} title={entry.submissions[0]?.text}><ChatCircleDots size={15} weight="duotone" className="sidebar-nav-icon shrink-0" /><span>{entry.submissions[0]?.text}</span></button>)}</div> : <p className={styles.empty}>{t('暂无最近对话')}</p>}
    </SidebarSection>
    {editing && <SidebarChannelDialog channel={editing === 'new' ? null : editing} channels={channels} onSave={channel => saveChannels([...channels.filter(item => item.id !== channel.id), channel])} onRemove={id => saveChannels(channels.filter(channel => channel.id !== id))} onClose={() => setEditing(null)} />}
  </>;
}
