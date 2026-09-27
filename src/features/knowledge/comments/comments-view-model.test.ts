import { describe, expect, test } from 'bun:test';
import type { CommentThread } from '@fouc/shared/knowledge/comments';
import type { CommentAnchor } from './comment-anchors';
import { authorHueOf, deriveCommentSidebarModel, formatCommentTime } from './comments-view-model';

/**
 * Sidebar derivations (N02): the join of database threads with CRDT anchors
 * decides everything the rail shows — reading order, the two degenerate
 * sections, the pending exclusion and the styling-context inputs — so each
 * acceptance rule has one plain test here.
 */

const PAGE = '20000000-0000-4000-8000-000000000000';
const WORKSPACE = '30000000-0000-4000-8000-000000000000';
const T1 = '10000000-0000-4000-8000-000000000001';
const T2 = '10000000-0000-4000-8000-000000000002';
const T3 = '10000000-0000-4000-8000-000000000003';
const PENDING = '10000000-0000-4000-8000-0000000000ff';

function thread(id: string, overrides: Partial<CommentThread> = {}): CommentThread {
  return {
    workspaceId: WORKSPACE,
    id,
    pageId: PAGE,
    status: 'open',
    createdAt: `2026-09-2${id.endsWith('1') ? '4' : id.endsWith('2') ? '5' : '6'}T08:00:00Z`,
    updatedAt: '2026-09-26T08:00:00Z',
    comments: [{
      workspaceId: WORKSPACE,
      id: `40000000-0000-4000-8000-${id.slice(-12)}`,
      threadId: id,
      authorId: '50000000-0000-4000-8000-000000000000',
      bodyMd: '一条评论',
      createdAt: '2026-09-26T08:00:00Z',
      updatedAt: '2026-09-26T08:00:00Z',
    }],
    ...overrides,
  };
}

const anchor = (threadId: string, from: number): CommentAnchor => ({ threadId, ranges: [{ from, to: from + 5 }] });

function derive(input: { threads: CommentThread[]; anchors: CommentAnchor[]; pending?: ReadonlySet<string> }) {
  return deriveCommentSidebarModel({
    threads: input.threads,
    anchors: input.anchors,
    pending: input.pending ?? new Set<string>(),
    excerptOf: (an) => `excerpt-${an.threadId}`,
  });
}

describe('comments view-model · grouping and order', () => {
  test('anchored threads render in reading order regardless of creation time', () => {
    const model = derive({ threads: [thread(T1), thread(T2)], anchors: [anchor(T1, 40), anchor(T2, 10)] });
    expect(model.groups.map((group) => group.threadId)).toEqual([T2, T1]);
    expect(model.groups.map((group) => group.excerpt)).toEqual([`excerpt-${T2}`, `excerpt-${T1}`]);
  });

  test('a thread whose anchor is gone lands in the unanchored section, still listed and explained', () => {
    const model = derive({ threads: [thread(T1), thread(T2)], anchors: [anchor(T2, 10)] });
    expect(model.groups.map((group) => group.threadId)).toEqual([T2]);
    expect(model.unanchored.map((group) => group.threadId)).toEqual([T1]);
    expect(model.unanchored[0]!.anchor).toBeNull();
    expect(model.unanchored[0]!.excerpt).toBe('');
    expect(model.counts.unanchored).toBe(1);
  });

  test('an anchor without a thread is an orphan; a pending creation is neither orphan nor listed', () => {
    const model = derive({ threads: [thread(T1)], anchors: [anchor(T1, 3), anchor(T3, 9), anchor(PENDING, 20)], pending: new Set([PENDING]) });
    expect(model.orphans.map((orphan) => orphan.threadId)).toEqual([T3]);
    expect(model.orphans[0]!.excerpt).toBe(`excerpt-${T3}`);
    expect(model.orphanThreadIds.has(PENDING)).toBe(false);
    expect(model.groups.map((group) => group.threadId)).toEqual([T1]);
  });

  test('counts split open and resolved across both sections; resolved ids feed the plugin context', () => {
    const model = derive({
      threads: [thread(T1), thread(T2, { status: 'resolved' }), thread(T3, { status: 'resolved' })],
      anchors: [anchor(T1, 4), anchor(T2, 8)],
    });
    expect(model.counts.open).toBe(1);
    expect(model.counts.resolved).toBe(2);
    expect(model.groups.filter((group) => group.resolved).map((group) => group.threadId)).toEqual([T2]);
    expect(model.resolvedThreadIds.has(T2)).toBe(true);
    expect(model.resolvedThreadIds.has(T3)).toBe(true);
  });
});

describe('comments view-model · formatting', () => {
  test('times render as clock, 昨天, in-year date and cross-year date', () => {
    const now = new Date('2026-09-26T15:00:00');
    expect(formatCommentTime('2026-09-26T09:05:00', now)).toBe('09:05');
    expect(formatCommentTime('2026-09-25T09:05:00', now)).toBe('昨天 09:05');
    expect(formatCommentTime('2026-08-30T09:05:00', now)).toBe('8月30日 09:05');
    expect(formatCommentTime('2025-12-31T09:05:00', now)).toBe('2025年12月31日');
    expect(formatCommentTime('not-a-date', now)).toBe('');
  });

  test('author hues are stable and inside the color wheel', () => {
    expect(authorHueOf(T1)).toBe(authorHueOf(T1));
    expect(authorHueOf(T1)).not.toBe(authorHueOf(T2));
    for (const hue of [authorHueOf(T1), authorHueOf(T2), authorHueOf(T3)]) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(359);
    }
  });
});
