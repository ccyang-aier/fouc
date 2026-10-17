'use client';

import type { ReactNode } from 'react';
import { Archive, BookOpenText, ChatCircleDots, ChatsCircle, GearSix, ListChecks, Planet, PlugsConnected, Plus, Question, Robot, SidebarSimple, SquaresFour, UsersThree } from '@phosphor-icons/react';
import { AccountItem } from '@/features/identity/components/account-item';
import { ProjectSwitcher } from '@/features/project/project-switcher';
import { useChatHistory, type ChatHistoryEntry } from '@/features/home/chat/chat-history';
import { FoucMark } from '@/components/fouc-mark';
import { NavButton, type SidebarRowItem } from '@/components/nav-button';
import { SidebarResizeHandle, useSidebarWidth } from '@/components/sidebar-resize';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { WorkbenchView } from './workbench-view';
import { messages } from './i18n/navigation-sidebar.messages';

export function NavigationSidebar({ open, onCollapse, onExpand, view, onViewChange, onProjectChange, onOpenChat }: {
  open: boolean; onCollapse: () => void; onExpand: () => void;
  view: WorkbenchView; onViewChange: (view: WorkbenchView) => void;
  onProjectChange: () => void; onOpenChat: (entry: ChatHistoryEntry) => void;
}) {
  const { t } = useTranslation(messages);
  const { width, dragging, startResize } = useSidebarWidth();
  const history = useChatHistory();
  const primary: Array<SidebarRowItem & { id: WorkbenchView }> = [
    { id: 'workbench', label: t('工作台'), icon: SquaresFour },
    { id: 'tasks', label: t('任务'), icon: ListChecks },
    { id: 'members', label: t('成员'), icon: UsersThree },
    { id: 'assets', label: t('资产'), icon: Archive },
    { id: 'chats', label: t('聊天'), icon: ChatsCircle },
    { id: 'agents', label: 'Agents', icon: Robot },
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
    <div className={cn('shrink-0 py-3', open ? 'px-3' : 'px-1')}><ProjectSwitcher compact={!open} onSwitch={onProjectChange} /></div>
    <ScrollArea className="min-h-0 flex-1" viewportClassName={open ? 'px-3 pb-4' : 'px-1 pb-3'}>
      <div className="mb-3">{row({ id: 'home', label: t('新对话'), icon: Plus })}</div>
      <nav aria-label={t('项目导航')} className="space-y-0.5">{primary.map(row)}</nav>
      <div className="mt-5">
        {open ? <SectionCaption>{t('服务')}</SectionCaption> : <div className="mx-2 my-3 border-t border-[var(--line)]" />}
        <nav aria-label={t('服务')} className="mt-1 space-y-0.5">{services.map(row)}</nav>
      </div>
      {open && <>
        <section className="mt-5" aria-label={t('标签')}><SectionCaption>{t('标签')}</SectionCaption><p className="px-2 pt-1 text-[11px] leading-6 text-[var(--muted)]">{t('暂无标签')}</p></section>
        <section className="mt-4" aria-label={t('最近')}><SectionCaption>{t('最近')}</SectionCaption>
          {history.length ? <div className="mt-1 space-y-0.5">{history.slice(0, 6).map(entry => <button type="button" key={entry.id} onClick={() => onOpenChat(entry)} className="sidebar-nav-row flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[11px]" title={entry.submissions[0]?.text}><ChatCircleDots size={15} weight="duotone" className="sidebar-nav-icon shrink-0" /><span className="truncate">{entry.submissions[0]?.text}</span></button>)}</div> : <p className="px-2 pt-1 text-[11px] leading-6 text-[var(--muted)]">{t('暂无最近对话')}</p>}
        </section>
      </>}
    </ScrollArea>
    <footer className={cn('shrink-0 space-y-0.5 pt-2', open ? 'px-3' : 'px-1')}>
      {row({ id: 'settings', label: t('设置'), icon: GearSix })}
      {row({ id: 'help', label: t('帮助与反馈'), icon: Question })}
      <div className={cn('mt-2 border-t border-[var(--line)] py-2', !open && 'flex justify-center')}><AccountItem compact={!open} /></div>
    </footer>
    {open && <SidebarResizeHandle dragging={dragging} onPointerDown={startResize} />}
  </aside>;
}

function SectionCaption({ children }: { children: ReactNode }) {
  return <h2 className="flex h-6 items-center px-2 text-[11px] font-medium text-[var(--muted)]">{children}</h2>;
}
