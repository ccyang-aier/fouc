import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { BoardTask, TaskBoardDetail } from '@fouc/shared/tasks';

const first: BoardTask = {
  id: 'first', number: 1, columnId: 'todo', title: 'First task', description: '', priority: 'medium', assigneeIds: [], labels: [],
  dueDate: null, checklist: [], position: 0, createdBy: 'owner', createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z', commentCount: 0,
};
const second = { ...first, id: 'second', number: 2, title: 'Second task', position: 1, commentCount: 3 };
const board: TaskBoardDetail = {
  id: 'board', projectId: 'project', name: 'Team tasks', description: '', visibility: 'project', ownerId: 'owner', permission: 'owner',
  taskCount: 2, completedCount: 0, createdAt: first.createdAt, updatedAt: first.updatedAt, members: [], tasks: [first, second],
  columns: [{ id: 'todo', name: 'To do', color: 'slate', isDone: false, position: 0 }, { id: 'done', name: 'Done', color: 'green', isDone: true, position: 1 }],
};
const moved = mock<(taskId: string, columnId: string, beforeTaskId: string | null) => void>(() => {});
let browser: Window;
let root: Root;
let host: HTMLDivElement;
let renderBoard: () => ReactNode;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) {
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['ArrowLeft', 'ArrowRight', 'Check', 'DotsThree', 'PencilSimple', 'Plus', 'Trash', 'CalendarDots', 'ChatText', 'Paperclip', 'CheckSquare', 'Flag', 'DotsSixVertical', 'LinkSimple'].map(name => [name, icon])));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: () => <span /> }));
  const group = ({ children }: { children: ReactNode }) => <>{children}</>;
  const control = (props: ComponentProps<'button'>) => <button type="button" aria-label={props['aria-label']}>{props.children}</button>;
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: group, DropdownMenuTrigger: control, DropdownMenuContent: () => null, DropdownMenuItem: group,
    DropdownMenuLabel: group, DropdownMenuSearch: () => null, DropdownMenuSeparator: () => null, DropdownMenuSub: group, DropdownMenuSubContent: group, DropdownMenuSubTrigger: group,
  }));
  const { KanbanBoard } = await import('./kanban-board');
  const { TooltipProvider } = await import('@/components/ui/tooltip');
  const noop = () => {};
  renderBoard = () => <TooltipProvider><KanbanBoard board={board} tasks={board.tasks} canDrag busy={false} onMove={moved} onOpen={noop} onCreate={noop} onRemove={noop} onColumn={noop} onRemoveColumn={noop} onReorderColumns={noop} /></TooltipProvider>;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => { root.render(null); });
  moved.mockClear();
  await act(async () => root.render(renderBoard()));
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });

function card(id: string) { return host.querySelector<HTMLElement>(`[data-task-id="${id}"]`)!; }
function column(id: string) { return host.querySelector<HTMLElement>(`[data-column-id="${id}"]`)!; }
function transfer() { return new browser.DataTransfer(); }
function drag(target: HTMLElement, type: string, dataTransfer: ReturnType<typeof transfer>, clientY = 10) {
  // happy-dom aliases DragEvent to Event, so provide the native payload explicitly.
  const event = new browser.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { dataTransfer: { value: dataTransfer }, clientY: { value: clientY } });
  target.dispatchEvent(event as unknown as Event);
}

test('native events reorder the second card before the first even before React paints the drag indicator', async () => {
  const destination = card('first');
  Object.defineProperty(destination, 'getBoundingClientRect', { value: () => ({ top: 0, height: 100 }) });
  const dataTransfer = transfer();
  await act(async () => {
    drag(card('second'), 'dragstart', dataTransfer);
    drag(destination, 'dragover', dataTransfer, 10);
    drag(destination, 'drop', dataTransfer, 10);
  });
  expect(moved.mock.calls).toEqual([['second', 'todo', 'first']]);
  expect(host.querySelector('[data-dragging="true"]')).toBeNull();
});

test('returning to the source card clears a previously hovered column and makes dropping there a no-op', async () => {
  const source = card('second');
  const dataTransfer = transfer();
  await act(async () => { drag(source, 'dragstart', dataTransfer); drag(column('done'), 'dragover', dataTransfer); });
  expect(column('done').getAttribute('data-drop-active')).toBe('true');
  await act(async () => drag(source, 'dragover', dataTransfer));
  expect(host.querySelector('[data-drop-active="true"]')).toBeNull();
  await act(async () => { drag(source, 'drop', dataTransfer); drag(source, 'dragend', dataTransfer); });
  expect(moved.mock.calls).toHaveLength(0);
});

test('card metadata keeps both counters visible at zero and renders the actual comment count', () => {
  expect(card('first').querySelector('[aria-label="0 个附件"]')?.textContent).toBe('0');
  expect(card('first').querySelector('[aria-label="0 条评论"]')?.textContent).toBe('0');
  expect(card('second').querySelector('[aria-label="3 条评论"]')?.textContent).toBe('3');
});
