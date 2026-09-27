'use client';

/**
 * The page comments controller (N02): one component owning the whole comment
 * closed loop over the live editor and the U01 cache —
 *
 * - 划词评论: a non-empty selection in an editable editor raises the floating
 *   comment button; opening the composer applies the optimistic `comment`
 *   mark under a freshly generated threadId (the anchor the CRDT will carry),
 *   and the thread is persisted under that exact id, so submit, retry and
 *   cancel never rebind the anchor;
 * - the sidebar joins the thread list with the document's anchors through the
 *   pure view-model, including the explainable 未锚定 / 孤立锚点 states;
 * - the plugin's styling context (resolved / orphan / pending / counts /
 *   active) is refreshed on every data change through a history-free meta
 *   transaction, so editor and sidebar can never disagree;
 * - other members' threads arrive live through the B06 `comment.changed`
 *   invalidation of the `comments` segment.
 *
 * The component renders overlays (fixed-position selection button and
 * composer) plus the rail column; it must sit inside a `relative` flex row
 * next to the editor's scroll column (see editor/comments-integration.tsx).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatCircleDots, ChatsCircle } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import type { Editor } from '@tiptap/react';
import type { PageScope } from '@fouc/shared/knowledge/contracts';
import { isKnowledgeDataError } from '../data/errors';
import { useKnowledgeAccessQuery } from '../data/hooks';
import {
  anchorExcerpt,
  buildAddCommentAnchorTransaction,
  buildRemoveCommentAnchorTransaction,
  collectCommentAnchors,
} from './comment-anchors';
import type { CommentAnchor } from './comment-anchors';
import {
  activeCommentThreadId,
  commentsPluginKey,
  selectCommentThread,
  setCommentAnchorContextOnEditor,
} from './comments-plugin';
import type { CommentAnchorContext } from './comments-plugin';
import {
  useCreateCommentThread,
  useDeleteComment,
  usePageCommentThreads,
  useReplyCommentThread,
  useReopenCommentThread,
  useResolveCommentThread,
} from './comments-queries';
import { deriveCommentSidebarModel } from './comments-view-model';
import { CommentsSidebar } from './components/comments-sidebar';
import { CommentComposer } from './components/comment-composer';

const EMPTY_THREAD_IDS: ReadonlySet<string> = new Set();
const EMPTY_ANCHORS: CommentAnchor[] = [];

interface ComposingDraft {
  threadId: string;
  commentId: string;
  excerpt: string;
}

function commentErrorText(error: unknown, fallback: string): string {
  if (!isKnowledgeDataError(error)) return fallback;
  const copy: Record<string, string> = {
    NETWORK: '无法连接知识服务，请检查网络后重试。',
    TIMEOUT: '请求超时，请重试。',
    RATE_LIMITED: '请求过于频繁，请稍后重试。',
    UNAVAILABLE: '评论服务暂时不可用，请稍后重试。',
    UNAUTHENTICATED: '登录状态已失效，请重新登录后再评论。',
    FORBIDDEN: '当前权限不能执行该评论操作。',
    INVALID_REQUEST: '评论内容或参数不符合要求。',
  };
  return copy[error.code] ?? fallback;
}

export interface PageCommentsProps {
  scope: PageScope;
  /** The live Tiptap instance of the page editor (null while it mounts). */
  editor: Editor | null;
  canComment: boolean;
}

export function PageComments({ scope, editor, canComment }: PageCommentsProps) {
  const threadsQuery = usePageCommentThreads(scope.workspaceId, scope.pageId);
  const accessQuery = useKnowledgeAccessQuery(scope.workspaceId);
  const currentUserId = accessQuery.data?.userId ?? null;
  const threads = useMemo(() => threadsQuery.data ?? [], [threadsQuery.data]);

  const createMutation = useCreateCommentThread(scope.workspaceId);
  const replyMutation = useReplyCommentThread(scope.workspaceId);
  const resolveMutation = useResolveCommentThread(scope.workspaceId);
  const reopenMutation = useReopenCommentThread(scope.workspaceId);
  const deleteMutation = useDeleteComment(scope.workspaceId);

  // Anchors belong to one editor instance; a stale editor's anchors never
  // render after a scope switch (derived, not reset in an effect).
  const [anchorState, setAnchorState] = useState<{ editor: Editor | null; value: CommentAnchor[] }>({ editor: null, value: [] });
  const anchors = anchorState.editor === editor ? anchorState.value : EMPTY_ANCHORS;
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [composing, setComposing] = useState<ComposingDraft | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerAt, setComposerAt] = useState<{ x: number; y: number } | null>(null);
  const [selectionAt, setSelectionAt] = useState<{ x: number; y: number } | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [replyingThreadId, setReplyingThreadId] = useState<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const lastDocRef = useRef<unknown>(null);

  // ── Editor wiring: anchors, active thread, selection geometry ──
  useEffect(() => {
    if (!editor) return undefined;
    const readAnchors = () => {
      const doc = editor.state.doc;
      if (doc === lastDocRef.current) return;
      lastDocRef.current = doc;
      setAnchorState({ editor, value: collectCommentAnchors(doc) });
    };
    const refreshSelection = () => {
      if (!editor.isEditable || !canComment || composing) {
        setSelectionAt(null);
        return;
      }
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setSelectionAt(null);
        return;
      }
      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to, -1);
        const x = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
        setSelectionAt({ x, y: Math.min(start.top, end.top) });
      } catch {
        setSelectionAt(null);
      }
    };
    const hideSelection = () => setSelectionAt(null);
    const onTransaction = () => {
      const id = activeCommentThreadId(editor.state);
      // A newly picked anchor (text or badge click) is a request to read the
      // thread; an unchanged active id must never reopen a closed rail.
      if (id !== null && id !== activeThreadIdRef.current) setRailOpen(true);
      activeThreadIdRef.current = id;
      setActiveThreadId(id);
    };
    readAnchors();
    refreshSelection();
    editor.on('transaction', onTransaction);
    editor.on('update', readAnchors);
    editor.on('selectionUpdate', refreshSelection);
    editor.on('focus', refreshSelection);
    editor.on('blur', hideSelection);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('update', readAnchors);
      editor.off('selectionUpdate', refreshSelection);
      editor.off('focus', refreshSelection);
      editor.off('blur', hideSelection);
    };
  }, [editor, canComment, composing]);

  // The active thread's card scrolls into view inside the rail.
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
    if (!activeThreadId || !railOpen) return;
    document.querySelector(`[data-comment-card="${activeThreadId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeThreadId, railOpen]);

  const excerptOf = useCallback(
    (anchor: CommentAnchor) => (editor ? anchorExcerpt(editor.state.doc, anchor.ranges) : ''),
    [editor],
  );

  const pendingThreadIds = useMemo(
    () => (composing ? new Set([composing.threadId]) : EMPTY_THREAD_IDS),
    [composing],
  );

  // A failed list query cannot judge orphanhood — anchors render neutral then.
  const model = useMemo(
    () => deriveCommentSidebarModel({
      threads,
      anchors: threadsQuery.error ? [] : anchors,
      excerptOf,
      pending: pendingThreadIds,
    }),
    [threads, anchors, threadsQuery.error, excerptOf, pendingThreadIds],
  );

  // ── Plugin styling context: editor and sidebar share one truth ──
  // (The active/flash styles follow the plugin's own select meta instead.)
  useEffect(() => {
    if (!editor) return;
    const context: CommentAnchorContext = {
      resolved: model.resolvedThreadIds,
      orphan: model.orphanThreadIds,
      pending: pendingThreadIds,
      counts: new Map(threads.map((thread) => [thread.id, thread.comments.length])),
    };
    if (setCommentAnchorContextOnEditor(editor, context)) {
      editor.view.dispatch(editor.state.tr
        .setMeta(commentsPluginKey, { type: 'context' })
        .setMeta('addToHistory', false));
    }
  }, [editor, model, pendingThreadIds, threads]);

  const dispatchRemoveAnchor = useCallback((threadId: string, options: { userAction: boolean }) => {
    if (!editor) return;
    const tr = buildRemoveCommentAnchorTransaction(editor.state, threadId);
    if (!tr) return;
    if (!options.userAction) tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }, [editor]);

  // ── 划词评论: optimistic anchor, then persist under the same ids ──
  const beginCompose = useCallback(() => {
    if (!editor || composing || !selectionAt) return;
    const { from, to } = editor.state.selection;
    const threadId = crypto.randomUUID();
    const commentId = crypto.randomUUID();
    const tr = buildAddCommentAnchorTransaction(editor.state, { from, to }, threadId);
    if (!tr) return;
    editor.view.dispatch(tr);
    setComposing({ threadId, commentId, excerpt: anchorExcerpt(editor.state.doc, [{ from, to }]) });
    setComposerError(null);
    setComposerAt(selectionAt);
  }, [editor, composing, selectionAt]);

  const submitCompose = useCallback(async (bodyMd: string) => {
    if (!composing) return;
    setComposerError(null);
    try {
      await createMutation.mutateAsync({ pageId: scope.pageId, threadId: composing.threadId, commentId: composing.commentId, bodyMd });
      setComposing(null);
      setComposerAt(null);
      if (editor) selectCommentThread(editor.view, composing.threadId, { flash: true });
      setRailOpen(true);
    } catch (error: unknown) {
      // The optimistic anchor stays; retry resubmits the exact same ids.
      setComposerError(commentErrorText(error, '评论发送失败，请重试。'));
    }
  }, [composing, createMutation, scope.pageId, editor]);

  const cancelCompose = useCallback(() => {
    if (!composing) return;
    dispatchRemoveAnchor(composing.threadId, { userAction: true });
    setComposing(null);
    setComposerAt(null);
    setComposerError(null);
  }, [composing, dispatchRemoveAnchor]);

  // ── Sidebar actions ──
  const locateThread = useCallback((threadId: string) => {
    if (!editor) return;
    const anchor = collectCommentAnchors(editor.state.doc).find((candidate) => candidate.threadId === threadId);
    if (!anchor) return;
    selectCommentThread(editor.view, threadId, { flash: true });
    const from = anchor.ranges.reduce((min, range) => Math.min(min, range.from), Number.MAX_SAFE_INTEGER);
    const located = editor.view.domAtPos(from);
    const element = located.node.nodeType === 1 ? located.node as HTMLElement : located.node.parentElement;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setActiveThreadId(threadId);
  }, [editor]);

  const handleReply = useCallback(async (threadId: string, bodyMd: string) => {
    replyMutation.reset();
    try {
      await replyMutation.mutateAsync({ threadId, bodyMd });
      setReplyingThreadId(null);
    } catch {
      // The card renders the failure with its own retry affordance.
    }
  }, [replyMutation]);

  const handleResolve = useCallback(async (threadId: string) => {
    resolveMutation.reset();
    try {
      await resolveMutation.mutateAsync(threadId);
    } catch {
      // Rendered on the card.
    }
  }, [resolveMutation]);

  const handleReopen = useCallback(async (threadId: string) => {
    reopenMutation.reset();
    try {
      await reopenMutation.mutateAsync(threadId);
    } catch {
      // Rendered on the card.
    }
  }, [reopenMutation]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    deleteMutation.reset();
    try {
      const result = await deleteMutation.mutateAsync(commentId);
      if (result.threadDeleted) {
        const thread = threads.find((candidate) => candidate.comments.some((entry) => entry.id === commentId));
        if (thread) dispatchRemoveAnchor(thread.id, { userAction: false });
      }
    } catch {
      // Rendered on the card.
    }
  }, [deleteMutation, threads, dispatchRemoveAnchor]);

  const handleRemoveOrphan = useCallback((threadId: string) => {
    dispatchRemoveAnchor(threadId, { userAction: true });
  }, [dispatchRemoveAnchor]);

  const replyState = {
    pending: replyMutation.isPending,
    threadId: (replyMutation.variables?.threadId ?? null) as string | null,
    error: replyMutation.isError ? commentErrorText(replyMutation.error, '回复发送失败，请重试。') : null,
  };
  // Resolve and reopen share one card-level transition state: either pending
  // state disables both buttons of that thread, either failure renders on it.
  const resolveState = {
    pending: resolveMutation.isPending || reopenMutation.isPending,
    threadId: (resolveMutation.variables ?? reopenMutation.variables ?? null) as string | null,
    error: resolveMutation.isError
      ? commentErrorText(resolveMutation.error, '操作失败，请重试。')
      : reopenMutation.isError
        ? commentErrorText(reopenMutation.error, '操作失败，请重试。')
        : null,
  };

  const totalThreads = model.counts.open + model.counts.resolved;
  const popoverX = composerAt ? Math.min(Math.max(composerAt.x, 156), (typeof window === 'undefined' ? 1024 : window.innerWidth) - 156) : 0;

  return (
    <>
      {!railOpen ? (
        <button
          type="button"
          aria-label={totalThreads > 0 ? `展开评论栏（${totalThreads} 条线程）` : '展开评论栏'}
          title="页面评论"
          onClick={() => setRailOpen(true)}
          className="absolute right-3 top-[50px] z-10 flex h-7 items-center gap-1.5 rounded-[6px] border border-[var(--line)] bg-[var(--chip)] px-2 text-[11px] font-medium text-[var(--muted-strong)] shadow-[var(--floating-shadow)] outline-none backdrop-blur transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
        >
          <ChatCircleDots aria-hidden className="size-3.5" />
          评论
          {totalThreads > 0 ? (
            <span className="rounded-full bg-[var(--warn-soft)] px-1.5 text-[10px] font-semibold text-[var(--warn-ink)]">{totalThreads}</span>
          ) : null}
        </button>
      ) : null}

      {selectionAt && !composing && canComment && editor ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: Math.min(Math.max(selectionAt.x, 56), (typeof window === 'undefined' ? 1024 : window.innerWidth) - 56), top: selectionAt.y - 36 }}
          className="fixed z-30 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-[6px] border border-[var(--floating-border)] bg-[var(--panel)] px-2.5 text-[11.5px] font-medium text-[var(--ink-soft)] shadow-[var(--floating-shadow)] outline-none transition-colors hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          onMouseDown={(event) => event.preventDefault()}
          onClick={beginCompose}
        >
          <ChatsCircle aria-hidden className="size-3.5 text-[var(--warn-ink)]" />
          评论
        </motion.button>
      ) : null}

      {composing && composerAt ? (
        <motion.div
          role="dialog"
          aria-label="新建评论"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: popoverX, top: composerAt.y > 240 ? undefined : composerAt.y + 22, bottom: composerAt.y > 240 ? (typeof window === 'undefined' ? 480 : window.innerHeight) - composerAt.y + 14 : undefined }}
          className="fixed z-30 w-[292px] -translate-x-1/2 rounded-[10px] border border-[var(--floating-border)] bg-[var(--panel)] p-3 shadow-[var(--floating-shadow)]"
        >
          <p className="mb-2 line-clamp-2 rounded-[5px] bg-[color-mix(in_srgb,var(--warn-ink)_7%,transparent)] px-1.5 py-1 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
            {composing.excerpt}
          </p>
          <CommentComposer
            placeholder="写下评论…（Ctrl+Enter 发送）"
            submitLabel={createMutation.isPending ? '发送中…' : '发送'}
            sendingLabel="发送中…"
            sending={createMutation.isPending}
            error={composerError}
            onSubmit={(bodyMd) => void submitCompose(bodyMd)}
            onCancel={cancelCompose}
          />
        </motion.div>
      ) : null}

      {railOpen ? (
        <CommentsSidebar
          model={model}
          replyingThreadId={replyingThreadId}
          activeThreadId={activeThreadId}
          onRemoveOrphan={handleRemoveOrphan}
          status={threadsQuery.isPending ? 'loading' : threadsQuery.isError ? 'error' : 'ready'}
          errorText={commentErrorText(threadsQuery.error, '评论列表加载失败，请重试。')}
          onRetry={() => void threadsQuery.refetch()}
          onClose={() => setRailOpen(false)}
          canComment={canComment}
          currentUserId={currentUserId}
          reply={replyState}
          resolve={resolveState}
          deletingCommentId={(deleteMutation.variables ?? null) as string | null}
          onLocate={locateThread}
          onReply={(threadId, bodyMd) => void handleReply(threadId, bodyMd)}
          onResolve={(threadId) => void handleResolve(threadId)}
          onReopen={(threadId) => void handleReopen(threadId)}
          onDeleteComment={(commentId) => void handleDeleteComment(commentId)}
          onToggleReply={setReplyingThreadId}
        />
      ) : null}
    </>
  );
}
