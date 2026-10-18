import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, createContext, useContext, type ReactNode } from 'react';
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
const reordered = mock<(ids: string[]) => void | Promise<boolean>>(() => {});
const dragControls = { start: mock(() => {}), stop: mock(() => {}) };
let previewColumns: (ids: string[]) => void;
let options: { busy?: boolean; board?: TaskBoardDetail };
let browser: Window;
let root: Root;
let host: HTMLDivElement;
let renderBoard: () => ReactNode;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle']) {
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['ArrowLeft', 'ArrowRight', 'Check', 'DotsThree', 'PencilSimple', 'Plus', 'Trash', 'CalendarDots', 'ChatText', 'Paperclip', 'CheckSquare', 'Flag', 'DotsSix', 'LinkSimple'].map(name => [name, icon])));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: () => <span /> }));
  const group = ({ children }: { children: ReactNode }) => <>{children}</>;
  const menuOpen = createContext(false);
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children, open = false }: { children: ReactNode; open?: boolean }) => <menuOpen.Provider value={open}>{children}</menuOpen.Provider>,
    DropdownMenuTrigger: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) => asChild ? children : <button type="button">{children}</button>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => useContext(menuOpen) ? <div role="menu">{children}</div> : null,
    DropdownMenuItem: ({ children, disabled, onSelect }: { children: ReactNode; disabled?: boolean; onSelect?: () => void }) => <button type="button" role="menuitem" disabled={disabled} onClick={onSelect}>{children}</button>,
    DropdownMenuLabel: group, DropdownMenuSearch: () => null, DropdownMenuSeparator: () => null, DropdownMenuSub: group, DropdownMenuSubContent: group, DropdownMenuSubTrigger: group,
  }));
  // Geometry and FLIP are verified in the real browser. Here the motion adapter
  // exposes calculated orders so the press, save, and cancellation contract is testable.
  type MotionProps = { children: ReactNode; className?: string; 'aria-label'?: string; 'data-column-id'?: string; 'data-column-dragging'?: boolean; 'data-drop-active'?: boolean; onDragOver?: React.DragEventHandler; onDrop?: React.DragEventHandler };
  mock.module('motion/react', () => ({
    motion: { div: ({ children, className }: MotionProps) => <div className={className}>{children}</div> },
    Reorder: {
      Group: ({ children, className, onReorder }: MotionProps & { onReorder: (ids: string[]) => void }) => { previewColumns = onReorder; return <div className={className}>{children}</div>; },
      Item: ({ children, className, ...props }: MotionProps) => <section className={className} aria-label={props['aria-label']} data-column-id={props['data-column-id']} data-column-dragging={props['data-column-dragging']} data-drop-active={props['data-drop-active']} onDragOver={props.onDragOver} onDrop={props.onDrop}>{children}</section>,
    },
    useDragControls: () => dragControls,
  }));
  const { KanbanBoard } = await import('./kanban-board');
  const { TooltipProvider } = await import('@/components/ui/tooltip');
  const noop = () => {};
  renderBoard = () => <TooltipProvider><KanbanBoard board={options.board ?? board} tasks={board.tasks} canDrag busy={options.busy ?? false} onMove={moved} onOpen={noop} onCreate={noop} onRemove={noop} onColumn={noop} onRemoveColumn={noop} onReorderColumns={reordered} /></TooltipProvider>;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => { root.render(null); });
  moved.mockClear();
  reordered.mockReset();
  reordered.mockImplementation(() => {});
  for (const fn of Object.values(dragControls)) fn.mockClear();
  options = {};
  await act(async () => root.render(renderBoard()));
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });

function card(id: string) { return host.querySelector<HTMLElement>(`[data-task-id="${id}"]`)!; }
function column(id: string) { return host.querySelector<HTMLElement>(`[data-column-id="${id}"]`)!; }
function transfer() { return Object.assign(new browser.DataTransfer(), { setDragImage: mock<(image: Element, x: number, y: number) => void>(() => {}) }); }
function drag(target: HTMLElement, type: string, dataTransfer: ReturnType<typeof transfer>, clientY = 10) {
  // happy-dom aliases DragEvent to Event, so provide the native payload explicitly.
  const event = new browser.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { dataTransfer: { value: dataTransfer }, clientX: { value: 20 }, clientY: { value: clientY } });
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

test('drag preview copies the card and a full-height placeholder stays stable until a cross-column drop', async () => {
  const source = card('second');
  Object.defineProperty(source, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 248, height: 210 }) });
  const dataTransfer = transfer();
  await act(async () => { drag(source, 'dragstart', dataTransfer); drag(column('done'), 'dragover', dataTransfer); });
  const preview = dataTransfer.setDragImage.mock.calls[0][0] as HTMLElement;
  expect(preview.getAttribute('aria-hidden')).toBe('true');
  expect(preview.querySelector('[data-drag-preview="true"]')?.textContent).toContain('Second task');
  expect(preview.querySelector('[data-task-id]')).toBeNull();
  expect(source.getAttribute('data-dragging')).toBe('true');
  const placeholder = column('done').querySelector<HTMLElement>('[data-drop-placeholder]')!;
  expect(placeholder.style.height).toBe('210px');
  await act(async () => drag(placeholder, 'dragover', dataTransfer));
  expect(column('done').querySelector('[data-drop-placeholder]')).toBe(placeholder);
  expect(moved.mock.calls).toHaveLength(0);
  await act(async () => drag(placeholder, 'drop', dataTransfer));
  expect(moved.mock.calls).toEqual([['second', 'done', null]]);
  expect(host.querySelector('[data-drop-placeholder]')).toBeNull();
  expect(host.querySelector('[data-dragging]')).toBeNull();
});

test('ending a drag without dropping clears the placeholder without moving a task', async () => {
  const source = card('second');
  const dataTransfer = transfer();
  await act(async () => { drag(source, 'dragstart', dataTransfer); drag(column('done'), 'dragover', dataTransfer); });
  expect(column('done').querySelector('[data-drop-placeholder]')).not.toBeNull();
  await act(async () => drag(source, 'dragend', dataTransfer));
  expect(host.querySelector('[data-drop-placeholder]')).toBeNull();
  expect(host.querySelector('[data-dragging]')).toBeNull();
  expect(moved.mock.calls).toHaveLength(0);
});

function columnHandle(id = 'todo') { return column(id).querySelector<HTMLButtonElement>('button[aria-label^="状态列操作："]')!; }
function columnIds() { return [...host.querySelectorAll<HTMLElement>('[data-column-id]')].map(item => item.dataset.columnId); }
function pointer(target: EventTarget, type: string, clientX = 20) {
  target.dispatchEvent(new browser.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX, clientY: 20 }) as unknown as Event);
}
function click(target: HTMLElement) { target.dispatchEvent(new browser.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }) as unknown as Event); }
async function shortPress() {
  await act(async () => { pointer(columnHandle(), 'pointerdown'); pointer(window, 'pointerup'); click(columnHandle()); });
}

test('short press opens the column menu without picking it up or showing delete fine print', async () => {
  await shortPress();
  expect(dragControls.start.mock.calls).toHaveLength(0);
  const menu = column('todo').querySelector('[role="menu"]')!;
  expect(menu.textContent).toBe('编辑状态列向左移动向右移动删除状态列');
  expect([...menu.querySelectorAll('button')].find(item => item.textContent === '删除状态列')?.disabled).toBe(true);
});

test('column arrows immediately preview the whole new order, block duplicate moves and restore a failed save', async () => {
  let settle!: (saved: boolean) => void;
  reordered.mockImplementation(() => new Promise(resolve => { settle = resolve; }));
  await shortPress();
  const right = [...column('todo').querySelectorAll('button')].find(item => item.textContent === '向右移动')!;
  await act(async () => click(right));
  expect(reordered.mock.calls).toEqual([[['done', 'todo']]]);
  expect(columnIds()).toEqual(['done', 'todo']);
  expect(columnHandle().disabled).toBe(true);
  await act(async () => click(right));
  expect(reordered.mock.calls).toHaveLength(1);
  await act(async () => settle(false));
  expect(columnIds()).toEqual(['todo', 'done']);
  expect(columnHandle().disabled).toBe(false);
});

test('holding a handle picks up the column, commits one complete order on release and suppresses its click', async () => {
  reordered.mockImplementation(async ids => {
    options.board = { ...board, columns: ids.map(id => board.columns.find(item => item.id === id)!) };
    root.render(renderBoard());
    return true;
  });
  await act(async () => { pointer(columnHandle(), 'pointerdown'); await Bun.sleep(430); });
  expect(dragControls.start.mock.calls).toHaveLength(1);
  expect(column('todo').getAttribute('data-column-dragging')).toBe('true');
  expect(card('first').getAttribute('draggable')).toBe('false');
  expect(host.querySelector('[role="menu"]')).toBeNull();
  await act(async () => previewColumns(['done', 'todo']));
  expect(columnIds()).toEqual(['done', 'todo']);
  await act(async () => { pointer(window, 'pointerup'); click(columnHandle()); });
  expect(dragControls.stop.mock.calls).toHaveLength(1);
  expect(reordered.mock.calls).toEqual([[['done', 'todo']]]);
  expect(columnIds()).toEqual(['done', 'todo']);
  expect(host.querySelector('[data-column-dragging]')).toBeNull();
  expect(host.querySelector('[role="menu"]')).toBeNull();
});

test('moving before the hold threshold cancels the press and cannot open a menu or reorder columns', async () => {
  await act(async () => { pointer(columnHandle(), 'pointerdown'); pointer(window, 'pointermove', 40); await Bun.sleep(430); pointer(window, 'pointerup'); click(columnHandle()); });
  expect(dragControls.start.mock.calls).toHaveLength(0);
  expect(reordered.mock.calls).toHaveLength(0);
  expect(host.querySelector('[role="menu"]')).toBeNull();
});

test.each(['Escape', 'pointercancel'])('%s cancels a held column and restores its draft without saving', async cancellation => {
  await act(async () => { pointer(columnHandle(), 'pointerdown'); await Bun.sleep(430); });
  await act(async () => previewColumns(['done', 'todo']));
  await act(async () => {
    if (cancellation === 'Escape') window.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }) as unknown as Event);
    else pointer(window, 'pointercancel');
    pointer(window, 'pointerup');
  });
  expect(dragControls.stop.mock.calls).toHaveLength(1);
  expect(reordered.mock.calls).toHaveLength(0);
  expect(columnIds()).toEqual(['todo', 'done']);
  expect(host.querySelector('[data-column-dragging]')).toBeNull();
});

test('busy boards and viewers cannot pick up or reorder columns', async () => {
  options.busy = true;
  await act(async () => root.render(renderBoard()));
  expect(columnHandle().disabled).toBe(true);
  await act(async () => { pointer(columnHandle(), 'pointerdown'); await Bun.sleep(430); pointer(window, 'pointerup'); });
  expect(dragControls.start.mock.calls).toHaveLength(0);
  expect(reordered.mock.calls).toHaveLength(0);
  options = { board: { ...board, permission: 'viewer' } };
  await act(async () => root.render(renderBoard()));
  expect(columnHandle()).toBeNull();
});

test('a board becoming busy during a press cancels its pending pickup', async () => {
  await act(async () => pointer(columnHandle(), 'pointerdown'));
  options.busy = true;
  await act(async () => root.render(renderBoard()));
  await act(async () => { await Bun.sleep(430); pointer(window, 'pointerup'); });
  expect(dragControls.start.mock.calls).toHaveLength(0);
  expect(reordered.mock.calls).toHaveLength(0);
});
