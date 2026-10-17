'use client';

import { ChatCircleDots, DotsThree, Plus, SortAscending, ChatsCircle } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useAppAlert } from '@/components/app-alert-provider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useProjectResources } from '@/features/project/project-resources';
import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/navigation-sidebar.messages';
import { SidebarSection } from './sidebar-section';
import { SidebarTagDialog } from './sidebar-tag-dialog';
import { saveSidebarTags, useSidebarTags, type SidebarTag } from './sidebar-tags';
import styles from './sidebar-sections.module.css';

export function SidebarProjectSections({ services, onNewChat, onAllChats, onOpenChat }: { services: ReactNode; onNewChat: () => void; onAllChats: () => void; onOpenChat: (entry: ChatHistoryEntry) => void }) {
  const { t, locale } = useTranslation(messages);
  const { scopeKey } = useProjectResources();
  const { notify } = useAppAlert();
  const history = useChatHistory();
  const tags = useSidebarTags(scopeKey);
  const [editing, setEditing] = useState<SidebarTag | 'new' | null>(null);
  // Resolve the portal host when opening, after any native tag dialog has closed.
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  function saveTags(next: SidebarTag[]) {
    if (!scopeKey) return false;
    try { saveSidebarTags(scopeKey, next); return true; }
    catch { notify('error', t('标签保存失败')); return false; }
  }
  function action(label: string, onClick: () => void, child: ReactNode) {
    return <Tooltip><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.action}`} aria-label={label} onClick={onClick} disabled={!scopeKey}>{child}</button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>;
  }
  return <>
    <SidebarSection title={t('服务')}>{services}</SidebarSection>
    <SidebarSection title={t('标签')} actions={<>
      <DropdownMenu open={tagMenuOpen} onOpenChange={setTagMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('标签更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{tagMenuOpen && <DropdownMenuContent side="right" align="start" density="compact">
        <DropdownMenuItem disabled={!scopeKey} onSelect={() => setEditing('new')}><Plus />{t('新建标签')}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem disabled={tags.length < 2} onSelect={() => saveTags([...tags].sort((a, b) => a.name.localeCompare(b.name, locale)))}><SortAscending />{t('按名称排序')}</DropdownMenuItem>
      </DropdownMenuContent>}</DropdownMenu>
      {action(t('新建标签'), () => setEditing('new'), <Plus size={15} />)}
    </>}>
      {tags.length ? <div className={styles.list}>{tags.map(tag => <button type="button" key={tag.id} className={`sidebar-nav-row ${styles.row}`} aria-label={t('编辑标签名称', { name: tag.name })} onClick={() => setEditing(tag)}><span className={styles.dot} /><span>{tag.name}</span></button>)}</div> : <p className={styles.empty}>{t('暂无标签')}</p>}
    </SidebarSection>
    <SidebarSection title={t('最近')} actions={<>
      <DropdownMenu open={recentMenuOpen} onOpenChange={setRecentMenuOpen}><DropdownMenuTrigger className={styles.action} aria-label={t('最近更多操作')}><DotsThree size={17} weight="bold" /></DropdownMenuTrigger>{recentMenuOpen && <DropdownMenuContent side="right" align="start" density="compact"><DropdownMenuItem disabled={!scopeKey} onSelect={onAllChats}><ChatsCircle weight="duotone" />{t('查看全部对话')}</DropdownMenuItem></DropdownMenuContent>}</DropdownMenu>
      {action(t('新对话'), onNewChat, <Plus size={15} />)}
    </>}>
      {history.length ? <div className={styles.list}>{history.slice(0, 6).map(entry => <button type="button" key={entry.id} onClick={() => onOpenChat(entry)} className={`sidebar-nav-row ${styles.row}`} title={entry.submissions[0]?.text}><ChatCircleDots size={15} weight="duotone" className="sidebar-nav-icon shrink-0" /><span>{entry.submissions[0]?.text}</span></button>)}</div> : <p className={styles.empty}>{t('暂无最近对话')}</p>}
    </SidebarSection>
    {editing && <SidebarTagDialog tag={editing === 'new' ? null : editing} tags={tags} onSave={tag => saveTags([...tags.filter(item => item.id !== tag.id), tag])} onRemove={id => saveTags(tags.filter(tag => tag.id !== id))} onClose={() => setEditing(null)} />}
  </>;
}
