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
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { CommentThread } from '@fouc/shared/knowledge/comments';
import { deriveCommentSidebarModel } from '../comments-view-model';
import type { CommentAnchor } from '../comment-anchors';
import type { CommentsSidebarProps } from './comments-sidebar';
import type { CommentReplyTarget } from './comment-thread-card';

let window: Window;
let createRoot: typeof import('react-dom/client')['createRoot'];
let CommentsSidebar: typeof import('./comments-sidebar')['CommentsSidebar'];
const roots: Root[] = [];

beforeAll(async () => {
  window = new Window({ url: 'https://knowledge.fouc.test/page' });
  const globals = window as unknown as Record<string, unknown>;
  for (const key of ['document', 'DOMParser', 'MutationObserver', 'ResizeObserver', 'Range', 'getSelection', 'getComputedStyle', 'HTMLElement', 'Element', 'Node', 'Text', 'Comment', 'customElements', 'requestAnimationFrame', 'Event', 'CustomEvent', 'InputEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent']) {
    if (globals[key] !== undefined) (globalThis as Record<string, unknown>)[key] = globals[key];
  }
  (globalThis as Record<string, unknown>).window = window;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ({ createRoot } = await import('react-dom/client'));
  ({ CommentsSidebar } = await import('./comments-sidebar'));
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
    workspaceId: 'ws', id, pageId: 'page', kind: options.kind ?? 'issue', anchorKind: options.anchorKind ?? 'selection', status: options.status ?? 'open', createdAt, updatedAt: createdAt,
    comments: entries.map((entry, index) => ({
      workspaceId: 'ws', id: entry.id, threadId: id, authorId: entry.authorId, replyToCommentId: index > 0 ? entries[index - 1].id : null, bodyMd: entry.bodyMd, likeCount: 0, liked: false,
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
  replyTarget?: CommentReplyTarget | null;
  authors?: CommentsSidebarProps['authors'];
  reply?: { pending: boolean; threadId: string | null; error: string | null };
  resolve?: { pending: boolean; threadId: string | null; error: string | null };
}

/** The controller-owned callbacks the tests stub — the sidebar's own prop types. */
type SidebarHandlers = Pick<CommentsSidebarProps,
  'onRetry' | 'onClose' | 'onLocate' | 'onReply' | 'onResolve' | 'onReopen' | 'onDeleteComment' | 'onRemoveOrphan' | 'onReplyTargetChange'
  | 'onCreate' | 'onLike' | 'onEdit' | 'onCopyLink'
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
        replyTarget={options.replyTarget ?? null}
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
        edit={{ pending: false, commentId: null, error: null }}
        onEdit={handlers.onEdit ?? (async () => true)}
        onCopyLink={handlers.onCopyLink ?? (async () => true)}
        canComment={canComment}
        currentUserId={options.currentUserId ?? 'me'}
        authors={options.authors}
        reply={options.reply ?? { pending: false, threadId: null, error: null }}
        resolve={options.resolve ?? { pending: false, threadId: null, error: null }}
        deletingCommentId={null}
        onLocate={handlers.onLocate ?? (() => {})}
        onReply={handlers.onReply ?? (async () => true)}
        onResolve={handlers.onResolve ?? (() => {})}
        onReopen={handlers.onReopen ?? (() => {})}
        onDeleteComment={handlers.onDeleteComment ?? (() => {})}
        onReplyTargetChange={handlers.onReplyTargetChange ?? (() => {})}
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

async function openEntryMenu(scope: HTMLElement) {
  const trigger = scope.querySelector<HTMLButtonElement>('[aria-label="评论操作"]')!;
  await act(async () => { trigger.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }) as unknown as Event); });
  return window.document.querySelector('[role="menu"]') as unknown as HTMLElement;
}

function menuItem(menu: HTMLElement, text: string) {
  return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === text);
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
    expect(sidebar.querySelectorAll('button[aria-label="评论操作"]')).toHaveLength(4);
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

  test('replies address real entries, appear below their target, retain failed drafts and guard empty submissions', async () => {
    const targets: Array<CommentReplyTarget | null> = [];
    const entries = [
      { id: 'root', authorId: 'alice', bodyMd: '根评论' },
      { id: 'second', authorId: 'bob', bodyMd: '回复根' },
      { id: 'third', authorId: 'alice', bodyMd: '回复第二条' },
    ];
    const requested = await mountSidebar({ threads: [thread('t1', { comments: entries })], authors: new Map([['alice', { name: 'Alice' }], ['bob', { name: 'Bob' }]]) }, {
      onReplyTargetChange: target => { targets.push(target); },
    });
    const cards = requested.querySelectorAll('article article');
    expect(cards.length).toBe(3);
    expect(cards[0].getAttribute('data-reply')).toBe('false');
    expect(cards[1].getAttribute('data-reply')).toBe('true');
    expect(cards[2].getAttribute('data-reply')).toBe('true');
    expect(cards[2].parentElement).toBe(cards[1].parentElement);
    expect(cards[1].textContent).toContain('回复 Alice');
    expect(cards[2].textContent).toContain('回复 Bob');
    await click(buttonByText(cards[2] as HTMLElement, '回复'));
    expect(targets.at(-1)).toEqual({ threadId: 't1', commentId: 'third' });
    const replies: Array<[CommentReplyTarget, string]> = [];
    const sidebar = await mountSidebar({
      threads: [thread('t1')], replyTarget: { threadId: 't1', commentId: 't1-c1' },
      reply: { pending: false, threadId: 't1', error: '请求过于频繁，请稍后重试。' },
    }, {
      onReply: async (target, body) => { replies.push([target, body]); return false; },
      onReplyTargetChange: target => { targets.push(target); },
    });
    const composer = sidebar.querySelector<HTMLTextAreaElement>('[data-comment-id="t1-c1"] textarea[placeholder^="回复"]')!;
    expect(composer).not.toBeNull();
    expect(sidebar.querySelector('footer textarea[placeholder^="回复"]')).toBeNull();
    expect(sidebar.querySelector('footer textarea[placeholder^="写下评论"]')).not.toBeNull();
    const send = sidebar.querySelector<HTMLButtonElement>('[aria-label="发送回复"]')!;
    await click(send);
    expect(replies).toEqual([]);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(composer, '保留的草稿');
      composer.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
    await act(async () => { composer.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }) as unknown as Event); });
    expect(replies).toEqual([[{ threadId: 't1', commentId: 't1-c1' }, '保留的草稿']]);
    expect(composer.value).toBe('保留的草稿');
    expect(sidebar.querySelector('[data-comment-id="t1-c1"] [role="alert"]')?.textContent).toContain('请求过于频繁');
    await click(buttonByText(sidebar, '取消'));
    expect(targets.at(-1)).toBeNull();
    const pending = await mountSidebar({ threads: [thread('t1')], replyTarget: { threadId: 't1', commentId: 't1-c1' }, reply: { pending: true, threadId: 't1', error: null } });
    expect(pending.querySelector<HTMLButtonElement>('[aria-label="发送中…"]')?.disabled).toBe(true);
  });

  test('resolve calls back per thread and read-only sessions get no mutating controls', async () => {
    let resolved: string | null = null;
    const sidebar = await mountSidebar(
      { threads: [thread('t-open')] },
      { onResolve: (threadId: string) => { resolved = threadId; } },
    );
    await click(menuItem(await openEntryMenu(sidebar), '标记为已解决')!);
    expect(resolved).toBe('t-open');

    const readonly = await mountSidebar({ threads: [thread('t-open')], canComment: false });
    expect(readonly.textContent).toContain('当前权限仅可查看评论');
    for (const label of ['回复', '标记为已解决']) {
      expect([...readonly.querySelectorAll('button')].some((button) => button.textContent === label)).toBe(false);
    }
    expect(menuItem(await openEntryMenu(readonly), '标记为已解决')).toBeUndefined();
  });

  test('ordinary page comments support resolution in the root menu and likes without a missing-anchor warning', async () => {
    const likes: Array<[string, boolean]> = [];
    const sidebar = await mountSidebar({ threads: [thread('free', { kind: 'comment', anchorKind: 'page' })] }, { onLike: (id, liked) => { likes.push([id, liked]); } });
    expect(menuItem(await openEntryMenu(sidebar), '标记为已解决')).toBeDefined();
    expect(sidebar.textContent).not.toContain('原文已不存在');
    await click(sidebar.querySelector<HTMLButtonElement>('[aria-label="点赞"]')!);
    expect(likes).toEqual([['free-c1', true]]);
    expect(sidebar.querySelector('textarea[placeholder="写下评论，分享你的想法…"]')).not.toBeNull();
    expect(sidebar.querySelector('[aria-label="评论发表类型"]')).not.toBeNull();
  });

  test('resolved issues may still receive replies and read-only users cannot create or like comments', async () => {
    const sidebar = await mountSidebar({ threads: [thread('done', { status: 'resolved' })] });
    expect(menuItem(await openEntryMenu(sidebar), '重新打开')).toBeDefined();
    expect(buttonByText(sidebar, '回复')).not.toBeNull();
    const readonly = await mountSidebar({ threads: [thread('free', { kind: 'comment', anchorKind: 'page' })], canComment: false });
    expect(readonly.querySelector('textarea')).toBeNull();
    expect(readonly.querySelector<HTMLButtonElement>('[aria-label="点赞"]')?.disabled).toBe(true);
  });

  test('resolved ordinary threads show a badge and reopen from the root menu, while replies have no thread action', async () => {
    let reopened: string | null = null;
    const sidebar = await mountSidebar({ threads: [thread('done', { kind: 'comment', status: 'resolved', comments: [
      { id: 'root', authorId: 'me', bodyMd: '根评论' }, { id: 'reply', authorId: 'me', bodyMd: '回复' },
    ] })] }, { onReopen: id => { reopened = id; } });
    expect(sidebar.querySelector('[data-comment-id="root"] [data-resolved="true"]')?.textContent).toContain('已解决');
    const rootMenu = await openEntryMenu(sidebar);
    expect([...rootMenu.querySelectorAll('[role="menuitem"]')].map(item => item.textContent)).toEqual(['编辑', '重新打开', '复制链接', '删除']);
    await click(menuItem(rootMenu, '重新打开')!);
    expect(reopened).toBe('done');
    expect(menuItem(await openEntryMenu(sidebar.querySelector('[data-comment-id="reply"]')!), '重新打开')).toBeUndefined();
  });

  test('resolution requests disable the menu action and surface server failures at their thread', async () => {
    const pending = await mountSidebar({ threads: [thread('t1')], resolve: { pending: true, threadId: 't1', error: null } });
    expect(menuItem(await openEntryMenu(pending), '标记中…')?.hasAttribute('data-disabled')).toBe(true);
    const failed = await mountSidebar({ threads: [thread('t2')], resolve: { pending: false, threadId: 't2', error: '无法保存解决状态，请重试。' } });
    expect(failed.querySelector('[role="alert"]')?.textContent).toContain('无法保存解决状态');
  });
});
