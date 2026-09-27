'use client';

import type { ReactNode } from 'react';
import { Warning, XCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KnowledgeBase } from '@fouc/shared/knowledge/contracts';
import { KnowledgeBaseHeader } from '../knowledge-base-header';
import { CanvasState, TreeSkeletonRows } from '../canvas-states';
import styles from './knowledge-sidebar.module.css';

export function PageTreeSidebar({ collapsed, onCollapse, knowledgeBases, activeKnowledgeBaseId, onSelectKnowledgeBase, onCreateKnowledgeBase, onOpenSettings, onOpenLocal, onOpenWorkspace, treeArea, footer, createLabel }: {
  collapsed: boolean;
  onCollapse: () => void;
  knowledgeBases: readonly Pick<KnowledgeBase, 'id' | 'name'>[];
  activeKnowledgeBaseId: string | null;
  onSelectKnowledgeBase: (id: string) => void;
  onCreateKnowledgeBase: () => void;
  onOpenSettings: () => void;
  onOpenLocal?: () => void;
  onOpenWorkspace?: () => void;
  treeArea: ReactNode;
  footer?: ReactNode;
  createLabel?: string;
}) {
  return <aside aria-label="知识库侧边栏" aria-hidden={collapsed} inert={collapsed} data-collapsed={collapsed} className={cn('flex h-full min-h-0 flex-col', styles.sidebar)}>
    <KnowledgeBaseHeader knowledgeBases={knowledgeBases} activeKnowledgeBaseId={activeKnowledgeBaseId} onSelectKnowledgeBase={onSelectKnowledgeBase} onCollapse={onCollapse} onCreateKnowledgeBase={onCreateKnowledgeBase} onOpenSettings={onOpenSettings} onOpenLocal={onOpenLocal} onOpenWorkspace={onOpenWorkspace} createLabel={createLabel} />
    {treeArea}
    {footer}
  </aside>;
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
      hint="无法读取文件夹目录，请稍后重试。"
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
      hint="当前角色没有查看该知识库目录的权限，请联系知识库管理员。"
      announce="polite"
    />
  );
}
