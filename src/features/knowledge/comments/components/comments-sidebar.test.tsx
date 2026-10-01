/**
 * Component tests of the comments sidebar (N02) under happy-dom: the real
 * CommentsSidebar over a hand-built sidebar model — the same component
 * PageComments mounts inside the editor's rail column. Real DOM events (act +
 * element.click) drive the states a reviewer sees: the four data states
 * (loading / error / empty / content), reading-order grouping with the
 * resolved fold, the unanchored and orphan sections with their explanations,
 * the reply composer loop, and the read-only permission matrix.
 */

import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { CommentThread } from '@fouc/shared/knowledge/comments';
import { deriveCommentSidebarModel } from '../comments-view-model';
import type { CommentAnchor } from '../comment-anchors';
import { CommentsSidebar } from './comments-sidebar';
import type { CommentsSidebarProps } from './comments-sidebar';

let window: Window;
const roots: Root[] = [];

beforeAll(() => {
  window = new Window({ url: 'https://knowledge.fouc.test/page' });
  const globals = window as unknown as Record<string, unknown>;
  for (const key of ['document', 'DOMParser', 'MutationObserver', 'Range', 'getSelection', 'HTMLElement', 'Element', 'Node', 'Text', 'Comment', 'customElements', 'requestAnimationFrame', 'Event', 'InputEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent']) {
    if (globals[key] !== undefined) (globalThis as Record<string, unknown>)[key] = globals[key];
  }
  (globalThis as Record<string, unknown>).window = window;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => {
      root.unmount();
    });
  }
});

function thread(id: string, options: { kind?: 'comment' | 'issue'; anchorKind?: 'page' | 'selection'; status?: 'open' | 'resolved'; comments?: { id: string; authorId: string; bodyMd: string; minutesAgo?: number }[] } = {}): CommentThread {
  const entries = options.comments ?? [{ id: `${id}-c1`, authorId: 'author-1', bodyMd: '首条评论' }];
  const createdAt = new Date(Date.now() - 30 * 60_000).toISOString();
  return {
    workspaceId: 'ws', id, pageId: 'page', kind: options.kind ?? 'issue', anchorKind: options.anchorKind ?? 'selection', status: options.kind === 'comment' ? null : options.status ?? 'open', createdAt, updatedAt: createdAt,
    comments: entries.map((entry, index) => ({
      workspaceId: 'ws', id: entry.id, threadId: id, authorId: entry.authorId, bodyMd: entry.bodyMd, likeCount: 0, liked: false,
      createdAt: new Date(Date.now() - (entry.minutesAgo ?? 30 - index) * 60_000).toISOString(),
      updatedAt: new Date(Date.now() - (entry.minutesAgo ?? 30 - index) * 60_000).toISOString(),
    })),
  };
}

interface MountOptions {
  threads: CommentThread[];
  anchors?: CommentAnchor[];
  status?: 'loading' | 'error' | 'ready';
  errorText?: string;
  canComment?: boolean;
  currentUserId?: string | null;
  replyingThreadId?: string | null;
  reply?: { pending: boolean; threadId: string | null; error: string | null };
  resolve?: { pending: boolean; threadId: string | null; error: string | null };
}

/** The controller-owned callbacks the tests stub — the sidebar's own prop types. */
type SidebarHandlers = Pick<CommentsSidebarProps,
  'onRetry' | 'onClose' | 'onLocate' | 'onReply' | 'onResolve' | 'onReopen' | 'onDeleteComment' | 'onRemoveOrphan' | 'onToggleReply'
  | 'onCreate' | 'onLike'
>;

async function mountSidebar(options: MountOptions, handlers: Partial<SidebarHandlers> = {}): Promise<HTMLElement> {
  const canComment = options.canComment ?? true;
  const excerptOf = (anchor: CommentAnchor) => anchor.ranges.map((range) => `pos${range.from}`).join(' ');
  const model = deriveCommentSidebarModel({
    threads: options.threads,
    anchors: options.anchors ?? [],
    excerptOf,
    pending: new Set(),
  });
  const host = window.document.createElement('div');
  window.document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  roots.push(root);
  await act(async () => {
    root.render(
      <CommentsSidebar
        model={model}
        replyingThreadId={options.replyingThreadId ?? null}
        activeThreadId={null}
        onRemoveOrphan={handlers.onRemoveOrphan ?? (() => {})}
        status={options.status ?? 'ready'}
        errorText={options.errorText ?? null}
        onRetry={handlers.onRetry ?? (() => {})}
        onClose={handlers.onClose ?? (() => {})}
        onCreate={handlers.onCreate ?? (async () => true)}
        create={{ pending: false, error: null }}
        like={{ pending: false, commentId: null, error: null }}
        onLike={handlers.onLike ?? (() => {})}
        canComment={canComment}
        currentUserId={options.currentUserId ?? 'me'}
        reply={options.reply ?? { pending: false, threadId: null, error: null }}
        resolve={options.resolve ?? { pending: false, threadId: null, error: null }}
        deletingCommentId={null}
        onLocate={handlers.onLocate ?? (() => {})}
        onReply={handlers.onReply ?? (() => {})}
        onResolve={handlers.onResolve ?? (() => {})}
        onReopen={handlers.onReopen ?? (() => {})}
        onDeleteComment={handlers.onDeleteComment ?? (() => {})}
        onToggleReply={handlers.onToggleReply ?? (() => {})}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return host as unknown as HTMLElement;
}

function buttonByText(scope: HTMLElement, text: string): HTMLButtonElement {
  const match = [...scope.querySelectorAll('button')].find((button) => button.textContent?.includes(text));
  if (!match) throw new Error(`button not found: ${text}`);
  return match;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}

describe('CommentsSidebar states and interactions', () => {
  test('loading renders skeletons, error renders the message with retry, empty explains how to start', async () => {
    const loading = await mountSidebar({ threads: [], status: 'loading' });
    expect(loading.querySelector('[role="status"]')).not.toBeNull();

    let retries = 0;
    const failed = await mountSidebar({ threads: [], status: 'error', errorText: '无法连接知识服务，请检查网络后重试。' }, { onRetry: () => { retries++; } });
    expect(failed.querySelector('[role="alert"]')?.textContent).toContain('无法连接知识服务');
    await click(buttonByText(failed, '重试'));
    expect(retries).toBe(1);

    const empty = await mountSidebar({ threads: [] });
    expect(empty.textContent).toContain('还没有评论');
    expect(empty.textContent).toContain('分享想法');

    const emptyReadonly = await mountSidebar({ threads: [], canComment: false });
    expect(emptyReadonly.textContent).toContain('页面的讨论');
  });

  test('threads render in anchor reading order with replies and filter by resolution status', async () => {
    const anchors: CommentAnchor[] = [
      { threadId: 'late-but-first-in-text', ranges: [{ from: 2, to: 6 }] },
      { threadId: 'early-created-but-later-in-text', ranges: [{ from: 40, to: 44 }] },
      { threadId: 'resolved-one', ranges: [{ from: 60, to: 64 }] },
    ];
    const sidebar = await mountSidebar({
      threads: [
        thread('early-created-but-later-in-text'),
        thread('late-but-first-in-text', { comments: [
          { id: 'c-a', authorId: 'author-2', bodyMd: '第一条' },
          { id: 'c-b', authorId: 'me', bodyMd: '第二条' },
        ] }),
        thread('resolved-one', { status: 'resolved' }),
      ],
      anchors,
    });
    const cards = [...sidebar.querySelectorAll<HTMLElement>('[data-comment-card]')];
    expect(cards.map(card => card.dataset.commentCard)).toEqual(['late-but-first-in-text', 'early-created-but-later-in-text', 'resolved-one']);
    expect(sidebar.textContent).toContain('第一条');
    expect(sidebar.querySelectorAll('button[aria-label="我的评论操作"]')).toHaveLength(1);
    expect(sidebar.querySelector('[role="tab"]')).toBeNull();
    expect(sidebar.querySelectorAll('[aria-label="评论筛选"] button')).toHaveLength(3);
  });

  test('unanchored threads and orphan anchors render with their explanations and actions', async () => {
    const sidebar = await mountSidebar({
      threads: [thread('orphaned-thread'), thread('anchored')],
      anchors: [{ threadId: 'anchored', ranges: [{ from: 3, to: 8 }] }, { threadId: 'ghost-anchor', ranges: [{ from: 10, to: 12 }] }],
    });
    expect(sidebar.textContent).toContain('原文已不存在');
    expect(sidebar.textContent).toContain('孤立锚点');
    expect(sidebar.textContent).toContain('此锚点没有对应的评论线程');

    let removed: string | null = null;
    const interactive = await mountSidebar(
      { threads: [], anchors: [{ threadId: 'ghost-anchor', ranges: [{ from: 10, to: 12 }] }] },
      { onRemoveOrphan: (threadId: string) => { removed = threadId; } },
    );
    await click(buttonByText(interactive, '移除锚点'));
    expect(removed).toBe('ghost-anchor');
  });

  test('the reply toggle asks the controller, empty submissions are guarded, failures render inline', async () => {
    const toggles: Array<[string, boolean]> = [];
    const requested = await mountSidebar(
      { threads: [thread('t1')] },
      { onToggleReply: (threadId: string, open: boolean) => { toggles.push([threadId, open]); } },
    );
    await click(buttonByText(requested, '回复'));
    expect(toggles.at(-1)).toEqual(['t1', true]);

    // The controller answers by remounting with the thread's composer open.
    const replies: Array<[string, string]> = [];
    const sidebar = await mountSidebar(
      { threads: [thread('t1')], replyingThreadId: 't1' },
      { onReply: (threadId: string, bodyMd: string) => { replies.push([threadId, bodyMd]); }, onToggleReply: (threadId: string, open: boolean) => { toggles.push([threadId, open]); } },
    );
    const composer = sidebar.querySelector('textarea');
    expect(composer).not.toBeNull();
    expect(composer!.getAttribute('placeholder')).toContain('回复');
    // An untouched composer never submits: the send control is inert for an
    // empty body even before its inline validation message appears.
    const send = [...sidebar.querySelectorAll('button')].filter((button) => button.textContent === '回复').at(-1)!;
    await click(send);
    expect(replies).toEqual([]);
    // Cancel hands the close decision back to the controller.
    await click(buttonByText(sidebar, '取消'));
    expect(toggles.at(-1)).toEqual(['t1', false]);

    // While the mutation runs, the send control shows the pending state.
    const pending = await mountSidebar({
      threads: [thread('t1')], replyingThreadId: 't1',
      reply: { pending: true, threadId: 't1', error: null },
    });
    expect(pending.textContent).toContain('发送中…');

    const failed = await mountSidebar({
      threads: [thread('t1')],
      reply: { pending: false, threadId: 't1', error: '请求过于频繁，请稍后重试。' },
    });
    expect(failed.querySelector('[role="alert"]')?.textContent).toContain('请求过于频繁');
  });

  test('resolve calls back per thread and read-only sessions get no mutating controls', async () => {
    let resolved: string | null = null;
    const sidebar = await mountSidebar(
      { threads: [thread('t-open')] },
      { onResolve: (threadId: string) => { resolved = threadId; } },
    );
    await click(sidebar.querySelector<HTMLButtonElement>('button[aria-label="标记解决"]')!);
    expect(resolved).toBe('t-open');

    const readonly = await mountSidebar({ threads: [thread('t-open')], canComment: false });
    expect(readonly.textContent).toContain('只读：当前权限不能评论');
    for (const label of ['回复', '标记解决']) {
      expect([...readonly.querySelectorAll('button')].some((button) => button.textContent === label)).toBe(false);
    }
  });

  test('ordinary page comments have no resolution control or missing-anchor warning, and support likes', async () => {
    const likes: Array<[string, boolean]> = [];
    const sidebar = await mountSidebar({ threads: [thread('free', { kind: 'comment', anchorKind: 'page' })] }, { onLike: (id, liked) => { likes.push([id, liked]); } });
    expect(sidebar.querySelector('[aria-label="标记解决"]')).toBeNull();
    expect(sidebar.textContent).not.toContain('原文已不存在');
    await click(sidebar.querySelector<HTMLButtonElement>('[aria-label="点赞"]')!);
    expect(likes).toEqual([['free-c1', true]]);
    expect(sidebar.querySelector('textarea[placeholder="写下评论，分享你的想法…"]')).not.toBeNull();
    expect(sidebar.textContent).toContain('作为问题');
  });

  test('resolved issues may still receive replies and read-only users cannot create or like comments', async () => {
    const sidebar = await mountSidebar({ threads: [thread('done', { status: 'resolved' })] });
    expect(sidebar.querySelector('button[aria-label="重新打开"]')).not.toBeNull();
    expect(buttonByText(sidebar, '回复')).not.toBeNull();
    const readonly = await mountSidebar({ threads: [thread('free', { kind: 'comment', anchorKind: 'page' })], canComment: false });
    expect(readonly.querySelector('textarea')).toBeNull();
    expect(readonly.querySelector<HTMLButtonElement>('[aria-label="点赞"]')?.disabled).toBe(true);
  });
});
