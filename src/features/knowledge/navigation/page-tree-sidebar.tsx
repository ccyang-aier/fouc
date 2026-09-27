'use client';

/**
 * The left column of the knowledge shell (U02): workspace scope on top, the
 * page tree below, account row at the bottom. The switcher and dialogs are the
 * O02 components reused verbatim so the knowledge shell and the organization
 * panel render the same server data the same way; only the tree area is
 * knowledge-owned (U03 completes page operations on it).
 */

import type { ReactNode } from 'react';
import { CaretRight, Check, FilePlus, Folder, GearSix, Plus, SidebarSimple, Stack, Warning, XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { KnowledgeSignOutButton } from '../auth/components/knowledge-sign-out-button';
import type { KnowledgeAuthUser } from '../auth/auth-api';
import styles from './knowledge-sidebar.module.css';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Teamspace, WorkspaceWithRole } from '../organization/client';
import { WorkspaceSwitcher } from '../organization/workspace-bar';
import { CanvasState, TreeSkeletonRows } from '../canvas-states';

export function PageTreeSidebar({
  collapsed, onCollapse, teamspaces, activeTeamspaceId, onSelectTeamspace, onCreateTeamspace, onOpenSettings,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  treeArea,
  footer,
  className,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  teamspaces: readonly Teamspace[];
  activeTeamspaceId: string | null;
  onSelectTeamspace: (id: string) => void;
  onCreateTeamspace: () => void;
  onOpenSettings: () => void;
  workspaces: readonly WorkspaceWithRole[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  /** The tree area below the caption: one of the four honest states or the tree itself. */
  treeArea: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label="知识库导航"
      aria-hidden={collapsed}
      inert={collapsed}
      data-collapsed={collapsed}
      className={cn('flex h-full min-h-0 flex-col', styles.sidebar, className)}
    >
      <header className="flex h-[54px] shrink-0 items-center gap-1 px-2 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="知识库菜单" className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[7px] px-2 text-left hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-ink)]"><Folder size={18} weight="duotone" /></span>
              <span className="truncate text-[14px] font-semibold text-[var(--ink)]">{(teamspaces.find((item) => item.id === activeTeamspaceId) ?? teamspaces[0])?.name ?? '知识库'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[212px]">
            {teamspaces.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onSelectTeamspace(item.id)}><Folder /><span className="flex-1 truncate">{item.name}</span>{item.id === (activeTeamspaceId ?? teamspaces[0]?.id) ? <Check /> : null}</DropdownMenuItem>)}
            <DropdownMenuItem onSelect={onCreateTeamspace}><Plus />新建知识库</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenSettings}><GearSix />设置</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" aria-label="收起知识库侧边栏" title="收起知识库侧边栏" onClick={onCollapse} className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-strong)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"><SidebarSimple size={18} /></button>
      </header>
      <div className="shrink-0 px-3 pb-2">
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} onSelect={onSelectWorkspace} onCreate={onCreateWorkspace} />
      </div>
      {treeArea}
      {footer}
    </aside>
  );
}

/** Caption row of the tree area: page creation first (the common action), teamspace creation beside it. */
export function TreeAreaHeader({ onCreateTeamspace, onCreatePage, busy, expanded = true, onToggle }: { expanded?: boolean; onToggle?: () => void; onCreateTeamspace: () => void; onCreatePage?: () => void; busy?: boolean }) {
  return (
    <div className="flex h-[34px] shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex items-center gap-2 text-[13px] font-medium text-[var(--muted-strong)]"><Folder size={15} />知识库<CaretRight size={10} weight="fill" className={expanded ? 'rotate-90' : ''} /></button>
      <div className="flex items-center gap-0.5">
        {onCreatePage ? (
          <button
            type="button"
            aria-label="新建页面"
            title="新建页面（在当前团队空间根部）"
            onClick={onCreatePage}
            className="flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          >
            <FilePlus aria-hidden className="size-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="新建知识库"
          title="新建知识库"
          disabled={busy}
          onClick={onCreateTeamspace}
          className="flex size-6 items-center justify-center rounded-[5px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:opacity-45"
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TreeArea({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="px-2 pt-2 pb-4">
      {children}
    </ScrollArea>
  );
}

export function TreeLoading() {
  return (
    <div role="status" aria-label="正在加载页面树" className="min-h-0 flex-1 overflow-hidden">
      <TreeSkeletonRows />
    </div>
  );
}

export function TreeError({ onRetry }: { onRetry: () => void }) {
  return (
    <CanvasState
      className="min-h-[200px] flex-1"
      tone="error"
      announce="assertive"
      icon={<XCircle className="size-5" aria-hidden weight="fill" />}
      title="页面树加载失败"
      hint="无法读取团队空间目录，请稍后重试。"
      actions={
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      }
    />
  );
}

export function TreeForbidden() {
  return (
    <CanvasState
      className="min-h-[200px] flex-1"
      icon={<Warning className="size-5" aria-hidden weight="fill" />}
      title="无法浏览页面树"
      hint="当前角色没有查看该工作区团队空间目录的权限，请联系工作区管理员。"
      announce="polite"
    />
  );
}

export function TreeEmpty({ onCreateTeamspace }: { onCreateTeamspace: () => void }) {
  return (
    <CanvasState
      className="min-h-[200px] flex-1"
      tone="accent"
      icon={<Stack className="size-5" aria-hidden weight="regular" />}
      title="还没有知识库"
      hint="创建第一个知识库，将文档按目录组织在这里。"
      announce="polite"
      actions={
        <Button size="sm" onClick={onCreateTeamspace}>
          <Plus aria-hidden className="size-3.5" />新建知识库
        </Button>
      }
    />
  );
}

/** Account row: session identity, settings entry and the A04 sign-out flow. */
export function SidebarFooter({ user, onOpenSettings }: { user: KnowledgeAuthUser; onOpenSettings: () => void }) {
  const initial = (user.name.trim() || user.email).charAt(0).toUpperCase();
  return (
    <footer className="flex h-[54px] shrink-0 items-center gap-2.5 border-t border-[var(--line)] px-3">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-ink)]"
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[12px] font-medium text-[var(--ink)]">{user.name || user.email}</span>
        <span className="block truncate text-[10.5px] text-[var(--muted)]">{user.email}</span>
      </span>
      <button
        type="button"
        aria-label="打开设置"
        title="打开设置"
        onClick={onOpenSettings}
        className="flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
      >
        <GearSix aria-hidden className="size-4" />
      </button>
      <KnowledgeSignOutButton
        label="退出"
        size="icon-sm"
        aria-label="退出登录"
        title="退出登录"
        className="text-[var(--muted)] hover:text-[var(--ink)]"
      />
    </footer>
  );
}
