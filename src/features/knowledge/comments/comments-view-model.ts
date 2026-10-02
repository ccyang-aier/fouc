/**
 * The comments sidebar view-model (N02): pure derivations joining the page's
 * threads (Postgres truth) with the document's CRDT anchors. No React, no
 * DOM — grouping, ordering, the explainable orphan states and the plugin
 * styling context are all decidable in a plain test:
 *
 * - an anchored thread renders at its anchor's position in reading order;
 * - a thread whose anchor text is gone still renders (last), marked 未锚定;
 * - an anchor with no thread renders as an explainable orphan with a remove
 *   action — creation may still be pending, which is neither orphan nor thread.
 */

import type { CommentThread } from '@fouc/shared/knowledge/comments';
import type { CommentAnchor } from './comment-anchors';

export interface CommentThreadGroup {
  threadId: string;
  thread: CommentThread;
  anchor: CommentAnchor | null;
  excerpt: string;
  resolved: boolean;
}

export interface OrphanAnchorGroup {
  threadId: string;
  excerpt: string;
}

export interface CommentSidebarModel {
  /** Anchored threads in reading order (anchor position, then creation). */
  groups: CommentThreadGroup[];
  /** Threads whose anchor text no longer exists, in creation order. */
  unanchored: CommentThreadGroup[];
  /** Anchors with no thread and no pending creation. */
  orphans: OrphanAnchorGroup[];
  counts: { total: number; open: number; resolved: number; unanchored: number; orphan: number };
  /** Inputs for the editor plugin's styling context. */
  resolvedThreadIds: ReadonlySet<string>;
  orphanThreadIds: ReadonlySet<string>;
}

export function deriveCommentSidebarModel(input: {
  threads: readonly CommentThread[];
  anchors: readonly CommentAnchor[];
  excerptOf: (anchor: CommentAnchor) => string;
  /** Locally composing thread ids — optimistic anchors, neither orphan nor listed. */
  pending: ReadonlySet<string>;
}): CommentSidebarModel {
  const anchorsByThread = new Map(input.anchors.map((anchor) => [anchor.threadId, anchor]));
  const threadsById = new Map(input.threads.map((thread) => [thread.id, thread]));

  const groups: CommentThreadGroup[] = [];
  const unanchored: CommentThreadGroup[] = [];
  for (const thread of input.threads) {
    const anchor = anchorsByThread.get(thread.id) ?? null;
    const group: CommentThreadGroup = {
      threadId: thread.id,
      thread,
      anchor,
      excerpt: anchor ? input.excerptOf(anchor) : '',
      resolved: thread.status === 'resolved',
    };
    (thread.anchorKind === 'page' || anchor ? groups : unanchored).push(group);
  }
  groups.sort((left, right) => {
    const leftFrom = left.anchor ? Math.min(...left.anchor.ranges.map(range => range.from)) : Number.MAX_SAFE_INTEGER;
    const rightFrom = right.anchor ? Math.min(...right.anchor.ranges.map(range => range.from)) : Number.MAX_SAFE_INTEGER;
    return leftFrom - rightFrom || left.thread.createdAt.localeCompare(right.thread.createdAt) || left.thread.id.localeCompare(right.thread.id);
  });
  unanchored.sort((left, right) => left.thread.createdAt.localeCompare(right.thread.createdAt) || left.thread.id.localeCompare(right.thread.id));

  const orphans: OrphanAnchorGroup[] = [];
  const orphanThreadIds = new Set<string>();
  for (const anchor of input.anchors) {
    if (threadsById.has(anchor.threadId) || input.pending.has(anchor.threadId)) continue;
    orphanThreadIds.add(anchor.threadId);
    orphans.push({ threadId: anchor.threadId, excerpt: input.excerptOf(anchor) });
  }
  orphans.sort((left, right) => left.threadId.localeCompare(right.threadId));

  return {
    groups,
    unanchored,
    orphans,
    counts: {
      total: input.threads.length,
      open: input.threads.filter(thread => thread.kind === 'issue' && thread.status === 'open').length,
      resolved: input.threads.filter(thread => thread.status === 'resolved').length,
      unanchored: unanchored.length,
      orphan: orphans.length,
    },
    resolvedThreadIds: new Set(input.threads.filter((thread) => thread.status === 'resolved').map((thread) => thread.id)),
    orphanThreadIds,
  };
}

/** Compact clock time for card headers: 14:05 · 昨天 09:12 · 8月30日 14:00. */
export function formatCommentTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const clock = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  if (sameDay(at, now)) return clock;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, yesterday)) return `昨天 ${clock}`;
  if (at.getFullYear() === now.getFullYear()) return `${at.getMonth() + 1}月${at.getDate()}日 ${clock}`;
  return `${at.getFullYear()}年${at.getMonth() + 1}月${at.getDate()}日`;
}


export interface CommentFilters {
  kind: 'all' | 'comment' | 'issue' | 'open' | 'resolved';
  likes: 'all' | 'mine' | 'popular';
  time: 'all' | 'week' | 'month';
  sort: 'all' | 'newest' | 'oldest';
}
export const defaultCommentFilters: CommentFilters = { kind: 'all', likes: 'all', time: 'all', sort: 'all' };

/** All filters compose; default order follows document anchors, then page comments. */
export function filterCommentGroups(groups: readonly CommentThreadGroup[], filters: CommentFilters, now = Date.now()): CommentThreadGroup[] {
  const days = filters.time === 'week' ? 7 : filters.time === 'month' ? 30 : null;
  const filtered = groups.filter(({ thread }) => {
    if (filters.kind !== 'all' && (filters.kind === 'open' || filters.kind === 'resolved' ? thread.status !== filters.kind : thread.kind !== filters.kind)) return false;
    if (filters.likes === 'mine' && !thread.comments.some(entry => entry.liked)) return false;
    return days === null || new Date(thread.createdAt).getTime() >= now - days * 86_400_000;
  });
  const likeCount = (group: CommentThreadGroup) => group.thread.comments.reduce((sum, entry) => sum + entry.likeCount, 0);
  if (filters.likes === 'popular') filtered.sort((a, b) => likeCount(b) - likeCount(a) || b.thread.createdAt.localeCompare(a.thread.createdAt) || a.threadId.localeCompare(b.threadId));
  else if (filters.sort === 'newest' || filters.sort === 'oldest') filtered.sort((a, b) => (filters.sort === 'newest' ? -1 : 1) * (a.thread.createdAt.localeCompare(b.thread.createdAt) || a.threadId.localeCompare(b.threadId)));
  return filtered;
}
