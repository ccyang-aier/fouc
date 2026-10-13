import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, StrictMode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { initialDashboardState, type DashboardTask } from './dashboard-model';
import { useDashboard } from './use-dashboard';

type Dashboard = ReturnType<typeof useDashboard>;
let browser: Window;
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let dashboard: Dashboard;
const originalGlobals = new Map<string, unknown>();
const globalNames = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver', 'getComputedStyle', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'];

beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of globalNames) {
    originalGlobals.set(name, globals[name]);
    globals[name] = name === 'window' ? browser : name === 'IS_REACT_ACT_ENVIRONMENT' ? true : (browser as unknown as Record<string, unknown>)[name];
  }
});

beforeEach(() => { localStorage.clear(); });
afterEach(async () => { await unmount(); });
afterAll(async () => {
  await browser.happyDOM.abort();
  const globals = globalThis as Record<string, unknown>;
  for (const [name, value] of originalGlobals) {
    if (value === undefined) delete globals[name];
    else globals[name] = value;
  }
});

function Capture({ projectKey }: { projectKey: string }) {
  const value = useDashboard(projectKey);
  useEffect(() => { dashboard = value; }, [value]);
  return null;
}

async function render(projectKey: string, strict = false) {
  if (!root) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => {
    const capture = <Capture key={projectKey} projectKey={projectKey} />;
    root!.render(strict ? <StrictMode>{capture}</StrictMode> : capture);
    await Promise.resolve();
  });
}

async function unmount() {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
}

function wireframe() { return dashboard.state.tasks.find(task => task.id === 'wireframe')!; }
function newTask(id: string): DashboardTask { return { ...structuredClone(initialDashboardState.tasks[0]), id, title: `Project ${id}`, comments: [], commentCount: 0 }; }

test('saved task edits and comments are restored when the same local project mounts again', async () => {
  await render('local:A');
  const edited: DashboardTask = {
    ...wireframe(), title: 'Wireframe ready for review', progress: 75, priority: 'High',
    comments: [{ id: 'comment-a', author: 'sarah', text: 'Ready for the next review.', time: 'Just now' }],
    commentCount: 7,
  };
  await act(async () => { dashboard.saveTask(edited); });
  expect(wireframe()).toEqual(edited);
  await unmount();
  await render('local:A');
  expect(wireframe()).toEqual(edited);
  expect(dashboard.storageError).toBe(false);
});

test('a keyed remount from local A to local B does not expose A edits or write them into B', async () => {
  await render('local:A');
  await act(async () => { dashboard.saveTask({ ...wireframe(), title: 'Private local A task', comments: [{ id: 'private-comment', author: 'sarah', text: 'A project comment', time: 'Just now' }] }); });
  const savedA = localStorage.getItem('fouc.project-dashboard.local:A');
  await render('local:B');
  expect(dashboard.state).toEqual(initialDashboardState);
  await act(async () => { dashboard.createTask(newTask('b-created')); });
  expect(dashboard.state.tasks.some(task => task.title === 'Private local A task')).toBe(false);
  expect(localStorage.getItem('fouc.project-dashboard.local:B')).not.toContain('A project comment');
  expect(localStorage.getItem('fouc.project-dashboard.local:A')).toBe(savedA);
  await unmount();
  await render('local:A');
  expect(wireframe().title).toBe('Private local A task');
});

test('local and server projects with the same ID restore separate dashboard states', async () => {
  await render('local:A');
  await act(async () => { dashboard.saveTask({ ...wireframe(), title: 'Local A title' }); });
  await unmount();
  await render('server:A');
  expect(wireframe().title).toBe(initialDashboardState.tasks[0].title);
  await act(async () => { dashboard.saveTask({ ...wireframe(), title: 'Server A title' }); });
  await unmount();
  await render('local:A');
  expect(wireframe().title).toBe('Local A title');
  await unmount();
  await render('server:A');
  expect(wireframe().title).toBe('Server A title');
  expect(localStorage.getItem('fouc.project-dashboard.local:A')).not.toContain('Server A title');
  expect(localStorage.getItem('fouc.project-dashboard.server:A')).not.toContain('Local A title');
});

test('creating and removing tasks leave the shared dashboard seed unchanged for other projects', async () => {
  const seed = structuredClone(initialDashboardState);
  await render('local:A');
  await act(async () => { dashboard.createTask(newTask('created')); dashboard.removeTask('wireframe'); });
  expect(dashboard.state.tasks.map(task => task.id)).toEqual(['brand', 'created']);
  expect(initialDashboardState).toEqual(seed);
  await unmount();
  await render('local:B');
  expect(dashboard.state).toEqual(seed);
});

test('StrictMode effect replay and remount restore one copy of each created task and activity', async () => {
  await render('local:A', true);
  await act(async () => { dashboard.createTask(newTask('strict-created')); });
  expect(dashboard.state.tasks.filter(task => task.id === 'strict-created')).toHaveLength(1);
  expect(dashboard.state.activities.filter(activity => activity.subject === 'Project strict-created')).toHaveLength(1);
  await unmount();
  await render('local:A', true);
  expect(dashboard.state.tasks.filter(task => task.id === 'strict-created')).toHaveLength(1);
  expect(dashboard.state.activities.filter(activity => activity.subject === 'Project strict-created')).toHaveLength(1);
  expect(new Set(dashboard.state.tasks.map(task => task.id)).size).toBe(dashboard.state.tasks.length);
});
