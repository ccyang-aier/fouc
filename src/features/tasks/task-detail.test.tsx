import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { TaskBoardDetail, TaskLabel } from '@fouc/shared/tasks';
import type { TaskBoardClient, TaskDraft } from './task-board-client';
import type { TaskDetail as DetailComponent } from './task-detail';

const board: TaskBoardDetail = {
  id: 'board', projectId: 'project', name: 'Delivery', description: '', visibility: 'project',
  ownerId: 'owner', permission: 'owner', taskCount: 1, completedCount: 0,
  createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
  columns: [{ id: 'todo', name: 'To do', color: 'slate', isDone: false, position: 0 }],
  views: [],
  members: [{ userId: 'owner', name: 'Owner', email: 'owner@example.test', image: null, role: 'owner' }],
  tasks: [{ id: 'task', number: 1, columnId: 'todo', title: 'Original task', description: '', priority: 'medium',
    assigneeIds: [], labels: [], dueDate: null, schedule: null, checklist: [], position: 0, createdBy: 'owner',
    createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z', commentCount: 0 }],
};
const onClose = mock(() => {});
const onSave = mock(async (draft: TaskDraft) => Boolean(draft.title));
let browser: Window;
let root: Root;
let host: HTMLDivElement;
let TaskDetail: typeof DetailComponent;
let PageVisibility: typeof import('@/lib/page-visibility')['PageVisibility'];

function Control(props: ComponentProps<'button'> & { loading?: boolean }) {
  return <button type="button" onClick={props.onClick} disabled={props.disabled || props.loading}
    aria-label={props['aria-label']}>{props.children}</button>;
}
function Container({ children }: { children: ReactNode }) { return <div>{children}</div>; }
function CommentsFixture({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [body, setBody] = useState('');
  useEffect(() => { onDirtyChange(Boolean(body.trim())); }, [body, onDirtyChange]);
  return <textarea aria-label="Comment draft" value={body} onChange={event => setBody(event.target.value)} />;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLTextAreaElement', 'HTMLDialogElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle']) {
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperties(browser, { innerWidth: { configurable: true, value: 1452 }, innerHeight: { configurable: true, value: 917 } });
  browser.localStorage.setItem('fouc.language', 'en-US');
  Object.defineProperties(browser.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries([
    'CalendarBlank', 'CaretDown', 'CaretRight', 'CheckSquare', 'Circle', 'Flag', 'Kanban', 'ListChecks',
    'LockSimple', 'Plus', 'Tag', 'TextAlignLeft', 'Trash', 'Users', 'Warning', 'X', 'Clock', 'LinkSimple', 'ChatCircle',
  ].map(name => [name, icon])));
  mock.module('@/components/ui/button', () => ({ Button: Control }));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: () => <span /> }));
  mock.module('@/components/app-alert', () => ({ AppAlert: ({ title }: { title: string }) => <div role="alert">{title}</div> }));
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: Container, DropdownMenuContent: Container, DropdownMenuSearch: () => null,
    DropdownMenuRadioGroup: Container, DropdownMenuRadioItem: Container,
    DropdownMenuCheckboxItem: Container, DropdownMenuTrigger: Control,
  }));
  // Keep the card's save/lifecycle logic real; only replace comment networking.
  mock.module('./task-comments', () => ({ TaskComments: CommentsFixture }));
  mock.module('./task-labels', () => ({ collectTaskLabels: () => [], TaskLabelsEditor: ({ labels, onChange, disabled }: { labels: TaskLabel[]; onChange: (labels: TaskLabel[]) => void; disabled?: boolean }) => <button type="button" data-add-label disabled={disabled} onClick={() => onChange([...labels, { name: 'Design', color: 'rose' }])}>Add label</button> }));
  ({ PageVisibility } = await import('@/lib/page-visibility'));
  ({ TaskDetail } = await import('./task-detail'));
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
  Object.defineProperties(browser, { innerWidth: { configurable: true, value: 1452 }, innerHeight: { configurable: true, value: 917 } });
  onClose.mockClear();
  onSave.mockReset();
  onSave.mockImplementation(async draft => Boolean(draft.title));
});
afterAll(async () => {
  await act(async () => root.unmount());
  await browser.happyDOM.abort();
  mock.restore();
});

async function render(visible = true) {
  await act(async () => root.render(
    <PageVisibility.Provider value={visible}>
      <TaskDetail board={board} task={board.tasks[0]} columnId="todo" actorId="owner"
        onClose={onClose} onSave={onSave} onDelete={async () => true}
        client={{} as TaskBoardClient} onCommentsChanged={() => {}} />
    </PageVisibility.Provider>,
  ));
}
function textarea(label: string) {
  const input = host.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`);
  expect(input).not.toBeNull();
  return input!;
}
async function type(label: string, value: string) {
  const input = textarea(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function saveButton() {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === 'Save changes');
  expect(button).toBeDefined();
  return button!;
}
function deferredSave() {
  let finish!: (saved: boolean) => void;
  const result = new Promise<boolean>(resolve => { finish = resolve; });
  onSave.mockImplementation(() => result);
  return finish;
}
async function switchPane(value: 'details' | 'comments') {
  await act(async () => host.querySelector<HTMLButtonElement>(`[data-detail-pane="${value}"]`)!.click());
}
function dragFixture() {
  const dialog = host.querySelector('dialog')!;
  const handle = host.querySelector<HTMLElement>('[aria-label="Move task details"]')!;
  const header = handle.parentElement!;
  let captured = false;
  Object.assign(header, {
    setPointerCapture: () => { captured = true; },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => { captured = false; },
  });
  dialog.getBoundingClientRect = () => ({
    left: parseFloat(dialog.style.left) || 1028,
    top: parseFloat(dialog.style.top) || 76,
    width: 400, height: 760,
  } as DOMRect);
  const pointer = async (type: string, x: number, y: number, target: HTMLElement = handle) => {
    await act(async () => target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y })));
  };
  return { dialog, handle, pointer };
}

test('dragging moves the card without changing its size or losing either draft', async () => {
  await render();
  await type('Task title', 'Keep this task edit');
  await switchPane('comments');
  await type('Comment draft', 'Keep this comment edit');
  const { dialog, pointer } = dragFixture();
  await pointer('pointerdown', 1050, 90);
  await pointer('pointermove', 850, 110);
  expect(dialog.style.left).toBe('828px');
  expect(dialog.style.top).toBe('96px');
  expect(dialog.dataset.dragging).toBe('true');
  await pointer('pointerup', 850, 110);
  expect(dialog.dataset.dragging).toBeUndefined();
  expect(dialog.style.width).toBe('');
  expect(dialog.style.height).toBe('');
  await render(false);
  await render(true);
  expect(dialog.style.left).toBe('828px');
  expect(textarea('Comment draft').value).toBe('Keep this comment edit');
  await switchPane('details');
  expect(textarea('Task title').value).toBe('Keep this task edit');
  expect(onClose.mock.calls).toHaveLength(0);
  await render(false);
  Object.defineProperty(browser, 'innerWidth', { configurable: true, value: 900 });
  await render(true);
  expect(dialog.style.left).toBe('488px');
});

test('dragging respects viewport bounds and Escape only cancels the active gesture', async () => {
  await render();
  const { dialog, handle, pointer } = dragFixture();
  await pointer('pointerdown', 1050, 90, textarea('Task title'));
  await pointer('pointermove', 500, 200);
  expect(dialog.style.left).toBe('');
  await pointer('pointerdown', 1050, 90);
  await pointer('pointermove', -500, -500);
  expect(dialog.style.left).toBe('12px');
  expect(dialog.style.top).toBe('52px');
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(async () => handle.dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(true);
  expect(dialog.style.left).toBe('1028px');
  expect(dialog.style.top).toBe('76px');
  expect(dialog.open).toBe(true);
  expect(onClose.mock.calls).toHaveLength(0);
  const releaseClick = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: -500, clientY: -500 });
  await act(async () => dialog.dispatchEvent(releaseClick));
  expect(releaseClick.defaultPrevented).toBe(true);
  expect(onClose.mock.calls).toHaveLength(0);
  await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true })));
  expect(dialog.style.left).toBe('988px');
  await pointer('pointerdown', 1000, 90);
  await pointer('pointermove', 4000, 4000);
  expect(dialog.style.left).toBe('1040px');
  expect(dialog.style.top).toBe('145px');
  await pointer('pointercancel', 4000, 4000);
  expect(dialog.style.left).toBe('988px');
  expect(dialog.style.top).toBe('76px');
});

test('page visibility closes and reopens the same card without losing task or comment drafts', async () => {
  await render();
  await type('Task title', 'Unfinished task edit');
  await switchPane('comments');
  await type('Comment draft', 'Unpublished discussion');
  const dialog = host.querySelector('dialog')!;
  const title = textarea('Task title');
  expect(dialog.open).toBe(true);

  await render(false);
  expect(dialog.open).toBe(false);
  expect(onClose.mock.calls).toHaveLength(0);
  await render(true);

  expect(host.querySelector('dialog')).toBe(dialog);
  expect(dialog.open).toBe(true);
  expect(textarea('Task title')).toBe(title);
  expect(title.value).toBe('Unfinished task edit');
  expect(textarea('Comment draft').value).toBe('Unpublished discussion');
  expect(onClose.mock.calls).toHaveLength(0);
});

test('saving after returning to the page still completes and closes the mounted card', async () => {
  await render();
  await type('Task title', 'Edited before switching pages');
  await render(false);
  await render(true);
  await act(async () => saveButton().click());

  expect(onSave.mock.calls).toHaveLength(1);
  expect(onSave.mock.calls[0][0].title).toBe('Edited before switching pages');
  expect(onClose.mock.calls).toHaveLength(1);
  expect(saveButton().disabled).toBe(false);
});

test('a new comment drafted while a save is pending keeps the card open when that save completes', async () => {
  await render();
  const finish = deferredSave();
  await act(async () => saveButton().click());
  expect(saveButton().disabled).toBe(true);
  await switchPane('comments');
  await type('Comment draft', 'Keep this comment after saving');
  await act(async () => finish(true));

  expect(onSave.mock.calls).toHaveLength(1);
  expect(onClose.mock.calls).toHaveLength(0);
  expect(host.querySelector('dialog')!.open).toBe(true);
  expect(textarea('Comment draft').value).toBe('Keep this comment after saving');
  expect(saveButton().disabled).toBe(false);
});

test('Escape protects an unsaved task draft until the user explicitly discards it', async () => {
  await render();
  await type('Task title', 'Keep this task draft');
  await act(async () => host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));

  const confirmation = host.querySelector<HTMLDialogElement>('dialog[role="alertdialog"]');
  expect(confirmation?.open).toBe(true);
  expect(onClose.mock.calls).toHaveLength(0);
  const keepEditing = [...confirmation!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Keep editing')!;
  await act(async () => keepEditing.click());
  expect(host.querySelector('dialog[role="alertdialog"]')).toBeNull();
  expect(textarea('Task title').value).toBe('Keep this task draft');

  await act(async () => host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
  const discard = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Discard changes')!;
  await act(async () => discard.click());
  expect(onClose.mock.calls).toHaveLength(1);
  expect(onSave.mock.calls).toHaveLength(0);
});

test('task information owns subtasks and switching to comments preserves both drafts without nested tabs', async () => {
  await render();
  const main = host.querySelector('[data-task-detail-main]')!;
  const comments = host.querySelector<HTMLElement>('[data-task-comments]')!;
  expect(comments.hidden).toBe(true);
  expect(Boolean(main.querySelector('[data-task-detail-checklist]'))).toBe(true);
  expect(Boolean(comments.querySelector('[data-task-detail-checklist]'))).toBe(false);
  expect(host.querySelectorAll('[role="tablist"]')).toHaveLength(0);
  expect(host.querySelector('[data-detail-pane="comments"]')?.textContent).toBe('Comments');
  const disclosure = main.querySelector<HTMLDetailsElement>('[data-task-detail-checklist]')!;
  expect(disclosure.open).toBe(false);
  disclosure.open = true;
  const add = [...main.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Add subtask')!;
  expect(add.disabled).toBe(false);
  await act(async () => add.click());
  const input = main.querySelector<HTMLInputElement>('input[type="text"][aria-label="Subtask title"]')!;
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Subtask title');
  await act(async () => {
    Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Review the prototype');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await switchPane('comments');
  expect(comments.hidden).toBe(false);
  expect((main as HTMLElement).hidden).toBe(true);
  await type('Comment draft', 'Keep the discussion while checking subtasks');
  const comment = textarea('Comment draft');
  await switchPane('details');
  expect((main as HTMLElement).hidden).toBe(false);
  expect(comments.hidden).toBe(true);
  disclosure.open = false;
  disclosure.open = true;
  expect(main.querySelector<HTMLInputElement>('[aria-label="Subtask title"]')?.value).toBe('Review the prototype');
  expect(textarea('Comment draft') === comment).toBe(true);
  await switchPane('comments');
  expect(comment.value).toBe('Keep the discussion while checking subtasks');
  await act(async () => saveButton().click());
  expect(onSave.mock.calls[0][0].checklist[0]?.title).toBe('Review the prototype');
  expect(onClose.mock.calls).toHaveLength(0);
});

test('adding an empty subtask focuses its title, blocks saving and protects the new draft', async () => {
  await render();
  host.querySelector<HTMLDetailsElement>('[data-task-detail-checklist]')!.open = true;
  const add = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Add subtask')!;
  await act(async () => add.click());
  const input = host.querySelector<HTMLInputElement>('input[type="text"][aria-label="Subtask title"]')!;
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Subtask title');
  expect(input.value).toBe('');
  await act(async () => saveButton().click());
  expect(onSave.mock.calls).toHaveLength(0);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Enter a subtask title or remove the empty subtask.');
  await act(async () => host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(host.querySelector<HTMLDialogElement>('dialog[role="alertdialog"]')?.open).toBe(true);
});

test('colored labels remain structured in the task draft sent to save', async () => {
  await render();
  await act(async () => host.querySelector<HTMLButtonElement>('[data-add-label]')!.click());
  await act(async () => saveButton().click());
  expect(onSave.mock.calls[0][0].labels).toEqual([{ name: 'Design', color: 'rose' }]);
});
