'use client';

/**
 * The comments integration of the page editor (N02) — the single assembly
 * adapter the E03 surface needs, kept as one independent file so wiring it
 * stays a two-line change:
 *
 * ```tsx
 * // editor-surface.tsx
 * const extensions = useMemo(() => [
 *   ...createKnowledgeExtensions(),
 *   createBlockIdExtension({ pageId: scope.pageId }),
 *   pageCollaborationExtension(document, pageUndo),
 *   createCommentsEditorExtension(),            // ← anchor decorations
 * ], [...]);
 *
 * <PageCommentsLayer scope={scope} editor={editor} level={level}>   // ← rail + overlays
 *   <div className="min-h-0 flex-1 overflow-y-auto">…EditorContent…</div>
 * </PageCommentsLayer>
 * ```
 *
 * The layer derives the write permission from the P03 level (comment and
 * above may comment; view renders the sidebar read-only) and renders the
 * floating 划词评论 button, the composer popover and the rail column.
 */

import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import type { PageScope, PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { ChatCircleDots } from '@phosphor-icons/react';
import { PageComments } from '../comments/comments-controller';
import { usePageCommentThreads } from '../comments/comments-queries';
import { levelSatisfies } from './editor-state';
import styles from './comments-integration.module.css';

export { createCommentsEditorExtension } from '../comments/comments-plugin';

export function PageCommentsTrigger({ scope, open, onToggle }: { scope: PageScope; open: boolean; onToggle: () => void }) {
  const threads = usePageCommentThreads(scope.workspaceId, scope.pageId);
  const count = threads.data?.length ?? 0;
  return <span><button type="button" className={styles.trigger} aria-label={open ? '收起评论栏' : '展开评论栏'} aria-expanded={open} onClick={onToggle}>
    <ChatCircleDots aria-hidden size={15} /><span>评论{count > 0 ? ` ${count}` : ''}</span>
  </button></span>;
}

export function PageCommentsLayer({
  scope,
  editor,
  level,
  children,
  railOpen,
  onRailOpenChange,
}: {
  scope: PageScope;
  editor: Editor | null;
  level: PermissionLevel;
  children: ReactNode;
  railOpen?: boolean;
  onRailOpenChange?: (open: boolean) => void;
}) {
  return (
    <div className="relative flex min-h-0 flex-1">
      {children}
      <PageComments scope={scope} editor={editor} canComment={levelSatisfies(level, 'comment')} railOpen={railOpen} onRailOpenChange={onRailOpenChange} />
    </div>
  );
}
