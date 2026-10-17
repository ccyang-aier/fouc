'use client';

import { type Locale } from '@/lib/i18n/locale';
import { createTranslator } from '@/lib/i18n/messages';
import { useTranslation } from '@/lib/i18n/react';
import { messages } from './i18n/sidebar-project-pane.messages';

import { useState } from 'react';
import {
  Pulse,
  ArrowLeft,
  CaretDown,
  ChatCircle,
  CheckCircle,
  Files,
  GearSix,
  House,
  Stack,
  Star,
  Target,
  UsersThree,
} from '@phosphor-icons/react';
import { NavButton, type SidebarRowItem } from '@/components/nav-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjectResources } from '@/features/project/project-resources';
import { useAppAlert } from '@/components/app-alert-provider';
import type { ProjectTab } from '@/features/project/project-data';
import type { ProjectManagementPanelId } from '@/features/project/project-management-model';
import { cn } from '@/lib/utils';

function getProjectPages(locale: Locale): (SidebarRowItem & { id: ProjectTab })[] {
  const uiText = createTranslator(messages, locale);
  return [
    { id: 'overview', label: uiText('交付总览'), icon: House },
    { id: 'work', label: uiText('交付目标'), icon: Target },
    { id: 'outputs', label: uiText('产物与证据'), icon: Files },
    { id: 'resources', label: uiText('资源与编排'), icon: Stack },
    { id: 'timeline', label: uiText('活动'), icon: Pulse },
  ];
}

export function ProjectSidebarPane({
  projectName,
  collapsed,
  activePanel,
  favorited,
  onFavoriteChange,
  onExit,
}: {
  projectName: string;
  collapsed: boolean;
  activePanel: ProjectManagementPanelId | null;
  onPanelChange: (panel: ProjectManagementPanelId | null) => void;
  favorited: boolean;
  onFavoriteChange: (favorited: boolean) => void;
  onExit: () => void;
}) {
  const { t: uiText, locale } = useTranslation(messages);
  const pages = getProjectPages(locale);
  const { selectedProject } = useProjectResources();
  const { notify } = useAppAlert();
  const [menuOpen, setMenuOpen] = useState(false);
  function unavailable() {
    notify('info', uiText('项目工作台尚未开放'));
  }
  function row(item: SidebarRowItem, active: boolean, onSelect: () => void) {
    const button = (
      <NavButton item={item} active={active} compact={collapsed} onSelect={onSelect} />
    );
    return collapsed ? (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ) : (
      <div key={item.id}>{button}</div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3">
        {row({ id: 'all-projects', label: uiText('所有项目'), icon: ArrowLeft }, false, onExit)}
      </div>
      <div className={cn('flex items-center gap-1 px-1', collapsed && 'justify-center px-0')}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={uiText('项目菜单')}
              aria-expanded={menuOpen}
              className={cn(
                'fouc-action flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg text-left outline-none',
                collapsed ? 'size-8 justify-center' : 'h-12 flex-1 px-2',
              )}
            >
              <Stack size={20} className="sidebar-nav-icon shrink-0" weight="duotone" />
              {collapsed ? null : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">{projectName}</span>
                    <span className="mt-1 block text-[10px] text-[var(--muted)]">
                      {selectedProject?.source === 'server'
                        ? uiText('团队项目')
                        : uiText('本机项目')}
                    </span>
                  </span>
                  <CaretDown size={12} className="text-[var(--muted)]" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>{projectName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onExit}>
              <ArrowLeft />
              {uiText('所有项目')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={unavailable}>
              <GearSix />
              {uiText('项目设置')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {collapsed ? null : (
          <button
            type="button"
            aria-label={favorited ? uiText('取消收藏项目') : uiText('收藏项目')}
            aria-pressed={favorited}
            onClick={() => onFavoriteChange(!favorited)}
            className="fouc-action flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none"
          >
            <Star
              size={15}
              weight={favorited ? 'fill' : 'regular'}
              className={favorited ? 'text-[#d79a3b]' : 'text-[var(--muted)]'}
            />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        {collapsed ? null : (
          <div className="mb-2 px-2 text-[10px] text-[var(--muted)]">{uiText('项目')}</div>
        )}
        <nav aria-label={uiText('项目交付导航')} className="space-y-1">
          {pages.map((item) => row(item, false, unavailable))}
        </nav>
        <div aria-hidden className="my-4 h-[var(--separator-width)] bg-[var(--wt-sidebar-edge)]" />
        {collapsed ? null : (
          <div className="mb-2 px-2 text-[10px] text-[var(--muted)]">{uiText('团队')}</div>
        )}
        <nav aria-label={uiText('项目团队导航')} className="space-y-1">
          {row(
            { id: 'chat', label: uiText('项目讨论'), icon: ChatCircle },
            activePanel === 'chat',
            unavailable,
          )}
          {row({ id: 'inbox', label: uiText('待我决策'), icon: CheckCircle }, false, unavailable)}
          {row(
            { id: 'invite', label: uiText('成员与权限'), icon: UsersThree },
            activePanel === 'invite',
            unavailable,
          )}
        </nav>
      </div>
      <div className="mt-auto shrink-0 pt-3">
        {row(
          { id: 'settings', label: uiText('项目设置'), icon: GearSix },
          activePanel === 'settings',
          unavailable,
        )}
      </div>
    </div>
  );
}
