import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import type { TaskTableProps } from './task-table';

const task = { id: 'task-1', number: 1, columnId: 'todo', title: 'First task', description: 'Real description', priority: 'high' as const, assigneeIds: [], labels: ['Design'], dueDate: '2026-10-25', schedule: null, checklist: [], position: 0, createdBy: 'owner', createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', commentCount: 0 };
const board: TaskBoardDetail = {
  id: 'board', projectId: 'project', name: 'Board', description: '', visibility: 'private', ownerId: 'owner', permission: 'owner', views: [], taskCount: 2, completedCount: 0,
  createdAt: task.createdAt, updatedAt: task.updatedAt, members: [],
  columns: [{ id: 'todo', name: 'To do', color: 'slate', isDone: false, position: 0 }, { id: 'done', name: 'Done', color: 'green', isDone: true, position: 1 }],
  tasks: [task, { ...task, id: 'task-2', number: 2, title: 'Second task', position: 1 }],
};
let browser: Window, host: HTMLDivElement, root: Root;
let Table: typeof import('./task-table')['TaskTable'];
let moveSucceeds = true;
const move = mock<TaskTableProps['onMoveTasks']>(async () => moveSucceeds);
const open = mock(() => {});
const create = mock(() => {});
const remove = mock(() => {});

function Trigger({ children, ...props }: ComponentProps<'button'>) { return <button type="button" {...props}>{children}</button>; }
function Item({ children, onSelect, disabled }: { children: ReactNode; onSelect?: () => void; disabled?: boolean }) { return <button type="button" disabled={disabled} onClick={onSelect}>{children}</button>; }

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  globals.requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 1; };
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['ArrowRight', 'CaretDown', 'CaretUp', 'DotsThree', 'Flag', 'PencilSimple', 'Plus', 'Trash', 'X'].map(name => [name, icon])));
  mock.module('@/components/avatar-group', () => ({ AvatarGroup: () => <span /> }));
  // Native checkbox and table behavior remain real; portal/focus mechanics use browser QA.
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: ReactNode }) => <div data-menu>{children}</div>,
    DropdownMenuTrigger: Trigger, DropdownMenuItem: Item, DropdownMenuSubTrigger: Item,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuSeparator: () => null, DropdownMenuSearch: () => null,
  }));
  ({ TaskTable: Table } = await import('./task-table'));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
beforeEach(async () => {
  await act(async () => root.render(null));
  moveSucceeds = true; move.mockClear(); open.mockClear(); create.mockClear(); remove.mockClear();
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });
async function render(overrides: Partial<TaskTableProps> = {}) {
  await act(async () => root.render(<Table board={board} tasks={board.tasks} busy={false} onOpen={open} onCreate={create} onRemove={remove} onMoveTasks={move} {...overrides} />));
}
async function click(label: string) {
  const element = host.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(element).not.toBeNull(); await act(async () => element!.click());
}
async function moveSelection() {
  const trigger = host.querySelector('[aria-label="移动所选任务"]')!;
  const destination = [...trigger.closest('[data-menu]')!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Done')!;
  await act(async () => destination.click());
}

test('group selection is indeterminate for one row and selects only visible tasks after filtering', async () => {
  await render();
  await click('选择任务：First task');
  const all = host.querySelector<HTMLInputElement>('[aria-label="选择“To do”中的所有可见任务"]')!;
  expect(all.indeterminate).toBe(true);
  await click('选择任务：Second task');
  expect(all.checked).toBe(true); expect(all.indeterminate).toBe(false);
  await render({ tasks: [board.tasks[0]] });
  await moveSelection();
  expect(move.mock.calls).toEqual([[['task-1'], 'done']]);
  expect(host.querySelector('[aria-label="移动所选任务"]')).toBeNull();
});

test('a failed move retains the selection and successful retry clears it', async () => {
  await render(); await click('选择任务：First task');
  moveSucceeds = false;
  await moveSelection();
  expect(host.querySelector('[aria-label="移动所选任务"]')).not.toBeNull();
  moveSucceeds = true;
  await moveSelection();
  expect(move.mock.calls).toHaveLength(2);
  expect(host.querySelector('[aria-label="移动所选任务"]')).toBeNull();
});

test('viewer access hides all mutation and selection controls, while task details remain readable', async () => {
  await render({ board: { ...board, permission: 'viewer' } });
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  expect(host.querySelector('[aria-label^="添加任务"]')).toBeNull();
  expect(host.querySelector('[aria-label^="更改状态"]')).toBeNull();
  expect(host.querySelector('[aria-label^="任务操作"]')).toBeNull();
  await click('打开任务：First task'); expect(open.mock.calls).toHaveLength(1);
  expect(move.mock.calls).toHaveLength(0);
});

test('deadline-only tasks stay unscheduled and collapsed groups keep a usable create action', async () => {
  await render();
  expect(host.querySelector('[data-task-row="task-1"] time')).toBeNull();
  expect(host.querySelector('[data-task-row="task-1"]')!.textContent).toContain('未排期');
  await click('展开或收起：To do');
  expect(host.querySelector('table')!.parentElement!.hidden).toBe(true);
  await click('添加任务 · To do'); expect(create.mock.calls).toEqual([['todo']]);
});
