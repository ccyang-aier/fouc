import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { BoardTask, TaskBoardDetail, TaskBoardSummary } from '@fouc/shared/tasks';
import type { BoardDraft } from './task-board-client';
import type { TaskDetailProps } from './task-detail';

function makeBoard(id: string, name: string): TaskBoardDetail {
  const task: BoardTask = {
    id: `${id}-task`, number: 1, columnId: `${id}-todo`, title: `${name} task`, description: '', priority: 'medium',
    assigneeIds: [], labels: [], dueDate: null, schedule: null, checklist: [], position: 0, createdBy: 'owner',
    createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z', commentCount: 0,
  };
  return {
    id, projectId: 'project', name, description: '', visibility: 'project', ownerId: 'owner', permission: 'owner',
    taskCount: 1, completedCount: 0, createdAt: task.createdAt, updatedAt: task.updatedAt,
    columns: [{ id: task.columnId, name: 'To do', color: 'slate', isDone: false, position: 0 }], tasks: [task],
    members: [{ userId: 'owner', name: 'Owner', email: 'owner@example.test', image: null, role: 'owner' }],
  };
}

const boardA = makeBoard('board-a', 'Board A');
const boardB = makeBoard('board-b', 'Board B');
const fixtures = new Map([[boardA.id, boardA], [boardB.id, boardB]]);
let directory: TaskBoardSummary[];
let failBackgroundDetail = false;
const api = {
  list: mock(async () => directory),
  get: mock(async (id: string) => {
    if (failBackgroundDetail) throw new Error('Connection interrupted');
    return fixtures.get(id)!;
  }),
  update: mock(async (id: string, draft: BoardDraft) => ({ ...fixtures.get(id)!, ...draft })),
  remove: mock(async () => ({ removed: true as const })),
  projectMembers: mock(async () => []),
};

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let renderPage: () => ReactNode;
let focusManager: typeof import('@tanstack/react-query')['focusManager'];

function Control(props: ComponentProps<'button'>) {
  return <button type="button" onClick={props.onClick} disabled={props.disabled} aria-label={props['aria-label']}>{props.children}</button>;
}
function MenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return <button type="button" data-menu-item onClick={onSelect}>{children}</button>;
}
function EditorFixture({ task }: TaskDetailProps) {
  const [draft, setDraft] = useState(task?.title ?? '');
  return <div data-task-editor><input aria-label="Task draft" value={draft} readOnly /><button type="button" onClick={() => setDraft('Unsaved task draft')}>Edit task draft</button></div>;
}
function BoardFormFixture({ board, onSubmit, onClose }: {
  board?: TaskBoardDetail; onSubmit: (draft: BoardDraft) => Promise<boolean>; onClose: () => void;
}) {
  const [name, setName] = useState(board?.name ?? '');
  return <div data-board-form><input aria-label="Board draft" value={name} readOnly />
    <button type="button" onClick={() => setName('Unsaved Board A settings')}>Edit board draft</button>
    <button type="button" onClick={async () => { if (await onSubmit({ name, description: '', visibility: 'private' })) onClose(); }}>Save board draft</button>
  </div>;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) {
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['Check', 'DotsThree', 'Kanban', 'ListChecks', 'LockSimple', 'PencilSimple', 'Plus', 'Trash', 'Users'].map(name => [name, icon])));
  mock.module('@/features/identity/identity-provider', () => ({ useIdentity: () => ({ session: { status: 'authenticated', user: { id: 'owner' } }, openSignIn: () => {} }) }));
  mock.module('@/features/project/project-resources', () => ({ useProjectResources: () => ({ selectedProject: { id: 'project', source: 'server' }, scopeKey: 'owner:server:project' }) }));
  mock.module('@/components/app-alert-provider', () => ({ useAppAlert: () => ({ notify: () => 1 }) }));
  mock.module('@/components/app-alert', () => ({ AppAlert: ({ title, action }: { title: string; action?: ReactNode }) => <div data-app-alert>{title}{action}</div> }));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: () => <span /> }));
  mock.module('./calendar/task-calendar', () => ({ TaskCalendar: () => <div data-calendar /> }));
  mock.module('@/components/ui/button', () => ({ Button: Control }));
  // Menu mechanics and native dialog focus are covered by real-browser checks.
  // These fixtures keep the page's resource selection and query lifecycle real.
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: Control,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: MenuItem,
    DropdownMenuSeparator: () => null,
  }));
  mock.module('./task-board-client', () => ({
    createTaskBoardClient: () => api,
    TaskBoardError: class extends Error { constructor(public code: string, message: string, public status: number) { super(message); } },
  }));
  mock.module('./task-board-picker', () => ({ TaskBoardPicker: ({ selected }: { selected?: TaskBoardSummary }) => <h1 data-current-board>{selected?.name}</h1> }));
  mock.module('./task-board-toolbar', () => ({ TaskBoardToolbar: ({ onSettings, onRemoveBoard }: { onSettings: () => void; onRemoveBoard: () => void }) => <><MenuItem onSelect={onSettings}>看板设置</MenuItem><MenuItem onSelect={onRemoveBoard}>删除看板</MenuItem></> }));
  mock.module('./kanban-board', () => ({ KanbanBoard: ({ board, onOpen }: { board: TaskBoardDetail; onOpen: (task: BoardTask) => void }) => <button type="button" data-open-task onClick={() => onOpen(board.tasks[0])}>Open task</button> }));
  mock.module('./task-board-members', () => ({ TaskBoardMembers: () => null }));
  mock.module('./task-board-dialogs', () => ({
    TaskBoardForm: BoardFormFixture,
    TaskColumnForm: () => null,
    TaskConfirm: ({ onConfirm, description }: { onConfirm: () => Promise<boolean>; description: string }) => <div data-board-confirm>{description}<button type="button" onClick={() => void onConfirm()}>Confirm deletion</button></div>,
  }));
  mock.module('./task-detail', () => ({ TaskDetail: EditorFixture }));
  ({ focusManager } = await import('@tanstack/react-query'));
  const { TaskBoardsPage } = await import('./task-boards-page');
  renderPage = () => <TaskBoardsPage />;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
  directory = [boardA, boardB];
  failBackgroundDetail = false;
  for (const method of Object.values(api)) method.mockClear();
  focusManager.setFocused(true);
});

afterAll(async () => {
  await act(async () => root.unmount());
  focusManager.setFocused(undefined);
  await browser.happyDOM.abort();
  mock.restore();
});

async function until(predicate: () => boolean) {
  for (let turn = 0; turn < 30 && !predicate(); turn++) await act(async () => { await Bun.sleep(0); });
  expect(predicate()).toBe(true);
}
async function render() {
  await act(async () => root.render(renderPage()));
  await until(() => Boolean(host.querySelector('[data-open-task]')));
  expect(host.querySelector('[data-current-board]')?.textContent).toBe(boardA.name);
}
async function click(selector: string) {
  const button = host.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}
async function menuItem(label: string) {
  const item = [...host.querySelectorAll<HTMLButtonElement>('[data-menu-item]')].find(node => node.textContent === label);
  expect(item).toBeDefined();
  await act(async () => item!.click());
}
async function backgroundRefetch() {
  // Refetch through React Query's actual mounted observers, without 15s sleeps.
  await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); });
}

test('a transient background detail request failure preserves the open editor and unsaved draft', async () => {
  await render();
  await click('[data-open-task]');
  await click('[data-task-editor] button');
  const input = host.querySelector<HTMLInputElement>('[data-task-editor] input')!;
  expect(input.value).toBe('Unsaved task draft');
  const previousRequests = api.get.mock.calls.length;
  failBackgroundDetail = true;
  await backgroundRefetch();
  await until(() => api.get.mock.calls.length > previousRequests && Boolean(host.querySelector('[data-app-alert]')));
  expect(host.querySelector('[data-task-editor] input')).toBe(input);
  expect(input.value).toBe('Unsaved task draft');
  expect(host.querySelector('[data-current-board]')?.textContent).toBe(boardA.name);
});

test.each(['settings', 'deletion'] as const)('removing Board A from the directory cannot apply its open %s dialog to Board B', async (kind) => {
  await render();
  await menuItem(kind === 'settings' ? '看板设置' : '删除看板');
  const dialogSelector = kind === 'settings' ? '[data-board-form]' : '[data-board-confirm]';
  expect(host.querySelector(dialogSelector)).not.toBeNull();
  if (kind === 'settings') await click('[data-board-form] button');

  directory = [boardB];
  await backgroundRefetch();
  await until(() => host.querySelector('[data-current-board]')?.textContent === boardB.name && Boolean(host.querySelector('[data-open-task]')));
  expect(host.querySelector(dialogSelector)).toBeNull();
  expect(api.update.mock.calls).toHaveLength(0);
  expect(api.remove.mock.calls).toHaveLength(0);
  expect(boardB.name).toBe('Board B');
});
