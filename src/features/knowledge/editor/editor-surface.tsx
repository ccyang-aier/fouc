'use client';

/**
 * The editor surface of one page (E03): the Tiptap instance bound to the
 * shared E01 registry schema (never a second schema), the E02 blockId
 * extension and the B04/B08 collaboration extension, wrapped in the toolbar /
 * sync indicator / readonly banner frame.
 *
 * `immediatelyRender: false` keeps the editor instance strictly
 * client-after-mount (no SSR rendering, no hydration mismatch); the body
 * itself lives in the Y.Doc — the component holds no second content state.
 */

import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { PageScope, PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { createBlockIdExtension, createKnowledgeExtensions } from '@fouc/shared/knowledge/schema';
import type * as Y from 'yjs';
import type { PageUndo } from '../collaboration/page-undo';
import { EditorToolbar } from './components/editor-toolbar';
import { ReadonlyBanner } from './components/readonly-banner';
import { SyncIndicator } from './components/sync-indicator';
import type { PageEditorViewModel } from './editor-state';
import { pageCollaborationExtension } from './page-collaboration';
import { createPageReviewExtension, PageReviewRail } from './review-integration';

/** Document typography for the shared schema's DOM output (E05 adds NodeView polish). */
const documentClasses = [
  'mx-auto w-full max-w-[720px] px-10 py-10',
  '[&_.ProseMirror]:min-h-[50vh] [&_.ProseMirror]:outline-none',
  '[&_.ProseMirror]:text-[13.5px] [&_.ProseMirror]:leading-[1.8] [&_.ProseMirror]:text-[var(--ink-soft)]',
  '[&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_p:first-child]:mt-0',
  '[&_.ProseMirror_h1]:mt-7 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:text-[22px] [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:tracking-[-0.015em] [&_.ProseMirror_h1]:text-[var(--ink)]',
  '[&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:text-[18px] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:tracking-[-0.01em] [&_.ProseMirror_h2]:text-[var(--ink)]',
  '[&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:mb-1.5 [&_.ProseMirror_h3]:text-[15.5px] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-[var(--ink)]',
  '[&_.ProseMirror_h4]:mt-4 [&_.ProseMirror_h4]:mb-1 [&_.ProseMirror_h4]:text-[14px] [&_.ProseMirror_h4]:font-semibold [&_.ProseMirror_h4]:text-[var(--ink)]',
  '[&_.ProseMirror_h5]:mt-4 [&_.ProseMirror_h5]:mb-1 [&_.ProseMirror_h5]:text-[13.5px] [&_.ProseMirror_h5]:font-semibold [&_.ProseMirror_h5]:text-[var(--ink)]',
  '[&_.ProseMirror_h6]:mt-4 [&_.ProseMirror_h6]:mb-1 [&_.ProseMirror_h6]:text-[12.5px] [&_.ProseMirror_h6]:font-semibold [&_.ProseMirror_h6]:text-[var(--muted-strong)]',
  '[&_.ProseMirror_ul]:my-1.5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6',
  '[&_.ProseMirror_ol]:my-1.5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6',
  '[&_.ProseMirror_li]:my-0.5 [&_.ProseMirror_li>p]:my-0',
  '[&_.ProseMirror_li[data-task-item]]:list-none [&_.ProseMirror_li[data-task-item]]:relative [&_.ProseMirror_li[data-task-item]]:pl-[26px]',
  '[&_.ProseMirror_li[data-task-item]::before]:absolute [&_.ProseMirror_li[data-task-item]::before]:left-0 [&_.ProseMirror_li[data-task-item]::before]:top-[0.3em]',
  '[&_.ProseMirror_li[data-task-item]::before]:block [&_.ProseMirror_li[data-task-item]::before]:size-[15px] [&_.ProseMirror_li[data-task-item]::before]:rounded-[4px]',
  '[&_.ProseMirror_li[data-task-item]::before]:border [&_.ProseMirror_li[data-task-item]::before]:border-[var(--line-strong)] [&_.ProseMirror_li[data-task-item]::before]:bg-[var(--panel)] [&_.ProseMirror_li[data-task-item]::before]:transition-colors',
  '[&_.ProseMirror_li[data-task-item][data-checked="true"]::before]:border-[var(--accent)] [&_.ProseMirror_li[data-task-item][data-checked="true"]::before]:bg-[var(--accent)]',
  '[&_.ProseMirror_li[data-task-item][data-checked="true"]_p]:text-[var(--muted)]',
  '[&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-[var(--line-strong)] [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-[var(--muted-strong)]',
  '[&_.ProseMirror_pre]:my-3 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-[8px] [&_.ProseMirror_pre]:bg-[var(--surface-subtle)] [&_.ProseMirror_pre]:p-3.5',
  '[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0 [&_.ProseMirror_pre_code]:font-[var(--font-code)] [&_.ProseMirror_pre_code]:text-[12px] [&_.ProseMirror_pre_code]:leading-[1.7] [&_.ProseMirror_pre_code]:rounded-none',
  '[&_.ProseMirror_code]:font-[var(--font-code)] [&_.ProseMirror_code]:text-[0.9em] [&_.ProseMirror_code]:rounded-[4px] [&_.ProseMirror_code]:bg-[var(--raise)] [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-px',
  '[&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:border-0 [&_.ProseMirror_hr]:border-t [&_.ProseMirror_hr]:border-[var(--line-strong)]',
  '[&_.ProseMirror_table]:my-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse',
  '[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-[var(--line)] [&_.ProseMirror_th]:bg-[var(--surface-subtle)] [&_.ProseMirror_th]:px-2.5 [&_.ProseMirror_th]:py-1.5 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-medium [&_.ProseMirror_th]:text-[var(--ink)]',
  '[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-[var(--line)] [&_.ProseMirror_td]:px-2.5 [&_.ProseMirror_td]:py-1.5 [&_.ProseMirror_td]:align-top',
  '[&_.ProseMirror_aside]:my-3 [&_.ProseMirror_aside]:rounded-[10px] [&_.ProseMirror_aside]:border [&_.ProseMirror_aside]:border-[var(--line)] [&_.ProseMirror_aside]:bg-[var(--surface-subtle)] [&_.ProseMirror_aside]:px-4 [&_.ProseMirror_aside]:py-3',
  '[&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_strong]:text-[var(--ink)]',
  '[&_.ProseMirror_em]:italic',
  '[&_.ProseMirror_s]:line-through [&_.ProseMirror_s]:text-[var(--muted-strong)]',
  '[&_.ProseMirror_u]:underline [&_.ProseMirror_u]:decoration-[var(--line-strong)] [&_.ProseMirror_u]:underline-offset-2',
  '[&_.ProseMirror_a]:text-[var(--accent-ink)] [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:decoration-[color-mix(in_srgb,var(--accent-ink)_40%,transparent)] [&_.ProseMirror_a]:underline-offset-2',
  '[&_.ProseMirror_mark]:rounded-[3px] [&_.ProseMirror_mark]:bg-[var(--accent-soft)] [&_.ProseMirror_mark]:px-0.5',
].join(' ');

export function PageEditorSurface({
  scope,
  document,
  pageUndo,
  level,
  view,
}: {
  scope: PageScope;
  /** The live B04 page document — the only body authority. */
  document: Y.Doc;
  pageUndo: PageUndo;
  level: PermissionLevel;
  view: PageEditorViewModel;
}) {
  // One extension set per page session: shared registry (E01), blockId
  // integrity (E02) and the y-prosemirror binding (B04/B08).
  const extensions = useMemo(
    () => [
      ...createKnowledgeExtensions(),
      createBlockIdExtension({ pageId: scope.pageId }),
      pageCollaborationExtension(document, pageUndo),
      createPageReviewExtension(),
    ],
    [scope.pageId, document, pageUndo],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      autofocus: false,
      editable: view.editable,
      extensions,
      editorProps: { attributes: { 'aria-label': '页面正文' } },
    },
    [extensions],
  );

  // The P03 level and the B04 error phase can both change while mounted;
  // keep the instance's editable flag glued to the derived decision.
  useEffect(() => {
    editor?.setEditable(view.editable);
  }, [editor, view.editable]);

  return (
    <section aria-label="页面编辑器" className="flex h-full min-w-0 flex-1 flex-col bg-[var(--panel)]">
      <header className="flex h-[42px] shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] px-4">
        <EditorToolbar editor={editor} pageUndo={pageUndo} editable={view.editable} />
        <SyncIndicator view={view.sync} />
      </header>
      {view.readonlyReason ? <ReadonlyBanner reason={view.readonlyReason} level={level} /> : null}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={documentClasses}>
            <EditorContent editor={editor} />
          </div>
        </div>
        <PageReviewRail editor={editor} editable={view.editable} />
      </div>
    </section>
  );
}
