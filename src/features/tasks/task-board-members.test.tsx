import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { ProjectTaskMember, TaskBoardDetail, TaskBoardMemberRole } from '@fouc/shared/tasks';
import type { TaskBoardClient } from './task-board-client';

const people: ProjectTaskMember[] = Array.from({ length: 6 }, (_, index) => ({ userId: `member-${index}`, name: `Member ${index}`, email: `member${index}@example.test`, image: null }));
const initialBoard: TaskBoardDetail = {
  id: 'board-a', projectId: 'project', name: 'Feature board', description: '', visibility: 'invited', ownerId: people[0].userId, permission: 'owner', views: [],
  taskCount: 0, completedCount: 0, createdAt: '2026-10-18T01:00:00Z', updatedAt: '2026-10-18T02:03:00Z', columns: [], tasks: [],
  members: people.slice(0, 5).map((member, index) => ({ ...member, role: index ? 'viewer' : 'owner' })),
};
let currentBoard = initialBoard;
const client = {
  projectMembers: mock(async () => people),
  setMember: mock(async (boardId: string, userId: string, role: TaskBoardMemberRole) => {
    expect(boardId).toBe(currentBoard.id);
    const person = people.find(member => member.userId === userId)!;
    return { ...currentBoard, members: currentBoard.members.some(member => member.userId === userId) ? currentBoard.members.map(member => member.userId === userId ? { ...member, role } : member) : [...currentBoard.members, { ...person, role }] };
  }),
  removeMember: mock(async (boardId: string, userId: string) => {
    expect(boardId).toBe(currentBoard.id);
    return { ...currentBoard, members: currentBoard.members.filter(member => member.userId !== userId) };
  }),
} satisfies Pick<TaskBoardClient, 'projectMembers' | 'setMember' | 'removeMember'>;
const editSettings = mock(() => {});
let browser: Window;
let root: Root;
let host: HTMLDivElement;
let query: import('@tanstack/react-query').QueryClient;
let newQuery: () => import('@tanstack/react-query').QueryClient;
let renderHeader: (board: TaskBoardDetail) => ReactNode;
let setOverlayRoot: typeof import('@/lib/overlay-root').setOverlayRoot;
let Members: typeof import('./task-board-members').TaskBoardMembers;

function Header({ initial }: { initial: TaskBoardDetail }) {
  const [board, setBoard] = useState(initial);
  return <><button type="button" data-outside>Outside</button><Members board={board} client={client as unknown as TaskBoardClient} onChanged={next => { currentBoard = next; setBoard(next); }} onEditSettings={editSettings} /></>;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'SVGElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'DocumentFragment', 'MutationObserver', 'ResizeObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser;
  globals.requestAnimationFrame = browser.requestAnimationFrame.bind(browser);
  globals.cancelAnimationFrame = browser.cancelAnimationFrame.bind(browser);
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['CaretDown', 'CaretRight', 'Check', 'ClockCounterClockwise', 'Eye', 'MagnifyingGlass', 'PencilSimple', 'Plus', 'UserMinus', 'Users', 'X', 'CheckCircle', 'Info', 'WarningCircle', 'XCircle'].map(name => [name, () => <svg data-icon={name} aria-hidden />])));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: ({ name, className }: { name: string; className?: string }) => <span data-portrait={name} className={className}>{name[0]}</span> }));
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  newQuery = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  ({ setOverlayRoot } = await import('@/lib/overlay-root'));
  Members = (await import('./task-board-members')).TaskBoardMembers;
  const { TooltipProvider } = await import('@/components/ui/tooltip');
  renderHeader = board => <QueryClientProvider client={query}><TooltipProvider><Header key={board.id} initial={board} /></TooltipProvider></QueryClientProvider>;
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div');
  document.body.append(host);
  setOverlayRoot(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
  query?.clear();
  query = newQuery();
  currentBoard = initialBoard;
  for (const method of Object.values(client)) method.mockClear();
  editSettings.mockClear();
});
afterAll(async () => { await act(async () => root.unmount()); query.clear(); setOverlayRoot(null); await browser.happyDOM.abort(); mock.restore(); });

async function until(condition: () => boolean) {
  for (let turn = 0; turn < 40 && !condition(); turn++) await act(async () => { await Bun.sleep(0); });
  expect(condition()).toBe(true);
}
async function render(board = initialBoard) { currentBoard = board; await act(async () => root.render(renderHeader(board))); }
function control(label: string) { return host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!; }
function panel() { return host.querySelector<HTMLElement>('[role="dialog"]'); }
function inviteButton() { return [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '邀请')!; }
async function pointer(target: HTMLElement) { await act(async () => target.dispatchEvent(new browser.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }) as unknown as Event)); }
async function escape() { await act(async () => document.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }) as unknown as Event)); }
async function type(label: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new browser.Event('input', { bubbles: true }) as unknown as Event);
  });
}
function listedNames() { return [...panel()!.querySelectorAll('section[aria-label="看板成员"] [data-portrait]')].map(person => person.getAttribute('data-portrait')); }

test('five real members render three portraits and +2; nested role menus stay in the overlay and Escape restores focus in two steps', async () => {
  await render();
  const trigger = control('5 位成员');
  expect(trigger.querySelectorAll('[data-portrait]').length).toBe(3);
  expect(trigger.textContent).toContain('+2');
  expect(trigger.querySelector('button')).toBeNull();
  expect(trigger.querySelector('[role="group"]')?.getAttribute('style')).toContain('28px');
  expect(host.querySelector('time')?.getAttribute('datetime')).toBe(initialBoard.updatedAt);
  expect(client.projectMembers.mock.calls.length).toBe(0);
  await act(async () => { trigger.focus(); trigger.click(); });
  expect(panel()?.getAttribute('aria-modal')).toBe('false');
  expect(panel()?.getAttribute('aria-label')).toBe('成员与权限');
  expect(panel()?.querySelector('header, h1, h2, h3')).toBeNull();
  expect(panel()?.querySelector('button[aria-label="关闭"]')).toBeNull();
  expect(panel()?.textContent).not.toContain('仅受邀成员可见');
  expect(panel()?.parentElement).toBe(host);
  await until(() => client.projectMembers.mock.calls.length === 1);
  const role = control('Member 1 的权限：只读');
  await pointer(role);
  await until(() => Boolean(host.querySelector('[data-task-members-menu]')));
  const roleMenu = host.querySelector<HTMLElement>('[data-task-members-menu]')!;
  const choices = roleMenu.querySelectorAll('[role="menuitemradio"]');
  expect(roleMenu.getAttribute('data-density')).toBe('compact');
  expect(choices[0].querySelector('svg[data-icon="Eye"]')).not.toBeNull();
  expect(choices[1].querySelector('svg[data-icon="PencilSimple"]')).not.toBeNull();
  expect(choices[0].getAttribute('aria-checked')).toBe('true');
  expect(choices[1].getAttribute('aria-checked')).toBe('false');
  expect(host.querySelector('[data-task-members-menu]')?.closest('[data-radix-popper-content-wrapper]')?.parentElement).toBe(host);
  await pointer(host.querySelector<HTMLElement>('[data-task-members-menu]')!);
  expect(panel()).not.toBeNull();
  await escape();
  await until(() => !host.querySelector('[data-task-members-menu]'));
  expect(panel()).not.toBeNull();
  await until(() => document.activeElement === role);
  await pointer(role);
  await until(() => Boolean(host.querySelector('[data-task-members-menu]')));
  const edit = [...host.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(item => item.textContent === '可编辑')!;
  await act(async () => edit.click());
  await until(() => client.setMember.mock.calls.length === 1);
  expect(client.setMember.mock.calls[0]).toEqual([initialBoard.id, 'member-1', 'editor']);
  expect(panel()).not.toBeNull();
  await until(() => !host.querySelector('[data-task-members-menu]'));
  await escape();
  expect(panel()).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test('Invite focuses current-project search and grants viewer by default; click-away keeps the newer outside focus', async () => {
  await render();
  await act(async () => inviteButton().click());
  await until(() => Boolean(host.querySelector('input[aria-label="搜索项目成员…"]')));
  expect(document.activeElement).toBe(host.querySelector('input[aria-label="搜索项目成员…"]'));
  expect(host.querySelector('input[aria-label="搜索看板成员…"]')).not.toBeNull();
  await type('搜索看板成员…', 'Member 1');
  expect(listedNames()).toEqual(['Member 1']);
  await type('搜索项目成员…', 'Member 5');
  expect(listedNames()).toEqual(['Member 1']);
  const candidate = panel()!.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!;
  expect(candidate.textContent).toContain('Member 5');
  await act(async () => candidate.click());
  await pointer(control('新成员权限'));
  await until(() => Boolean(host.querySelector('[data-task-members-menu]')));
  const choices = host.querySelectorAll('[data-task-members-menu] [role="menuitemradio"]');
  expect(choices[0].querySelector('svg[data-icon="Eye"]')).not.toBeNull();
  expect(choices[1].querySelector('svg[data-icon="PencilSimple"]')).not.toBeNull();
  expect(choices[0].getAttribute('aria-checked')).toBe('true');
  await escape();
  await until(() => !host.querySelector('[data-task-members-menu]'));
  const add = [...panel()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '添加成员')!;
  await act(async () => add.click());
  await until(() => client.setMember.mock.calls.length === 1);
  expect(client.setMember.mock.calls[0]).toEqual([initialBoard.id, 'member-5', 'viewer']);
  const outside = host.querySelector<HTMLButtonElement>('[data-outside]')!;
  await act(async () => outside.focus());
  await pointer(outside);
  expect(panel()).toBeNull();
  expect(document.activeElement).toBe(outside);
});

test('private boards focus visibility settings instead of silently inviting a member', async () => {
  await render({ ...initialBoard, visibility: 'private', members: [initialBoard.members[0]] });
  await act(async () => inviteButton().click());
  const settings = [...panel()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '调整可见范围')!;
  expect(document.activeElement).toBe(settings);
  expect(panel()!.querySelector('input[aria-label="搜索项目成员…"]')).toBeNull();
  expect(panel()!.querySelector('input[aria-label="搜索看板成员…"]')).not.toBeNull();
  expect(client.projectMembers.mock.calls.length).toBe(0);
  await act(async () => settings.click());
  expect(editSettings.mock.calls.length).toBe(1);
  expect(client.setMember.mock.calls.length).toBe(0);
  expect(panel()).toBeNull();
});

test('board member search filters names and email without changing project visibility or opening the invitation directory', async () => {
  await render({ ...initialBoard, visibility: 'project' });
  await act(async () => control('5 位成员').click());
  expect(document.activeElement).toBe(panel()!.querySelector('input[aria-label="搜索看板成员…"]'));
  expect(panel()!.textContent).not.toContain('项目成员可见');
  expect(panel()!.textContent).not.toContain('所有项目成员默认只读');
  expect(panel()!.querySelector('header, h1, h2, h3')).toBeNull();
  await type('搜索看板成员…', 'Member 2');
  expect(listedNames()).toEqual(['Member 2']);
  await type('搜索看板成员…', 'MEMBER3@EXAMPLE.TEST');
  expect(listedNames()).toEqual(['Member 3']);
  await type('搜索看板成员…', 'missing person');
  expect(listedNames()).toEqual([]);
  expect(panel()!.textContent).toContain('没有找到匹配的看板成员');
  expect(control('5 位成员')).not.toBeNull();
  expect(client.projectMembers.mock.calls.length).toBe(0);
  expect(client.setMember.mock.calls.length).toBe(0);
});

test('switching the keyed board resets the open panel and viewer headers expose no invite or permission controls', async () => {
  await render();
  await act(async () => control('5 位成员').click());
  expect(panel()).not.toBeNull();
  await render({ ...initialBoard, id: 'board-b', name: 'Other board', permission: 'viewer' });
  expect(panel()).toBeNull();
  expect(inviteButton()).toBeUndefined();
  await act(async () => control('5 位成员').click());
  expect(panel()!.querySelectorAll('button[aria-haspopup="menu"]').length).toBe(0);
});
