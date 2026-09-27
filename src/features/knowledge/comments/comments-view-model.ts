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
  counts: { open: number; resolved: number; unanchored: number; orphan: number };
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
    (anchor ? groups : unanchored).push(group);
  }
  groups.sort((left, right) => {
    const leftFrom = Math.min(...left.anchor!.ranges.map((range) => range.from));
    const rightFrom = Math.min(...right.anchor!.ranges.map((range) => range.from));
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
      open: groups.filter((group) => !group.resolved).length + unanchored.filter((group) => !group.resolved).length,
      resolved: groups.filter((group) => group.resolved).length + unanchored.filter((group) => group.resolved).length,
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

/** Stable avatar hue per author id — identities stay distinguishable without names. */
export function authorHueOf(userId: string): number {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}
