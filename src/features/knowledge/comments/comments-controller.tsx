'use client';

/** Joins PostgreSQL threads/likes with CRDT selection anchors and owns authorized mutations.
 * Page comments can be written independently of the editor selection; quoted
 * comments share client IDs with their optimistic anchors. Live events and
 * local mutations invalidate the same workspace/page comment query.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Editor } from '@tiptap/react';
import type { Transaction } from '@tiptap/pm/state';
import type { CommentThreadKind } from '@fouc/shared/knowledge/comments';
import type { PageScope } from '@fouc/shared/knowledge/contracts';
import { isKnowledgeDataError } from '../data/errors';
import { useKnowledgeAccessQuery } from '../data/hooks';
import {
  anchorExcerpt,
  buildAddCommentSelectionTransaction,
  buildRemoveCommentAnchorTransaction,
  collectCommentAnchors,
} from './comment-anchors';
import type { CommentAnchor } from './comment-anchors';
import { bindSelectionCommentComposer, type CommentComposePoint } from './comment-compose-bridge';
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
  useSetCommentLike,
  useUpdateComment,
} from './comments-queries';
import { deriveCommentSidebarModel } from './comments-view-model';
import { CommentsSidebar } from './components/comments-sidebar';
import { CommentComposer } from './components/comment-composer';
import type { CommentAuthor } from './components/comment-entry';
import type { CommentReplyTarget } from './components/comment-thread-card';
import { useMembersQuery } from '../organization/hooks';
import { commentLink, readCommentLink } from './comment-link';

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
  followDocumentLink?: boolean;
  scope: PageScope;
  knowledgeBaseId: string;
  /** The live Tiptap instance of the page editor (null while it mounts). */
  editor: Editor | null;
  canComment: boolean;
  railOpen?: boolean;
  onRailOpenChange?: (open: boolean) => void;
  currentUser?: { id: string; name: string; image?: string | null } | null;
}

export function PageComments({ scope, knowledgeBaseId, editor, canComment, currentUser, railOpen: controlledRailOpen, onRailOpenChange, followDocumentLink = true }: PageCommentsProps) {
  const threadsQuery = usePageCommentThreads(scope.workspaceId, scope.pageId);
  const accessQuery = useKnowledgeAccessQuery(scope.workspaceId);
  const currentUserId = accessQuery.data?.userId ?? null;
  const threads = useMemo(() => threadsQuery.data ?? [], [threadsQuery.data]);

  const createMutation = useCreateCommentThread(scope.workspaceId);
  const replyMutation = useReplyCommentThread(scope.workspaceId);
  const resolveMutation = useResolveCommentThread(scope.workspaceId);
  const reopenMutation = useReopenCommentThread(scope.workspaceId);
  const deleteMutation = useDeleteComment(scope.workspaceId);
  const likeMutation = useSetCommentLike(scope.workspaceId);
  const editMutation = useUpdateComment(scope.workspaceId);
  const pageCommentMutation = useCreateCommentThread(scope.workspaceId);
  const pageDraft = useRef<{ threadId: string; commentId: string; bodyMd: string; kind: CommentThreadKind } | null>(null);

  // Anchors belong to one editor instance; a stale editor's anchors never
  // render after a scope switch (derived, not reset in an effect).
  const [anchorState, setAnchorState] = useState<{ editor: Editor | null; value: CommentAnchor[] }>({ editor: null, value: [] });
  const anchors = anchorState.editor === editor ? anchorState.value : EMPTY_ANCHORS;
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [composing, setComposing] = useState<ComposingDraft | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerAt, setComposerAt] = useState<{ x: number; y: number } | null>(null);
  const [localRailOpen, setLocalRailOpen] = useState(false);
  const railOpen = controlledRailOpen ?? localRailOpen;
  const membersQuery = useMembersQuery(railOpen ? scope.workspaceId : null);
  const authors = useMemo(() => {
    const names = new Map<string, CommentAuthor>();
    for (const page of membersQuery.data?.pages ?? []) for (const member of page.items) names.set(member.userId, { name: member.name });
    if (currentUser) names.set(currentUser.id, { name: currentUser.name, image: currentUser.image });
    return names;
  }, [membersQuery.data, currentUser]);
  const setRailOpen = onRailOpenChange ?? setLocalRailOpen;
  const [replyTarget, setReplyTarget] = useState<CommentReplyTarget | null>(null);
  const lastDocRef = useRef<unknown>(null);
  const followedLink = useRef<string | null>(null);

  // ── Editor wiring: anchors and active thread ──
  useEffect(() => {
    if (!editor) return undefined;
    const readAnchors = () => {
      const doc = editor.state.doc;
      if (doc === lastDocRef.current) return;
      lastDocRef.current = doc;
      setAnchorState({ editor, value: collectCommentAnchors(doc) });
    };
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      const id = activeCommentThreadId(editor.state);
      // Explicit picks reopen even the same discussion; typing and context
      // refreshes must leave a deliberately closed rail alone.
      const selection = transaction.getMeta(commentsPluginKey) as { type?: string } | undefined;
      if (id !== null && selection?.type === 'select') setRailOpen(true);
      setActiveThreadId(id);
    };
    readAnchors();
    editor.on('transaction', onTransaction);
    editor.on('update', readAnchors);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('update', readAnchors);
    };
  }, [editor, setRailOpen]);

  // The active thread's card scrolls into view inside the rail.
  useEffect(() => {
    if (!activeThreadId || !railOpen) return;
    editor?.view.dom.closest('[aria-label="页面编辑器"]')?.querySelector(`[data-comment-card="${activeThreadId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeThreadId, railOpen, editor]);

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

  // A document link selects the discussion through the same editor event as
  // an anchor click, including page comments that have no text selection.
  useEffect(() => {
    if (!followDocumentLink) return;
    const target = readCommentLink(window.location.href);
    if (!editor || !target || target.source !== 'workspace' || target.workspaceId !== scope.workspaceId || target.pageId !== scope.pageId || target.knowledgeBaseId !== knowledgeBaseId || followedLink.current === target.commentId) return;
    const thread = threads.find(thread => thread.comments.some(entry => entry.id === target.commentId));
    if (!thread) return;
    if (activeCommentThreadId(editor.state) !== thread.id) {
      editor.view.dispatch(editor.state.tr.setMeta(commentsPluginKey, { type: 'select', id: thread.id }).setMeta('addToHistory', false));
    }
    if (!railOpen) return;
    followedLink.current = target.commentId;
    editor.view.dom.closest('[aria-label="页面编辑器"]')?.querySelector(`[data-comment-id="${target.commentId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [scope.workspaceId, scope.pageId, knowledgeBaseId, threads, railOpen, editor, followDocumentLink]);

  const dispatchRemoveAnchor = useCallback((threadId: string, options: { userAction: boolean }) => {
    if (!editor) return;
    const tr = buildRemoveCommentAnchorTransaction(editor.state, threadId);
    if (!tr) return;
    if (!options.userAction) tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }, [editor]);

  // ── 划词评论: optimistic anchor, then persist under the same ids ──
  const beginComposeAt = useCallback((point: CommentComposePoint) => {
    if (!editor || !canComment || composing || !editor.isEditable) return;
    const threadId = crypto.randomUUID();
    const commentId = crypto.randomUUID();
    const ranges = editor.state.selection.ranges.map(({ $from, $to }) => ({ from: $from.pos, to: $to.pos }));
    const tr = buildAddCommentSelectionTransaction(editor.state, threadId);
    if (!tr) return;
    editor.view.dispatch(tr);
    setComposing({ threadId, commentId, excerpt: anchorExcerpt(editor.state.doc, ranges) });
    setComposerError(null);
    setComposerAt(point);
  }, [editor, canComment, composing]);
  useEffect(() => {
    if (!editor || !editor.isEditable || !canComment || composing) return;
    return bindSelectionCommentComposer(editor, beginComposeAt);
  }, [editor, canComment, composing, beginComposeAt]);

  const submitCompose = useCallback(async (bodyMd: string, kind: CommentThreadKind, mentions: string[]) => {
    if (!composing) return false;
    setComposerError(null);
    try {
      await createMutation.mutateAsync({ pageId: scope.pageId, threadId: composing.threadId, commentId: composing.commentId, bodyMd, kind, mentions, anchorKind: 'selection' });
      setComposing(null);
      setComposerAt(null);
      if (editor) selectCommentThread(editor.view, composing.threadId, { flash: true });
      setRailOpen(true);
      return true;
    } catch (error: unknown) {
      // The optimistic anchor stays; retry resubmits the exact same ids.
      setComposerError(commentErrorText(error, '评论发送失败，请重试。'));
      return false;
    }
  }, [composing, createMutation, scope.pageId, editor, setRailOpen]);

  const cancelCompose = useCallback(() => {
    if (!composing) return;
    dispatchRemoveAnchor(composing.threadId, { userAction: true });
    setComposing(null);
    setComposerAt(null);
    setComposerError(null);
  }, [composing, dispatchRemoveAnchor]);

  const submitPageComment = useCallback(async (bodyMd: string, kind: CommentThreadKind, mentions: string[]) => {
    if (!canComment) return false;
    if (!pageDraft.current || pageDraft.current.bodyMd !== bodyMd || pageDraft.current.kind !== kind) {
      pageDraft.current = { threadId: crypto.randomUUID(), commentId: crypto.randomUUID(), bodyMd, kind };
    }
    pageCommentMutation.reset();
    try {
      await pageCommentMutation.mutateAsync({ ...pageDraft.current, pageId: scope.pageId, mentions, anchorKind: 'page' });
      pageDraft.current = null;
      return true;
    } catch { return false; }
  }, [canComment, pageCommentMutation, scope.pageId]);

  const handleLike = useCallback(async (commentId: string, liked: boolean) => {
    likeMutation.reset();
    try { await likeMutation.mutateAsync({ commentId, liked }); }
    catch { /* The entry retains its current value and shows a retryable error. */ }
  }, [likeMutation]);

  const handleEdit = useCallback(async (commentId: string, bodyMd: string) => {
    editMutation.reset();
    try { await editMutation.mutateAsync({ commentId, bodyMd }); return true; }
    catch { return false; }
  }, [editMutation]);

  const handleCopyLink = useCallback(async (commentId: string) => {
    try {
      await navigator.clipboard.writeText(commentLink(window.location.href, { ...scope, knowledgeBaseId, source: 'workspace' }, commentId));
      return true;
    } catch { return false; }
  }, [scope, knowledgeBaseId]);

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

  const handleReply = useCallback(async (target: CommentReplyTarget, bodyMd: string, mentions: string[]) => {
    replyMutation.reset();
    try {
      await replyMutation.mutateAsync({ threadId: target.threadId, replyToCommentId: target.commentId, bodyMd, mentions });
      setReplyTarget(null);
      return true;
    } catch {
      // Keep the reply draft and target available for retry.
      return false;
    }
  }, [replyMutation]);

  const handleResolve = useCallback(async (threadId: string) => {
    reopenMutation.reset();
    resolveMutation.reset();
    try {
      await resolveMutation.mutateAsync(threadId);
    } catch {
      // Rendered on the card.
    }
  }, [resolveMutation, reopenMutation]);

  const handleReopen = useCallback(async (threadId: string) => {
    resolveMutation.reset();
    reopenMutation.reset();
    try {
      await reopenMutation.mutateAsync(threadId);
    } catch {
      // Rendered on the card.
    }
  }, [reopenMutation, resolveMutation]);

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

  const popoverX = composerAt ? Math.min(Math.max(composerAt.x, 156), (typeof window === 'undefined' ? 1024 : window.innerWidth) - 156) : 0;

  return (
    <>
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
          <p className="mb-2 line-clamp-2 border-b border-[var(--line)] px-1.5 py-2 text-[11.5px] leading-relaxed text-[var(--ink-soft)]">
            {composing.excerpt}
          </p>
          <CommentComposer
            workspaceId={scope.workspaceId}
            placeholder="写下评论…（Ctrl+Enter 发送）"
            submitLabel={createMutation.isPending ? '发送中…' : '发送'}
            sendingLabel="发送中…"
            sending={createMutation.isPending}
            error={composerError}
            allowIssue
            onSubmit={submitCompose}
            authors={authors}
            onCancel={cancelCompose}
          />
        </motion.div>
      ) : null}

      {railOpen ? (
        <CommentsSidebar
          workspaceId={scope.workspaceId}
          model={model}
          replyTarget={replyTarget}
          activeThreadId={activeThreadId}
          onRemoveOrphan={handleRemoveOrphan}
          status={threadsQuery.isPending ? 'loading' : threadsQuery.isError ? 'error' : 'ready'}
          errorText={commentErrorText(threadsQuery.error, '评论列表加载失败，请重试。')}
          onRetry={() => void threadsQuery.refetch()}
          onClose={() => setRailOpen(false)}
          canComment={canComment}
          currentUserId={currentUserId}
          authors={authors}
          create={{ pending: pageCommentMutation.isPending, error: pageCommentMutation.isError ? commentErrorText(pageCommentMutation.error, '评论发送失败，请重试。') : null }}
          onCreate={submitPageComment}
          like={{ pending: likeMutation.isPending, commentId: likeMutation.variables?.commentId ?? null, error: likeMutation.isError ? commentErrorText(likeMutation.error, '点赞失败，请重试。') : null }}
          onLike={(commentId, liked) => void handleLike(commentId, liked)}
          edit={{ pending: editMutation.isPending, commentId: editMutation.variables?.commentId ?? null, error: editMutation.isError ? commentErrorText(editMutation.error, '保存失败，请重试。') : null }}
          onEdit={handleEdit}
          onCopyLink={handleCopyLink}
          reply={replyState}
          resolve={resolveState}
          deletingCommentId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
          deleteError={deleteMutation.isError ? { commentId: deleteMutation.variables ?? null, message: commentErrorText(deleteMutation.error, '删除失败，评论已保留，请重试。') } : null}
          onLocate={locateThread}
          onReply={handleReply}
          onResolve={(threadId) => void handleResolve(threadId)}
          onReopen={(threadId) => void handleReopen(threadId)}
          onDeleteComment={(commentId) => void handleDeleteComment(commentId)}
          onReplyTargetChange={target => { if (!replyMutation.isPending) { replyMutation.reset(); setReplyTarget(target); } }}
        />
      ) : null}
    </>
  );
}
