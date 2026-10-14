import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, StrictMode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type {
  DashboardDocument,
  DashboardMeeting,
  DashboardProject,
  DashboardTask,
} from './dashboard-model';
import { initialDashboardState } from './dashboard-seed';
import {
  selectFavorites,
  selectMilestones,
  selectProjects,
  selectStats,
} from './dashboard-selectors';
import { useDashboard } from './use-dashboard';

type Dashboard = ReturnType<typeof useDashboard>;
let browser: Window;
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let dashboard: Dashboard;
const originalGlobals = new Map<string, unknown>();
const globalNames = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'localStorage',
  'IS_REACT_ACT_ENVIRONMENT',
];

beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of globalNames) {
    originalGlobals.set(name, globals[name]);
    globals[name] =
      name === 'window'
        ? browser
        : name === 'IS_REACT_ACT_ENVIRONMENT'
          ? true
          : (browser as unknown as Record<string, unknown>)[name];
  }
});

beforeEach(() => {
  localStorage.clear();
});
afterEach(async () => {
  await unmount();
});
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
  useEffect(() => {
    dashboard = value;
  }, [value]);
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

function wireframe() {
  return dashboard.state.tasks.find((task) => task.id === 'wireframe')!;
}
function newTask(id: string): DashboardTask {
  return {
    ...structuredClone(initialDashboardState.tasks[0]),
    id,
    title: `Project ${id}`,
    comments: [],
    commentCount: 0,
  };
}

test('saved task edits and comments are restored when the same local project mounts again', async () => {
  await render('local:A');
  const edited: DashboardTask = {
    ...wireframe(),
    title: 'Wireframe ready for review',
    progress: 75,
    priority: 'High',
    comments: [
      { id: 'comment-a', author: 'sarah', text: 'Ready for the next review.', time: 'Just now' },
    ],
    commentCount: 1,
    links: 0,
  };
  await act(async () => {
    dashboard.saveTask(edited);
  });
  expect(wireframe()).toEqual(edited);
  await unmount();
  await render('local:A');
  expect(wireframe()).toEqual(edited);
  expect(dashboard.storageError).toBe(false);
});

test('a keyed remount from local A to local B does not expose A edits or write them into B', async () => {
  await render('local:A');
  await act(async () => {
    dashboard.saveTask({
      ...wireframe(),
      title: 'Private local A task',
      comments: [
        { id: 'private-comment', author: 'sarah', text: 'A project comment', time: 'Just now' },
      ],
    });
  });
  const savedA = localStorage.getItem('fouc.project-dashboard.local:A');
  await render('local:B');
  expect(dashboard.state).toEqual(initialDashboardState);
  await act(async () => {
    dashboard.createTask(newTask('b-created'));
  });
  expect(dashboard.state.tasks.some((task) => task.title === 'Private local A task')).toBe(false);
  expect(localStorage.getItem('fouc.project-dashboard.local:B')).not.toContain('A project comment');
  expect(localStorage.getItem('fouc.project-dashboard.local:A')).toBe(savedA);
  await unmount();
  await render('local:A');
  expect(wireframe().title).toBe('Private local A task');
});

test('local and server projects with the same ID restore separate dashboard states', async () => {
  await render('local:A');
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), title: 'Local A title' });
  });
  await unmount();
  await render('server:A');
  expect(wireframe().title).toBe(initialDashboardState.tasks[0].title);
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), title: 'Server A title' });
  });
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
  await act(async () => {
    dashboard.createTask(newTask('created'));
    dashboard.removeTask('wireframe');
  });
  expect(dashboard.state.tasks.map((task) => task.id)).toEqual(['brand', 'landing', 'created']);
  expect(initialDashboardState).toEqual(seed);
  await unmount();
  await render('local:B');
  expect(dashboard.state).toEqual(seed);
});

test('StrictMode effect replay and remount restore one copy of each created task and activity', async () => {
  await render('local:A', true);
  await act(async () => {
    dashboard.createTask(newTask('strict-created'));
  });
  expect(dashboard.state.tasks.filter((task) => task.id === 'strict-created')).toHaveLength(1);
  expect(
    dashboard.state.activities.filter((activity) => activity.subject === 'Project strict-created'),
  ).toHaveLength(1);
  await unmount();
  await render('local:A', true);
  expect(dashboard.state.tasks.filter((task) => task.id === 'strict-created')).toHaveLength(1);
  expect(
    dashboard.state.activities.filter((activity) => activity.subject === 'Project strict-created'),
  ).toHaveLength(1);
  expect(new Set(dashboard.state.tasks.map((task) => task.id)).size).toBe(
    dashboard.state.tasks.length,
  );
});

test('projects and tasks remain separate, with linked progress, totals and exact favorites', async () => {
  await render('local:A');
  const project: DashboardProject = {
    id: 'new-project',
    name: 'Website launch',
    description: 'Launch checklist',
    priority: 'High',
    color: 'green',
    featured: true,
    starred: false,
    favoriteLabel: 'Website launch',
  };
  await act(async () => {
    dashboard.createProject(project);
  });
  expect(selectStats(dashboard.state)).toEqual({
    projects: 4,
    tasks: 3,
    inProgress: 3,
    completed: 0,
  });
  expect(
    selectProjects(dashboard.state).find((item) => item.project.id === project.id)?.progress,
  ).toBe(0);

  await act(async () => {
    dashboard.createTask({ ...newTask('launch-task'), projectId: project.id, progress: 50 });
    dashboard.createTask({
      ...newTask('review-task'),
      projectId: project.id,
      progress: 100,
      status: 'Completed',
    });
    dashboard.toggleProjectFavorite(project.id);
  });
  const summary = selectProjects(dashboard.state).find((item) => item.project.id === project.id)!;
  expect(summary.progress).toBe(75);
  expect(summary.status).toBe('On Progress');
  expect(
    selectFavorites(dashboard.state).find((item) => item.label === project.name)?.target,
  ).toEqual({ kind: 'project', id: project.id });
  expect(selectStats(dashboard.state)).toEqual({
    projects: 4,
    tasks: 5,
    inProgress: 4,
    completed: 1,
  });
  await act(async () => {
    dashboard.completeProject(project.id);
  });
  expect(
    selectProjects(dashboard.state).find((item) => item.project.id === project.id)?.progress,
  ).toBe(100);
  expect(selectStats(dashboard.state).completed).toBe(2);
});

test('completion, changing due month, reopening and deletion count each task once in milestones', async () => {
  await render('local:A');
  const february = () =>
    selectMilestones(dashboard.state).find((item) => item.month === '2027-02')!.actual;
  const march = () =>
    selectMilestones(dashboard.state).find((item) => item.month === '2027-03')!.actual;
  expect(february()).toBe(25);
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), status: 'Completed' });
  });
  expect(february()).toBe(26);
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), status: 'Completed' });
  });
  expect(february()).toBe(26);
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), dueDate: '2027-03-12' });
  });
  expect(february()).toBe(25);
  expect(march()).toBe(66);
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), status: 'On Progress', progress: 50 });
  });
  expect(march()).toBe(65);
  await act(async () => {
    dashboard.saveTask({ ...wireframe(), status: 'Completed' });
    dashboard.removeTask('wireframe');
  });
  expect(march()).toBe(65);
});

test('documents, form responses, meetings and collaborators restore without creating task cards', async () => {
  await render('local:A');
  const invoice: DashboardDocument = {
    id: 'invoice-a',
    kind: 'invoice',
    title: 'Design invoice',
    client: 'ABC Studio',
    email: 'studio@example.com',
    dueDate: '2027-02-20',
    currency: 'USD',
    items: [{ id: 'line-a', description: 'Design work', quantity: 2, rate: 400 }],
    notes: 'Thank you',
    status: 'Ready',
    starred: true,
  };
  const form: DashboardDocument = {
    id: 'form-a',
    kind: 'form',
    title: 'Feedback',
    description: '',
    questions: ['What works?'],
    responses: [{ id: 'response-a', answers: ['Clear navigation'], submittedAt: '2027-02-08' }],
    status: 'Ready',
    starred: false,
  };
  const meeting: DashboardMeeting = {
    id: 'review-a',
    title: 'Design review',
    startsAt: '2027-02-08T11:00',
    durationMinutes: 30,
    agenda: 'Review the wireframes',
    attendees: ['sarah', 'kiara'],
    link: 'https://example.com/review',
    comments: [],
  };
  await act(async () => {
    dashboard.saveDocument(invoice);
    dashboard.saveDocument(form);
    dashboard.saveMeeting(meeting);
    dashboard.saveMembers(['sarah', 'kiara']);
  });
  expect(dashboard.state.tasks).toHaveLength(3);
  expect(dashboard.state.projects).toHaveLength(3);
  expect(
    selectFavorites(dashboard.state).find((item) => item.label === invoice.title)?.target,
  ).toEqual({ kind: 'document', id: invoice.id });
  await unmount();
  await render('local:A');
  expect(dashboard.state.documents.find((item) => item.id === invoice.id)).toEqual(invoice);
  expect(dashboard.state.documents.find((item) => item.id === form.id)).toEqual(form);
  expect(dashboard.state.meetings.find((item) => item.id === meeting.id)).toEqual(meeting);
  expect(dashboard.state.memberIds).toEqual(['sarah', 'kiara']);
  await render('local:B');
  expect(dashboard.state.documents.some((item) => item.id === invoice.id)).toBe(false);
  expect(dashboard.state.memberIds).toEqual(initialDashboardState.memberIds);
});

test('inbox read state is durable and removing a project clears all linked targets', async () => {
  await render('local:A');
  await act(async () => {
    dashboard.markRead('activity-1');
    dashboard.saveTask({ ...wireframe(), starred: true });
  });
  expect(dashboard.state.activities.find((item) => item.id === 'activity-1')?.read).toBe(true);
  expect(
    dashboard.state.activities.some(
      (item) => item.target.kind === 'task' && item.target.id === 'wireframe',
    ),
  ).toBe(true);
  await act(async () => {
    dashboard.removeProject('wireframe-project');
    dashboard.markAllRead();
  });
  expect(dashboard.state.tasks.some((item) => item.projectId === 'wireframe-project')).toBe(false);
  expect(
    dashboard.state.activities.some(
      (item) => item.target.kind === 'task' && item.target.id === 'wireframe',
    ),
  ).toBe(false);
  expect(
    selectFavorites(dashboard.state).some(
      (item) => item.target.id === 'wireframe-project' || item.target.id === 'wireframe',
    ),
  ).toBe(false);
  await unmount();
  await render('local:A');
  expect(dashboard.state.activities.every((item) => item.read)).toBe(true);
  expect(dashboard.state.projects).toHaveLength(2);
});

test('favorite picker changes each resource type independently and restores exact targets', async () => {
  await render('local:A');
  const targets = [
    { kind: 'task', id: 'brand' },
    { kind: 'document', id: 'design-brief' },
  ] as const;
  await act(async () => {
    dashboard.saveFavorites([...targets]);
  });
  expect(selectFavorites(dashboard.state).map((item) => item.target)).toEqual([...targets]);
  await unmount();
  await render('local:A');
  expect(selectFavorites(dashboard.state).map((item) => item.target)).toEqual([...targets]);
});

test('comment counts and attachment links are based on saved comments, not stale counters', async () => {
  await render('local:A');
  await act(async () => {
    dashboard.saveTask({
      ...wireframe(),
      comments: [
        {
          id: 'file-comment',
          author: 'sarah',
          text: '',
          time: 'Now',
          attachment: {
            name: 'notes.txt',
            kind: 'file',
            size: '1 KB',
            content: 'data:text/plain;base64,aGVsbG8=',
          },
        },
      ],
      commentCount: 999,
      links: 999,
    });
  });
  expect(wireframe().commentCount).toBe(1);
  expect(wireframe().links).toBe(1);
  expect(selectProjects(dashboard.state)[0].comments).toBe(1);
  expect(selectProjects(dashboard.state)[0].links).toBe(1);
  await unmount();
  await render('local:A');
  expect(wireframe().comments[0].attachment?.content).toBe('data:text/plain;base64,aGVsbG8=');
});

test('a storage failure exposes unsaved changes and a subsequent save recovers without losing them', async () => {
  await render('local:A');
  const storage = window.localStorage;
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: storage.getItem.bind(storage),
      setItem: () => {
        throw new Error('Storage quota exceeded');
      },
      removeItem: storage.removeItem.bind(storage),
    },
  });
  try {
    await act(async () => {
      dashboard.saveTask({ ...wireframe(), title: 'Unsaved review changes' });
    });
    expect(wireframe().title).toBe('Unsaved review changes');
    expect(dashboard.storageError).toBe(true);
    expect(localStorage.getItem('fouc.project-dashboard.local:A')).toBeNull();
  } finally {
    if (original) Object.defineProperty(window, 'localStorage', original);
    else Reflect.deleteProperty(window, 'localStorage');
  }
  await act(async () => {
    dashboard.saveTask(wireframe());
  });
  expect(dashboard.storageError).toBe(false);
  expect(JSON.parse(localStorage.getItem('fouc.project-dashboard.local:A')!).tasks[0].title).toBe(
    'Unsaved review changes',
  );
});
