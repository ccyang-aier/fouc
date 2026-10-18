import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { TaskBoardDetail } from '@fouc/shared/tasks';
import type { TaskBoardClient, TaskDraft } from './task-board-client';
import type { TaskDetail as DetailComponent } from './task-detail';

const board: TaskBoardDetail = {
  id: 'board', projectId: 'project', name: 'Delivery', description: '', visibility: 'project',
  ownerId: 'owner', permission: 'owner', taskCount: 1, completedCount: 0,
  createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z',
  columns: [{ id: 'todo', name: 'To do', color: 'slate', isDone: false, position: 0 }],
  members: [{ userId: 'owner', name: 'Owner', email: 'owner@example.test', image: null, role: 'owner' }],
  tasks: [{ id: 'task', columnId: 'todo', title: 'Original task', description: '', priority: 'medium',
    assigneeIds: [], labels: [], dueDate: null, checklist: [], position: 0, createdBy: 'owner',
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
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLTextAreaElement', 'HTMLDialogElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) {
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  browser.localStorage.setItem('fouc.language', 'en-US');
  Object.defineProperties(browser.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
  });
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries([
    'CalendarBlank', 'CaretDown', 'CheckSquare', 'Circle', 'Flag', 'Kanban', 'ListChecks',
    'LockSimple', 'Plus', 'Tag', 'TextAlignLeft', 'Trash', 'Users', 'Warning', 'X',
  ].map(name => [name, icon])));
  mock.module('@/components/ui/button', () => ({ Button: Control }));
  mock.module('@/components/user-avatar', () => ({ UserAvatar: () => <span /> }));
  mock.module('@/components/app-alert', () => ({ AppAlert: ({ title }: { title: string }) => <div role="alert">{title}</div> }));
  mock.module('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: Container, DropdownMenuContent: Container, DropdownMenuLabel: Container,
    DropdownMenuCheckboxItem: Container, DropdownMenuTrigger: Control,
  }));
  // Keep the drawer's save/lifecycle logic real; only replace comment networking.
  mock.module('./task-comments', () => ({ TaskComments: CommentsFixture }));
  ({ PageVisibility } = await import('@/lib/page-visibility'));
  ({ TaskDetail } = await import('./task-detail'));
  const { createRoot } = await import('react-dom/client');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

beforeEach(async () => {
  await act(async () => root.render(null));
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

test('page visibility closes and reopens the same drawer without losing task or comment drafts', async () => {
  await render();
  await type('Task title', 'Unfinished task edit');
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

test('saving after returning to the page still completes and closes the mounted drawer', async () => {
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

test('a new comment drafted while a save is pending keeps the drawer open when that save completes', async () => {
  await render();
  const finish = deferredSave();
  await act(async () => saveButton().click());
  expect(saveButton().disabled).toBe(true);
  await type('Comment draft', 'Keep this comment after saving');
  await act(async () => finish(true));

  expect(onSave.mock.calls).toHaveLength(1);
  expect(onClose.mock.calls).toHaveLength(0);
  expect(host.querySelector('dialog')!.open).toBe(true);
  expect(textarea('Comment draft').value).toBe('Keep this comment after saving');
  expect(saveButton().disabled).toBe(false);
});
