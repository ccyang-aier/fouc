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

import { useEffect, useMemo, useState } from 'react';
import { useEditor } from '@tiptap/react';
import type { PageScope, PermissionLevel } from '@fouc/shared/knowledge/contracts';
import { createBlockIdExtension, createKnowledgeExtensions } from '@fouc/shared/knowledge/schema';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import type { FoucAuthUser } from '../../identity/auth-api';
import type { PageUndo } from '../collaboration/page-undo';
import type { PageDocumentSession } from '../collaboration/page-provider';
import { AwarenessMembers, createAwarenessExtension } from './awareness';
import { applyEditorBlockModules } from './block-modules';
import { createSlashPasteExtensions, SlashMenuLayer } from './commands';
import { DocumentEditorBody, DocumentEditorFrame, DocumentHeading } from './editor-layout';
import { DocumentEditorHeader } from './components/document-editor-header';
import { ReadonlyBanner } from './components/readonly-banner';
import { SyncIndicator } from './components/sync-indicator';
import type { PageEditorViewModel } from './editor-state';
import { revealBlockInEditor, subscribeOpenPageTarget, takeStagedBlockHighlight } from './open-target';
import { pageCollaborationExtension } from './page-collaboration';
import { createPageReviewExtension, PageReviewRail } from './review-integration';
import { createBlockEditingExtensions } from './extensions';
import { HistoryPanel } from '../history/history-panel';
import { createCommentsEditorExtension, PageCommentsLayer } from './comments-integration';
import { usePageTitle } from './use-page-title';
import { useSidebarCollections } from '../navigation/sidebar-collections';
import { TaskProgress } from './block-modules/task-list/task-progress';

export function PageEditorSurface({
  scope,
  session,
  origin,
  user,
  pageUndo,
  level,
  view,
  collectionName,
  knowledgeBaseId,
  onBack,
  onToggleSidebar,
  onCreateDocument,
  canCreateDocument,
}: {
  scope: PageScope;
  /** The live B04 page session — its document is the only body authority. */
  session: PageDocumentSession;
  /** Resolved knowledge API origin (block-reference source connections). */
  origin: string | null;
  /** The signed-in human the awareness publishes as (B07). */
  user: FoucAuthUser | null;
  pageUndo: PageUndo;
  level: PermissionLevel;
  view: PageEditorViewModel;
  collectionName: string;
  knowledgeBaseId: string;
  onBack: () => void;
  onToggleSidebar: () => void;
  onCreateDocument: () => void;
  canCreateDocument: boolean;
}) {
  const document = session.document;
  // One extension set per page session: shared registry (E01) with the
  // block/callout/table and block-reference NodeViews layered on (E05/L02),
  // blockId integrity (E02), the y-prosemirror binding (B04/B08), suggestion
  // marks (S01), comments (N02), markdown/keyboard block editing (E04), the
  // slash menu + paste pipeline (E06) and presence cursors (B07).
  const extensions = useMemo(() => {
    const registry = applyEditorBlockModules(createKnowledgeExtensions(), { scope, origin: origin ?? '' });
    return [
      ...registry,
      createBlockIdExtension({ pageId: scope.pageId }),
      pageCollaborationExtension(document, pageUndo),
      createPageReviewExtension(),
      createCommentsEditorExtension(),
      ...createBlockEditingExtensions(),
      ...createSlashPasteExtensions(),
      ...(user
        ? [createAwarenessExtension({
          getAwareness: () => session.awareness,
          subscribeAwareness: session.subscribe,
          identity: { userId: user.id, name: user.name },
        })]
        : []),
    ];
  // The scope object itself is re-created by the shell on every render, so
  // only its identity-bearing fields belong here — otherwise the inline
  // object would rebuild (and remount) the editor on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.pageId, scope.workspaceId, document, pageUndo, origin, user, session]);

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

  // L02: a block-reference click that lands on this page reveals the block —
  // a pre-mount navigation consumes its staged highlight, later targets ride
  // the open-target channel (both selection-free).
  useEffect(() => {
    if (!editor) return undefined;
    const staged = takeStagedBlockHighlight(scope.pageId);
    if (staged) revealBlockInEditor(editor.view, staged.blockId);
    return subscribeOpenPageTarget((target) => {
      if (target.pageId === scope.pageId && target.blockId) revealBlockInEditor(editor.view, target.blockId);
    });
  }, [editor, scope.pageId]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const { collections, toggleStar } = useSidebarCollections(user?.id ?? '', scope.workspaceId, knowledgeBaseId);
  const pageTitle = usePageTitle(scope);
  const updatedLabel = pageTitle.updatedAt
    ? `你已更新 ${new Date(pageTitle.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : '文档';

  return (
    <DocumentEditorFrame>
      <DocumentEditorHeader
        editor={editor}
        pageUndo={pageUndo}
        editable={view.editable}
        collectionName={collectionName}
        title={pageTitle.title}
        avatarName={user?.name ?? '我'}
        starred={collections.starred.includes(scope.pageId)}
        onBack={onBack}
        onToggleSidebar={onToggleSidebar}
        onToggleStar={() => toggleStar(scope.pageId)}
        onCreateDocument={onCreateDocument}
        canCreateDocument={canCreateDocument}
        shareDescription="复制文档标题和正文后，可以粘贴到其他应用。页面访问权限由知识库管理。"
        presence={<AwarenessMembers awareness={session.awareness} />}
        menuActions={<button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
            aria-label="历史版本"
            title="历史版本"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-[var(--raise)]"
          >
            <ClockCounterClockwise aria-hidden className="size-4" />历史版本
          </button>}
      />
      {view.readonlyReason ? <ReadonlyBanner reason={view.readonlyReason} level={level} /> : null}
      <PageCommentsLayer scope={scope} editor={editor} level={level}>
        <DocumentEditorBody editor={editor} before={<DocumentHeading
          title={pageTitle.title}
          editable={view.editable && pageTitle.loaded}
          onTitleChange={pageTitle.setTitle}
          onTitleCommit={() => { void pageTitle.save(); }}
          metadata={<>
            <span>{updatedLabel}</span>
            <TaskProgress editor={editor} />
            <SyncIndicator view={view.sync} />
            <span>{level === 'view' ? '仅可查看' : level === 'comment' ? '可评论' : '可编辑'} · 已被浏览</span>
            {pageTitle.fetchError ? <span role="alert" className="text-[var(--err-ink)]">标题暂不可用</span> : null}
            {pageTitle.saving ? <span>正在保存标题</span> : null}
            {pageTitle.error ? <span role="alert" className="text-[var(--err-ink)]">{pageTitle.error}</span> : null}
          </>}
        />} />
        <PageReviewRail editor={editor} editable={view.editable} />
        {historyOpen && (
          <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel)]">
            <HistoryPanel
              workspaceId={scope.workspaceId}
              pageId={scope.pageId}
              editor={editor}
              canEdit={view.editable}
              onClose={() => setHistoryOpen(false)}
            />
          </aside>
        )}
      </PageCommentsLayer>
      <SlashMenuLayer editor={editor} />
    </DocumentEditorFrame>
  );
}
