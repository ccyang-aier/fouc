import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useState, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { BoardTask, TaskBoardDetail, TaskBoardView } from '@fouc/shared/tasks';
import type { ProjectUiSession } from '@/lib/project-ui-session';
import type { TaskBoardWorkspace as WorkspaceComponent } from './task-board-workspace';
import type { TaskBoardToolbar } from './task-board-toolbar';
import type { TaskViewForm } from './task-view-form';

type WorkspaceProps = ComponentProps<typeof WorkspaceComponent>;
type ToolbarProps = ComponentProps<typeof TaskBoardToolbar>;
type FormProps = ComponentProps<typeof TaskViewForm>;

const firstView: TaskBoardView = { id: 'view-first', name: 'Planning', kind: 'kanban' };
const secondView: TaskBoardView = { id: 'view-second', name: 'Delivery', kind: 'kanban' };
const createdView: TaskBoardView = { id: 'server-view-73', name: 'New planning view', kind: 'kanban' };
const onCreateView = mock(async () => createdView);
const onRenameView = mock(async (view: TaskBoardView, name: string) => Boolean(view.id && name));
const values = new Map<string, unknown>();
// The hook uses only get/set; keep persistence in memory while its namespaces stay real.
const memorySession = {
  get<T>(key: string, fallback: T): T { return values.has(key) ? values.get(key) as T : fallback; },
  set<T>(key: string, change: T | ((current: T) => T), fallback: T) {
    const current = this.get(key, fallback);
    values.set(key, typeof change === 'function' ? (change as (value: T) => T)(current) : change);
  },
} satisfies Pick<ProjectUiSession, 'get' | 'set'>;

function makeBoard(id = 'board', views: TaskBoardView[] = []): TaskBoardDetail {
  const timestamp = '2026-10-20T00:00:00Z';
  return {
    id, projectId: 'project', name: id, description: '', visibility: 'project', ownerId: 'owner', permission: 'owner',
    taskCount: 2, completedCount: 0, createdAt: timestamp, updatedAt: timestamp, views,
    columns: [{ id: `${id}-todo`, name: 'To do', color: 'slate', isDone: false, position: 0 }],
    members: [{ userId: 'owner', name: 'Owner', email: 'owner@example.test', image: null, role: 'owner' }],
    tasks: ['Alpha', 'Beta'].map((title, index): BoardTask => ({
      id: `${id}-${title}`, number: index + 1, columnId: `${id}-todo`, title, description: '', priority: 'medium',
      assigneeIds: [], labels: [], dueDate: null, schedule: null, checklist: [], position: index, createdBy: 'owner',
      createdAt: timestamp, updatedAt: timestamp, commentCount: 0,
    })),
  };
}

function ToolbarFixture({ board, view, onView, onFilters, filters, onCreateView: create, onRenameView: rename }: ToolbarProps) {
  const editable = board.permission !== 'viewer';
  return <div data-toolbar data-editable={editable} data-active-view={view?.id ?? ''}>
    {board.views.map(option => <button key={option.id} type="button" data-view={option.id} onClick={() => onView(option.id)}>{option.name}</button>)}
    <input aria-label="Current search" value={filters.query} readOnly />
    <button type="button" data-filter-alpha onClick={() => onFilters({ ...filters, query: 'Alpha' })}>Filter Alpha</button>
    <button type="button" data-filter-beta onClick={() => onFilters({ ...filters, query: 'Beta' })}>Filter Beta</button>
    {editable && <button type="button" data-new-view onClick={event => create(event.currentTarget)}>New view</button>}
    {editable && view && <button type="button" data-rename-view onClick={event => rename(view, event.currentTarget)}>Rename view</button>}
  </div>;
}
function FormFixture({ view, onSave, onClose }: FormProps) {
  const [name, setName] = useState(view?.name ?? createdView.name);
  return <div data-view-form data-target-view={view?.id ?? 'new'}>
    <input aria-label="View draft" value={name} readOnly />
    <button type="button" data-edit-view onClick={() => setName('Unsaved previous view draft')}>Edit view draft</button>
    <button type="button" data-save-view onClick={async () => { if (await onSave({ name, kind: view?.kind ?? 'kanban' })) onClose(); }}>Save view</button>
  </div>;
}
function KanbanFixture({ tasks, canDrag }: { tasks: BoardTask[]; canDrag: boolean }) {
  return <div data-kanban data-can-drag={canDrag}>{tasks.map(task => <span key={task.id} data-task>{task.title}</span>)}</div>;
}

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let Workspace: typeof WorkspaceComponent;
let PageSessionNamespace: typeof import('@/lib/page-session-state')['PageSessionNamespace'];
let ProjectUiSessionContext: typeof import('@/lib/page-session-state')['ProjectUiSessionContext'];

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle']) globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  browser.localStorage.setItem('fouc.language', 'en-US');
  const icon = () => <svg aria-hidden />;
  mock.module('@phosphor-icons/react', () => ({ LockSimple: icon, Plus: icon, SquaresFour: icon }));
  mock.module('@/components/ui/button', () => ({ Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" data-empty-create onClick={onClick}>{children}</button> }));
  mock.module('./task-board-toolbar', () => ({ TaskBoardToolbar: ToolbarFixture }));
  mock.module('./task-view-form', () => ({ TaskViewForm: FormFixture }));
  mock.module('./kanban-board', () => ({ KanbanBoard: KanbanFixture }));
  mock.module('./calendar/task-calendar', () => ({ TaskCalendar: () => <div data-calendar /> }));
  mock.module('./table/task-table', () => ({ TaskTable: () => <div data-table /> }));
  ({ PageSessionNamespace, ProjectUiSessionContext } = await import('@/lib/page-session-state'));
  ({ TaskBoardWorkspace: Workspace } = await import('./task-board-workspace'));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
beforeEach(async () => {
  await act(async () => root.render(null));
  values.clear();
  onCreateView.mockClear();
  onRenameView.mockClear();
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); mock.restore(); });

async function render(board: TaskBoardDetail) {
  const props: WorkspaceProps = {
    board, actorId: 'owner', busy: false, refreshing: false, onCreateView, onRenameView, onRemoveView: () => {},
    onRefresh: () => {}, onSettings: () => {}, onRemoveBoard: () => {}, onOpen: () => {}, onCreate: () => {},
    onRemove: () => {}, onMove: () => {}, onColumn: () => {}, onRemoveColumn: () => {}, onReorderColumns: async () => true,
    onSaveTask: async () => true, onSchedule: async () => true, onMoveTasks: async () => true,
  };
  await act(async () => root.render(<ProjectUiSessionContext value={memorySession as ProjectUiSession}>
    <PageSessionNamespace name="page:1"><Workspace key={board.id} {...props} /></PageSessionNamespace>
  </ProjectUiSessionContext>));
}
async function click(selector: string) {
  const button = host.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
}
function currentView() { return host.querySelector('[data-toolbar]')?.getAttribute('data-active-view'); }
function visibleTasks() { return [...host.querySelectorAll('[data-task]')].map(task => task.textContent); }
function search() { return host.querySelector<HTMLInputElement>('[aria-label="Current search"]')!.value; }

test('zero saved views stays empty, and a viewer is not offered any view mutations', async () => {
  const board = makeBoard();
  await render(board);
  expect(currentView()).toBe('');
  expect(host.querySelector('[data-kanban], [data-calendar], [data-table]')).toBeNull();
  expect(host.querySelector('[data-empty-create]')).not.toBeNull();

  await render({ ...board, permission: 'viewer' });
  expect(host.querySelector('[data-toolbar]')?.getAttribute('data-editable')).toBe('false');
  expect(host.querySelector('[data-new-view], [data-empty-create], [data-rename-view]')).toBeNull();
  await render({ ...board, permission: 'viewer', views: [firstView] });
  expect(host.querySelector('[data-kanban]')?.getAttribute('data-can-drag')).toBe('false');
  expect(host.querySelector('[data-new-view], [data-rename-view]')).toBeNull();
  expect(onCreateView.mock.calls).toHaveLength(0);
  expect(onRenameView.mock.calls).toHaveLength(0);
});

test('creating a view selects the returned server ID when its updated list arrives', async () => {
  const board = makeBoard('board', [firstView]);
  await render(board);
  await click('[data-new-view]');
  await click('[data-save-view]');
  expect(onCreateView.mock.calls).toHaveLength(1);
  expect(values.get('page:1:tasks:board:active-view')).toBe(createdView.id);
  await render({ ...board, views: [firstView, createdView] });
  expect(currentView()).toBe(createdView.id);
  expect(host.querySelector('[data-view-form]')).toBeNull();
});

test('two views of the same kind retain independent filters when switching back and forth', async () => {
  await render(makeBoard('board', [firstView, secondView]));
  await click('[data-filter-alpha]');
  expect(visibleTasks()).toEqual(['Alpha']);
  await click(`[data-view="${secondView.id}"]`);
  expect(search()).toBe('');
  expect(visibleTasks()).toEqual(['Alpha', 'Beta']);
  await click('[data-filter-beta]');
  expect(visibleTasks()).toEqual(['Beta']);

  await click(`[data-view="${firstView.id}"]`);
  expect(search()).toBe('Alpha');
  expect(visibleTasks()).toEqual(['Alpha']);
  await click(`[data-view="${secondView.id}"]`);
  expect(search()).toBe('Beta');
  expect(visibleTasks()).toEqual(['Beta']);
});

test('an asynchronously deleted view or switched board cannot reuse the previous rename draft', async () => {
  const board = makeBoard('board', [firstView, secondView]);
  await render(board);
  await click('[data-rename-view]');
  await click('[data-edit-view]');
  await render({ ...board, views: [secondView] });
  expect(currentView()).toBe(secondView.id);
  expect(host.querySelector('[data-view-form]')).toBeNull();

  await click('[data-rename-view]');
  expect(host.querySelector<HTMLInputElement>('[aria-label="View draft"]')!.value).toBe(secondView.name);
  await click('[data-edit-view]');
  const otherView: TaskBoardView = { id: 'other-board-view', name: 'Other board planning', kind: 'kanban' };
  await render(makeBoard('other-board', [otherView]));
  expect(currentView()).toBe(otherView.id);
  expect(host.querySelector('[data-view-form]')).toBeNull();
  expect(onRenameView.mock.calls).toHaveLength(0);

  await click('[data-rename-view]');
  expect(host.querySelector<HTMLInputElement>('[aria-label="View draft"]')!.value).toBe(otherView.name);
  await click('[data-save-view]');
  expect(onRenameView.mock.calls).toEqual([[otherView, otherView.name]]);
});
