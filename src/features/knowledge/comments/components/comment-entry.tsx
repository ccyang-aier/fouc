'use client';

/**
 * One persisted comment entry of a thread card (N02): avatar hue derived from
 * the author id (identities stay distinguishable), the body, the creation
 * time and the author's own remove affordance with its pending state.
 */

import { TrashSimple } from '@phosphor-icons/react';
import type { CommentEntry } from '@fouc/shared/knowledge/comments';
import { authorHueOf, formatCommentTime } from '../comments-view-model';

export interface CommentEntryItemProps {
  entry: CommentEntry;
  isOwn: boolean;
  deleting: boolean;
  canComment: boolean;
  onDelete: (commentId: string) => void;
}

export function CommentEntryItem({ entry, isOwn, deleting, canComment, onDelete }: CommentEntryItemProps) {
  const hue = authorHueOf(entry.authorId);
  return (
    <article className="group/entry flex gap-2">
      <span
        aria-hidden
        className="mt-[7px] size-[8px] shrink-0 select-none rounded-full"
        style={{ background: `hsl(${hue} 46% 52%)` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-medium text-[var(--ink-soft)]">{isOwn ? '我' : '成员'}</span>
          <time className="text-[10.5px] text-[var(--muted)]" dateTime={entry.createdAt}>
            {formatCommentTime(entry.createdAt)}
          </time>
          {isOwn && canComment ? (
            <button
              type="button"
              aria-label={deleting ? '正在删除评论' : '删除我的评论'}
              title={deleting ? '正在删除…' : '删除我的评论'}
              disabled={deleting}
              onClick={() => onDelete(entry.id)}
              className="ml-auto flex size-5 items-center justify-center rounded-[4px] text-[var(--muted)] opacity-0 outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--err-ink)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] group-hover/entry:opacity-100 disabled:cursor-wait disabled:opacity-60"
            >
              <TrashSimple aria-hidden className="size-3" />
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
          {entry.bodyMd}
        </p>
      </div>
    </article>
  );
}
