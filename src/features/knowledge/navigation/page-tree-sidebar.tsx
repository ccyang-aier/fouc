'use client';

/**
 * The left column of the knowledge shell (U02): workspace scope on top, the
 * page tree below, account row at the bottom. The switcher and dialogs are the
 * O02 components reused verbatim so the knowledge shell and the organization
 * panel render the same server data the same way; only the tree area is
 * knowledge-owned (U03 completes page operations on it).
 */

import type { ReactNode } from 'react';
import { FilePlus, GearSix, Plus, Stack, Warning, XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { KnowledgeSignOutButton } from '../auth/components/knowledge-sign-out-button';
import type { KnowledgeAuthUser } from '../auth/auth-api';
import type { WorkspaceWithRole } from '../organization/client';
import { WorkspaceSwitcher } from '../organization/workspace-bar';
import { CanvasState, TreeSkeletonRows } from '../canvas-states';

export function PageTreeSidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  treeArea,
  footer,
  className,
}: {
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
      className={cn('flex h-full w-[272px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface-subtle)]', className)}
    >
      <header className="flex h-[50px] shrink-0 items-center border-b border-[var(--line)] px-3">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeId={activeWorkspaceId}
          onSelect={onSelectWorkspace}
          onCreate={onCreateWorkspace}
        />
      </header>
      {treeArea}
      {footer}
    </aside>
  );
}

/** Caption row of the tree area: page creation first (the common action), teamspace creation beside it. */
export function TreeAreaHeader({ onCreateTeamspace, onCreatePage, busy }: { onCreateTeamspace: () => void; onCreatePage?: () => void; busy?: boolean }) {
  return (
    <div className="flex h-[34px] shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-3">
      <span className="text-[11px] font-medium tracking-[0.02em] text-[var(--muted-strong)]">页面树</span>
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
          aria-label="新建团队空间"
          title="新建团队空间"
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
      title="还没有团队空间"
      hint="团队空间是页面树的顶层分组；创建第一个团队空间后，页面会按目录组织在这里。"
      announce="polite"
      actions={
        <Button size="sm" onClick={onCreateTeamspace}>
          <Plus aria-hidden className="size-3.5" />新建团队空间
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
