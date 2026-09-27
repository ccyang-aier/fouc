'use client';

/**
 * One thread card of the comments sidebar (N02): the anchor excerpt header
 * (click to locate the原文 in the editor), the reply chain, the resolve /
 * reopen transition, per-comment removal for one's own writing, and the two
 * explainable degenerate states — a thread whose anchor text is gone, and the
 * resolved fold. Every mutating control carries its pending/disabled reason.
 */

import { ArrowCounterClockwise, Check, CheckCircle, ChatsCircle, WarningCircle } from '@phosphor-icons/react';
import type { CommentThreadGroup, OrphanAnchorGroup } from '../comments-view-model';
import { CommentEntryItem } from './comment-entry';
import { CommentComposer } from './comment-composer';

export interface CommentThreadCardProps {
  group: CommentThreadGroup;
  active: boolean;
  canComment: boolean;
  currentUserId: string | null;
  /** Whether this card's reply composer is open (controller-owned). */
  replying: boolean;
  onToggleReply: (threadId: string, open: boolean) => void;
  /** Reply mutation state shared by every card (variables scope the spinner). */
  reply: { pending: boolean; threadId: string | null; error: string | null };
  resolve: { pending: boolean; threadId: string | null; error: string | null };
  deletingCommentId: string | null;
  onLocate: (threadId: string) => void;
  onReply: (threadId: string, bodyMd: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function CommentThreadCard({
  group,
  active,
  canComment,
  currentUserId,
  replying,
  onToggleReply,
  reply,
  resolve,
  deletingCommentId,
  onLocate,
  onReply,
  onResolve,
  onReopen,
  onDeleteComment,
}: CommentThreadCardProps) {
  const resolved = group.thread.status === 'resolved';
  const resolvePending = resolve.pending && resolve.threadId === group.threadId;
  const replyPending = reply.pending && reply.threadId === group.threadId;

  return (
    <article
      data-comment-card={group.threadId}
      aria-label={`评论线程：${group.excerpt || '未锚定'}`}
      className={[
        'rounded-[10px] border bg-[var(--panel)] transition-colors',
        active ? 'border-[color-mix(in_srgb,var(--warn-ink)_45%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--warn-ink)_22%,transparent)]' : 'border-[var(--line)]',
      ].join(' ')}
    >
      <header className="flex items-start gap-2 px-3 pb-2 pt-2.5">
        <button
          type="button"
          onClick={() => onLocate(group.threadId)}
          disabled={!group.anchor}
          title={group.anchor ? '在正文中定位该评论' : '原文已不存在'}
          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
        >
          <span className={group.anchor
            ? 'line-clamp-2 rounded-[4px] border-b border-dotted border-[color-mix(in_srgb,var(--warn-ink)_45%,transparent)] bg-[color-mix(in_srgb,var(--warn-ink)_6%,transparent)] px-1 py-0.5 text-[11.5px] leading-relaxed text-[var(--ink-soft)]'
            : 'line-clamp-2 text-[11.5px] italic leading-relaxed text-[var(--muted-strong)]'}>
            {group.excerpt || '该评论的原文已不存在'}
          </span>
        </button>
        {group.anchor ? null : (
          <span className="mt-0.5 shrink-0 rounded-[4px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[9.5px] font-medium text-[var(--muted-strong)]">未锚定</span>
        )}
      </header>

      <div className="flex flex-col gap-3 border-t border-[var(--line)] px-3 py-2.5">
        {group.thread.comments.map((entry) => (
          <CommentEntryItem
            key={entry.id}
            entry={entry}
            isOwn={currentUserId === entry.authorId}
            deleting={deletingCommentId === entry.id}
            canComment={canComment}
            onDelete={onDeleteComment}
          />
        ))}
      </div>

      {resolve.error && resolve.threadId === group.threadId ? (
        <p className="flex items-center gap-1 px-3 pb-2 text-[11px] text-[var(--err-ink)]" role="alert">
          <WarningCircle aria-hidden className="size-3" weight="fill" />
          {resolve.error}
        </p>
      ) : null}
      {reply.error && reply.threadId === group.threadId ? (
        <p className="flex items-center gap-1 px-3 pb-2 text-[11px] text-[var(--err-ink)]" role="alert">
          <WarningCircle aria-hidden className="size-3" weight="fill" />
          {reply.error}
        </p>
      ) : null}

      <footer className="flex items-center gap-1.5 border-t border-[var(--line)] px-2.5 py-1.5">
        {canComment ? (
          resolved ? (
            <button
              type="button"
              onClick={() => onReopen(group.threadId)}
              disabled={resolvePending}
              className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:cursor-wait disabled:opacity-60"
            >
              <ArrowCounterClockwise aria-hidden className="size-3" />
              {resolvePending ? '重开中…' : '重新打开'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onToggleReply(group.threadId, !replying)}
                aria-expanded={replying}
                className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
              >
                <ChatsCircle aria-hidden className="size-3" />
                回复
              </button>
              <button
                type="button"
                onClick={() => onResolve(group.threadId)}
                disabled={resolvePending}
                className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--ok-ink)_9%,transparent)] hover:text-[var(--ok-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:cursor-wait disabled:opacity-60"
              >
                <Check aria-hidden className="size-3" />
                {resolvePending ? '解决中…' : '标记解决'}
              </button>
            </>
          )
        ) : (
          <span className="px-1.5 text-[10.5px] text-[var(--muted)]">只读：当前权限不能评论</span>
        )}
        {resolved ? (
          <span className="ml-auto flex items-center gap-1 pr-1 text-[10.5px] font-medium text-[var(--ok-ink)]">
            <CheckCircle aria-hidden className="size-3" weight="fill" />
            已解决
          </span>
        ) : null}
      </footer>

      {replying && canComment && !resolved ? (
        <div className="border-t border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-2">
          <CommentComposer
            placeholder={`回复 ${group.thread.comments.length > 1 ? '该评论线程' : '这条评论'}…`}
            submitLabel="回复"
            sendingLabel="发送中…"
            sending={replyPending}
            error={reply.threadId === group.threadId ? reply.error : null}
            onSubmit={(bodyMd) => onReply(group.threadId, bodyMd)}
            onCancel={() => onToggleReply(group.threadId, false)}
            autoFocus={false}
          />
        </div>
      ) : null}
    </article>
  );
}

/** The explainable orphan: an anchor whose thread is gone, with a remove action. */
export function OrphanAnchorCard({ orphan, onRemove }: { orphan: OrphanAnchorGroup; onRemove: (threadId: string) => void }) {
  return (
    <article
      data-comment-card={orphan.threadId}
      aria-label="无关联线程的评论锚点"
      className="rounded-[10px] border border-dashed border-[color-mix(in_srgb,var(--err-ink)_38%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_4%,transparent)] px-3 py-2.5"
    >
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--muted-strong)]">
        <WarningCircle aria-hidden className="mt-0.5 size-3 shrink-0" weight="fill" />
        此锚点没有对应的评论线程——线程可能已被删除，或创建未完成。锚点会保留正文不受影响。
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="line-clamp-1 rounded-[4px] bg-[var(--panel)] px-1.5 py-0.5 text-[11.5px] text-[var(--ink-soft)]">{orphan.excerpt}</span>
        <button
          type="button"
          onClick={() => onRemove(orphan.threadId)}
          className="h-6 shrink-0 rounded-[5px] border border-[var(--line)] px-2 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:border-[color-mix(in_srgb,var(--err-ink)_40%,transparent)] hover:text-[var(--err-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
        >
          移除锚点
        </button>
      </div>
    </article>
  );
}
