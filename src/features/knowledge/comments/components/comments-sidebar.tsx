'use client';

/**
 * The comments sidebar rail (N02): threads grouped by their CRDT anchor in
 * reading order, resolved threads folded behind one disclosure, the two
 * degenerate sections (未锚定 threads, orphan anchors) each with an honest
 * explanation, and the four data states (loading / error / empty / content)
 * never fabricated. Real-time arrival of other members' threads is the B06
 * `comment.changed` invalidation refetching this list.
 */

import { useState } from 'react';
import { ChatsCircle, CheckCircle, ChatSlash, WarningCircle, X } from '@phosphor-icons/react';
import type { CommentSidebarModel } from '../comments-view-model';
import { CommentThreadCard, OrphanAnchorCard } from './comment-thread-card';
import type { CommentThreadCardProps } from './comment-thread-card';

export interface CommentsSidebarProps extends Pick<CommentThreadCardProps,
  'canComment' | 'currentUserId' | 'reply' | 'resolve' | 'deletingCommentId' | 'onLocate' | 'onReply' | 'onResolve' | 'onReopen' | 'onDeleteComment'
> {
  model: CommentSidebarModel;
  replyingThreadId: string | null;
  onToggleReply: (threadId: string, open: boolean) => void;
  activeThreadId: string | null;
  onRemoveOrphan: (threadId: string) => void;
  status: 'loading' | 'error' | 'ready';
  errorText: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export function CommentsSidebar({
  model,
  replyingThreadId,
  onToggleReply,
  activeThreadId,
  onRemoveOrphan,
  status,
  errorText,
  onRetry,
  onClose,
  ...card
}: CommentsSidebarProps) {
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const openGroups = model.groups.filter((group) => !group.resolved);
  const resolvedGroups = model.groups.filter((group) => group.resolved);
  const hasDegenerate = model.unanchored.length > 0 || model.orphans.length > 0;

  return (
    <aside aria-label="页面评论" className="flex h-full w-[304px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel)]">
      <header className="flex h-[42px] shrink-0 items-center gap-2 border-b border-[var(--line)] pl-4 pr-2">
        <ChatsCircle aria-hidden className="size-3.5 text-[var(--warn-ink)]" weight="fill" />
        <span className="text-[12px] font-medium text-[var(--ink)]">评论</span>
        {status === 'ready' && (model.counts.open > 0 || model.counts.resolved > 0) ? (
          <span className="rounded-full bg-[var(--raise)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">
            {model.counts.open} 进行中{model.counts.resolved > 0 ? ` · ${model.counts.resolved} 已解决` : ''}
          </span>
        ) : null}
        <button
          type="button"
          aria-label="收起评论栏"
          title="收起评论栏"
          onClick={onClose}
          className="ml-auto flex size-7 items-center justify-center rounded-[6px] text-[var(--muted)] outline-none transition-colors hover:bg-[var(--raise)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {status === 'loading' ? (
          <div role="status" aria-label="正在加载评论" className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-[10px] border border-[var(--line)] p-3">
                <div className="h-[11px] w-[62%] animate-pulse rounded bg-[var(--raise)]" />
                <div className="mt-2.5 h-[11px] w-full animate-pulse rounded bg-[var(--raise)]" />
                <div className="mt-1.5 h-[11px] w-[38%] animate-pulse rounded bg-[var(--raise)]" />
              </div>
            ))}
          </div>
        ) : status === 'error' ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--err-ink)_28%,transparent)] bg-[color-mix(in_srgb,var(--err-ink)_8%,transparent)] text-[var(--err-ink)]">
              <WarningCircle aria-hidden className="size-5" weight="fill" />
            </span>
            <p className="text-[13px] font-medium text-[var(--ink)]">评论加载失败</p>
            <p className="max-w-[240px] text-[11.5px] leading-relaxed text-[var(--muted-strong)]">{errorText}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 h-7 rounded-[6px] border border-[var(--line)] px-3 text-[11.5px] font-medium text-[var(--ink-soft)] outline-none transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
            >
              重试
            </button>
          </div>
        ) : openGroups.length === 0 && resolvedGroups.length === 0 && model.unanchored.length === 0 && model.orphans.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--muted-strong)]">
              <ChatsCircle aria-hidden className="size-5" />
            </span>
            <p className="text-[13px] font-medium text-[var(--ink)]">还没有评论</p>
            <p className="max-w-[220px] text-[11.5px] leading-relaxed text-[var(--muted-strong)]">
              {card.canComment ? '在正文中选中一段文字，点「评论」开始第一条讨论；锚点会跟随协作编辑保持稳定。' : '页面出现评论后会在这里按正文位置列出。'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openGroups.map((group) => (
              <CommentThreadCard
                key={group.threadId}
                group={group}
                active={activeThreadId === group.threadId}
                replying={replyingThreadId === group.threadId}
                onToggleReply={onToggleReply}
                {...card}
              />
            ))}

            {resolvedGroups.length > 0 ? (
              <section aria-label="已解决的评论">
                <button
                  type="button"
                  onClick={() => setResolvedOpen((open) => !open)}
                  aria-expanded={resolvedOpen}
                  className="flex w-full items-center gap-1.5 rounded-[6px] px-1 py-1 text-[11px] font-medium text-[var(--muted-strong)] outline-none transition-colors hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
                >
                  <CheckCircle aria-hidden className="size-3 text-[var(--ok-ink)]" weight="fill" />
                  已解决（{resolvedGroups.length}）
                  <span aria-hidden className="text-[var(--muted)]">{resolvedOpen ? '收起' : '展开'}</span>
                </button>
                {resolvedOpen ? (
                  <div className="mt-1.5 flex flex-col gap-2.5">
                    {resolvedGroups.map((group) => (
                      <CommentThreadCard
                        key={group.threadId}
                        group={group}
                        active={activeThreadId === group.threadId}
                        replying={replyingThreadId === group.threadId}
                        onToggleReply={onToggleReply}
                        {...card}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {model.unanchored.length > 0 ? (
              <section aria-label="未锚定的评论线程" className="mt-1 border-t border-[var(--line)] pt-2.5">
                <p className="px-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--muted)]">原文已不存在</p>
                <div className="flex flex-col gap-2.5">
                  {model.unanchored.map((group) => (
                    <CommentThreadCard
                      key={group.threadId}
                      group={group}
                      active={activeThreadId === group.threadId}
                      replying={replyingThreadId === group.threadId}
                      onToggleReply={onToggleReply}
                      {...card}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {model.orphans.length > 0 ? (
              <section aria-label="无关联线程的锚点" className="mt-1 border-t border-[var(--line)] pt-2.5">
                <p className="flex items-center gap-1 px-1 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--muted)]">
                  <ChatSlash aria-hidden className="size-3" />
                  孤立锚点
                </p>
                <div className="flex flex-col gap-2.5">
                  {model.orphans.map((orphan) => (
                    <OrphanAnchorCard
                      key={orphan.threadId}
                      orphan={orphan}
                      onRemove={onRemoveOrphan}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {hasDegenerate ? (
              <p className="px-1 pt-0.5 text-[10px] leading-relaxed text-[var(--muted)]">
                未锚定与孤立状态会在协作与刷新后如实保留；只有确认删除线程或手动移除时锚点才会消失。
              </p>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
