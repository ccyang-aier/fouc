'use client';

import { Archive, BookOpenText, ChatCircleDots, ChatsCircle, GearSix, ListChecks, Planet, PlugsConnected, Robot, SidebarSimple, SquaresFour, UsersThree } from '@phosphor-icons/react';
import { AccountItem } from '@/features/identity/components/account-item';
import { ProjectSwitcher } from '@/features/project/project-switcher';
import type { ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { useProjectResources } from '@/features/project/project-resources';
import { FoucMark } from '@/components/fouc-mark';
import { NavButton, type SidebarRowItem } from '@/components/nav-button';
import { SidebarResizeHandle, useSidebarWidth } from '@/components/sidebar-resize';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { WorkbenchView } from './workbench-view';
import { messages } from './i18n/navigation-sidebar.messages';
import { SidebarProjectSections } from './sidebar-project-sections';
import { SidebarThemeSwitch } from './sidebar-theme-switch';
import styles from './sidebar-footer.module.css';

export function NavigationSidebar({ open, onCollapse, onExpand, view, onViewChange, onProjectChange, onOpenChat }: {
  open: boolean; onCollapse: () => void; onExpand: () => void;
  view: WorkbenchView; onViewChange: (view: WorkbenchView) => void;
  onProjectChange: () => void; onOpenChat: (entry: ChatHistoryEntry) => void;
}) {
  const { t } = useTranslation(messages);
  const { width, dragging, startResize } = useSidebarWidth(272);
  const { scopeKey } = useProjectResources();
  const primary: Array<SidebarRowItem & { id: WorkbenchView }> = [
    { id: 'home', label: t('新对话'), icon: ChatCircleDots },
    { id: 'workbench', label: t('工作台'), icon: SquaresFour },
    { id: 'tasks', label: t('任务'), icon: ListChecks },
    { id: 'members', label: t('成员'), icon: UsersThree },
    { id: 'assets', label: t('资产'), icon: Archive },
    { id: 'chats', label: t('聊天'), icon: ChatsCircle },
    { id: 'agents', label: t('智能体'), icon: Robot },
  ];
  const services: Array<SidebarRowItem & { id: WorkbenchView }> = [
    { id: 'community', label: t('社区'), icon: Planet },
    { id: 'connectors', label: t('连接器'), icon: PlugsConnected },
    { id: 'knowledge', label: t('知识库'), icon: BookOpenText },
  ];
  function row(item: SidebarRowItem & { id: WorkbenchView }) {
    const button = <NavButton item={item} active={view === item.id} compact={!open} onSelect={() => onViewChange(item.id)} />;
    return open ? <div key={item.id}>{button}</div> : <Tooltip key={item.id}><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent></Tooltip>;
  }
  return <aside aria-label={t(open ? '主导航' : '主导航（已收起）')} style={{ width: open ? width : 52 }} className={cn('sidebar-material relative flex h-full shrink-0 flex-col border-r border-[var(--wt-sidebar-edge)]', !dragging && 'transition-[width] duration-200 ease-out')}>
    <header className={cn('flex h-11 shrink-0 items-center border-b border-[var(--line)]', open ? 'px-3' : 'justify-center')}>
      {open ? <><FoucMark /><span className="ml-1.5 text-[13px] font-semibold">Fouc</span><button type="button" className="fouc-action ml-auto grid size-7 cursor-pointer place-items-center rounded-md text-[var(--muted-strong)]" aria-label={t('收起主导航')} onClick={onCollapse}><SidebarSimple size={16} weight="duotone" /></button></> : <button type="button" className="fouc-action grid size-8 cursor-pointer place-items-center rounded-md" aria-label={t('展开主导航')} onClick={onExpand}><FoucMark compact /></button>}
    </header>
    {open && <div className="shrink-0 px-3 py-3"><ProjectSwitcher onSwitch={onProjectChange} /></div>}
    <ScrollArea className="min-h-0 flex-1" viewportClassName={open ? 'px-3 pb-4' : 'px-1 pb-3 pt-3'}>
      <nav aria-label={t('项目导航')} className="flex flex-col gap-0.5">{primary.map(row)}</nav>
      <div role="separator" className="mx-2 my-3 border-t border-[var(--line)]" />
      {open && <SidebarProjectSections key={scopeKey ?? 'no-project'} onNewChat={() => onViewChange('home')} onAllChats={() => onViewChange('chats')} onOpenChat={onOpenChat} />}
    </ScrollArea>
    <footer className={cn('flex shrink-0 flex-col gap-0.5 pt-2', open ? 'px-3' : 'px-1')}>
      <nav aria-label={t('服务')} className="flex flex-col gap-0.5">{services.map(row)}</nav>
      <div className={styles.dock} data-compact={!open}>
        <div className={styles.account}><AccountItem compact={!open} /></div>
        {open && <><SidebarThemeSwitch />
        <Tooltip>
          <TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.iconButton}`} aria-label={t('设置')} aria-haspopup="dialog" onClick={() => onViewChange('settings')}><GearSix size={18} weight="duotone" aria-hidden /></button></TooltipTrigger>
          <TooltipContent side="top">{t('设置')}</TooltipContent>
        </Tooltip></>}
      </div>
    </footer>
    {open && <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} />}
  </aside>;
}
