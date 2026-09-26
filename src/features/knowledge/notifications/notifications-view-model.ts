/**
 * The notification bell view-model (N03): pure derivations from inbox items to
 * the rows the popover renders — per-kind copy with actor and page, compact
 * relative time, unread state and the badge label. No React, no DOM, so every
 * rule below is decidable in a plain test.
 */

import type { NotificationItem, NotificationKind } from '@fouc/shared/knowledge/notifications';

export interface NotificationRowModel {
  id: string;
  kind: NotificationKind;
  unread: boolean;
  /** The acting member's display name, falling back to an anonymous copy. */
  actorName: string;
  /** Page label for the second line; comment notices always anchor a page. */
  pageLabel: string;
  /** Where a click navigates; null when there is nothing to open. */
  targetPageId: string | null;
  timeText: string;
  createdAt: string;
}

export function actorNameOf(item: NotificationItem): string {
  return item.actor?.name?.trim() || '有人';
}

export function pageLabelOf(item: NotificationItem): string {
  return item.page?.title?.trim() || '知识库页面';
}

/** Per-kind action copy: 「回复了你参与的评论」 / 「在评论中提到了你」. */
export function notificationVerb(kind: NotificationKind): string {
  return kind === 'comment.reply' ? '回复了你参与的评论' : '在评论中提到了你';
}

/** Compact clock time: 刚刚 · 5 分钟前 · 14:05 · 昨天 09:12 · 8月30日 14:00. */
export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const clock = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  if (sameDay(at, now)) return clock;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, yesterday)) return `昨天 ${clock}`;
  if (at.getFullYear() === now.getFullYear()) return `${at.getMonth() + 1}月${at.getDate()}日 ${clock}`;
  return `${at.getFullYear()}年${at.getMonth() + 1}月${at.getDate()}日`;
}

/** Badge text: empty for zero, the exact count up to 99, then 99+. */
export function notificationBadgeText(unreadCount: number): string {
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) return '';
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

export function deriveNotificationRows(items: readonly NotificationItem[], now: Date = new Date()): NotificationRowModel[] {
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    unread: item.readAt === null,
    actorName: actorNameOf(item),
    pageLabel: pageLabelOf(item),
    targetPageId: item.pageId,
    timeText: formatNotificationTime(item.createdAt, now),
    createdAt: item.createdAt,
  }));
}

/** Header copy under the panel title: 「3 条未读」 / 「暂无未读」. */
export function notificationSubtitle(unreadCount: number): string {
  return unreadCount > 0 ? `${unreadCount} 条未读` : '暂无未读';
}
