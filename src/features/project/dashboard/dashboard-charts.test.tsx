import { setLocale } from '@/lib/i18n';
import { afterAll, afterEach, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type {
  DashboardMeeting,
  DashboardMilestonePoint,
  DashboardTarget,
  DashboardTask,
} from './dashboard-model';
import { initialDashboardState } from './dashboard-seed';

interface RecordedChartOption {
  series: { name: string; data: number[] }[];
  xAxis: { data: string[] };
  yAxis: { max: number };
}

let ActivityMap: typeof import('./dashboard-charts').ActivityMap;
let MilestoneTracker: typeof import('./dashboard-charts').MilestoneTracker;
let TooltipProvider: typeof import('@/components/ui/tooltip').TooltipProvider;
let browser: Window;
let root: Root;
let host: HTMLDivElement;
let tasks: DashboardTask[];
let meetings: DashboardMeeting[];
let points: DashboardMilestonePoint[];
let opened: DashboardTarget[];
let editCalls: number;
let latestOption: RecordedChartOption | undefined;
const originalGlobals = new Map<string, unknown>();
const globalNames = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'HTMLInputElement',
  'NodeFilter',
  'MutationObserver',
  'ResizeObserver',
  'getComputedStyle',
  'localStorage',
  'IS_REACT_ACT_ENVIRONMENT',
];

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/' });
  class DimensionObserver {
    observe() {}
    disconnect() {}
  }
  const globals = globalThis as Record<string, unknown>;
  for (const name of globalNames) {
    originalGlobals.set(name, globals[name]);
    globals[name] =
      name === 'window'
        ? browser
        : name === 'IS_REACT_ACT_ENVIRONMENT'
          ? true
          : name === 'ResizeObserver'
            ? DimensionObserver
            : (browser as unknown as Record<string, unknown>)[name];
  }
  Object.defineProperty(browser.HTMLElement.prototype, 'clientWidth', { get: () => 508 });
  Object.defineProperty(browser.HTMLElement.prototype, 'clientHeight', { get: () => 220 });
  // Only the drawing backend is replaced; render and operate the real React controls.
  // Run this file with bun test --isolate to keep these module mocks scoped to this file.
  mock.module('echarts/core', () => ({
    use() {},
    init() {
      return {
        setOption(option: RecordedChartOption) {
          latestOption = option;
        },
        resize() {},
        dispose() {},
      };
    },
  }));
  mock.module('echarts/charts', () => ({ BarChart: {} }));
  mock.module('echarts/components', () => ({ GridComponent: {} }));
  mock.module('echarts/renderers', () => ({ CanvasRenderer: {} }));
  ({ ActivityMap, MilestoneTracker } = await import('./dashboard-charts'));
  ({ TooltipProvider } = await import('@/components/ui/tooltip'));
});

beforeEach(() => {
  setLocale('en-US');
  tasks = structuredClone(initialDashboardState.tasks);
  meetings = structuredClone(initialDashboardState.meetings);
  points = initialDashboardState.milestones.map((point) => ({
    month: point.month,
    target: point.target,
    actual: point.completed,
  }));
  opened = [];
  editCalls = 0;
  latestOption = undefined;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

afterAll(async () => {
  await browser.happyDOM.abort();
  const globals = globalThis as Record<string, unknown>;
  for (const [name, value] of originalGlobals) {
    if (value === undefined) delete globals[name];
    else globals[name] = value;
  }
});

async function renderActivity() {
  await act(async () => {
    root.render(
      <TooltipProvider>
        <ActivityMap
          tasks={tasks}
          meetings={meetings}
          onOpenTarget={(target) => opened.push(target)}
        />
      </TooltipProvider>,
    );
    await Promise.resolve();
  });
}

async function renderMilestones() {
  await act(async () => {
    root.render(
      <MilestoneTracker
        points={points}
        onEdit={() => {
          editCalls++;
        }}
      />,
    );
    await Promise.resolve();
  });
}

function eventButton(title: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    button.getAttribute('aria-label')?.startsWith(`${title}, `),
  );
}
function textButton(text: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent === text,
  );
}
function navigation(direction: 'Previous' | 'Next') {
  return host.querySelector<HTMLButtonElement>(`[aria-label="${direction} timeline period"]`);
}
async function click(button: HTMLElement | undefined | null) {
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}
function option() {
  expect(latestOption).toBeDefined();
  return latestOption!;
}
function series(name: string) {
  return option().series.find((item) => item.name === name)!.data;
}

async function selectMilestoneOption(label: string) {
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Milestone options"]');
  expect(trigger).toBeTruthy();
  await act(async () => {
    trigger!.focus();
    trigger!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
  });
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (element) => element.textContent?.trim() === label,
  );
  await click(item);
}

test('rescheduled tasks and meetings move between real day, week, month and year windows', async () => {
  await renderActivity();
  expect(eventButton('Setup Wireframe')).toBeDefined();
  expect(eventButton('Dev Sync Meeting')).toBeDefined();
  expect(eventButton('ABC Project Meeting')).toBeUndefined();

  tasks = tasks.map((task) =>
    task.id === 'wireframe' ? { ...task, scheduledDate: '2027-02-09' } : task,
  );
  meetings = meetings.map((meeting) =>
    meeting.id === 'dev-sync' ? { ...meeting, startsAt: '2027-03-01T14:00' } : meeting,
  );
  await renderActivity();
  expect(eventButton('Setup Wireframe')).toBeUndefined();
  expect(eventButton('Dev Sync Meeting')).toBeUndefined();
  expect(eventButton('Update Brand Logo Guidelines')).toBeDefined();

  await click(navigation('Next'));
  expect(eventButton('Setup Wireframe')).toBeDefined();
  expect(eventButton('ABC Project Meeting')).toBeDefined();
  expect(eventButton('Update Brand Logo Guidelines')).toBeUndefined();

  await click(textButton('Weekly'));
  expect(eventButton('Setup Wireframe')).toBeDefined();
  expect(eventButton('Update Brand Logo Guidelines')).toBeDefined();
  expect(eventButton('ABC Project Meeting')).toBeDefined();
  expect(eventButton('Dev Sync Meeting')).toBeUndefined();

  await click(textButton('Monthly'));
  expect(eventButton('Setup Wireframe')).toBeDefined();
  expect(eventButton('Dev Sync Meeting')).toBeUndefined();
  await click(navigation('Next'));
  expect(eventButton('Dev Sync Meeting')).toBeDefined();
  expect(eventButton('Setup Wireframe')).toBeUndefined();

  await click(textButton('Yearly'));
  expect(eventButton('Setup Wireframe')).toBeDefined();
  expect(eventButton('Dev Sync Meeting')).toBeDefined();
  await click(navigation('Next'));
  expect(eventButton('Setup Wireframe')).toBeUndefined();
  expect(eventButton('Dev Sync Meeting')).toBeUndefined();
  expect(host.textContent).toContain('No scheduled tasks or meetings in this period.');
});

test('live progress and assignee props update the task pill and task or meeting clicks open the exact target', async () => {
  await renderActivity();
  tasks = tasks.map((task) =>
    task.id === 'wireframe' ? { ...task, progress: 81, assignees: ['sarah'] } : task,
  );
  await renderActivity();
  const wireframe = eventButton('Setup Wireframe');
  expect(wireframe?.textContent).toContain('81%');
  expect(wireframe?.getAttribute('aria-label')).toContain('81% complete');
  expect(wireframe?.querySelector('img')?.getAttribute('alt')).toBe('Sarah Smither');
  await click(wireframe);
  await click(eventButton('Dev Sync Meeting'));
  expect(opened).toEqual([
    { kind: 'task', id: 'wireframe' },
    { kind: 'meeting', id: 'dev-sync' },
  ]);
});

test('a newly scheduled overlapping task has a separate clickable lane and disappears from the prior day after moving', async () => {
  await renderActivity();
  tasks.push({
    ...structuredClone(tasks.find((task) => task.id === 'wireframe')!),
    id: 'overlap-review',
    title: 'Overlap review',
    startHour: 10.5,
  });
  await renderActivity();
  const wireframe = eventButton('Setup Wireframe');
  const review = eventButton('Overlap review');
  expect(review).toBeDefined();
  expect(review?.style.getPropertyValue('--task-top')).not.toBe(
    wireframe?.style.getPropertyValue('--task-top'),
  );
  await click(wireframe);
  await click(review);
  expect(opened.map((target) => target.id)).toEqual(['wireframe', 'overlap-review']);

  tasks = tasks.map((task) =>
    task.id === 'overlap-review' ? { ...task, scheduledDate: '2027-02-09' } : task,
  );
  await renderActivity();
  expect(eventButton('Overlap review')).toBeUndefined();
  await click(navigation('Next'));
  expect(eventButton('Overlap review')).toBeDefined();
  expect(eventButton('Setup Wireframe')).toBeUndefined();
});

test('milestone prop changes update the displayed values and expand the scale while range controls select real months', async () => {
  await renderMilestones();
  expect(series('Actual')).toEqual([72, 25, 65, 82, 112, 50]);
  const april = host.querySelector<HTMLButtonElement>(
    '[aria-label="April 2027: target 85 tasks, actual 82 tasks"]',
  );
  expect(april).toBeTruthy();
  await act(async () => april!.focus());
  points = points.map((point) =>
    point.month === '2027-04' ? { ...point, target: 900, actual: 500 } : point,
  );
  await renderMilestones();
  expect(series('Target')[3]).toBe(900);
  expect(series('Actual')[3]).toBe(500);
  expect(option().yAxis.max).toBeGreaterThan(900);
  expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('500 Tasks');

  await click(textButton('1 Year'));
  expect(series('Actual')).toHaveLength(12);
  expect(option().xAxis.data).toEqual([
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]);
  await click(textButton('3 Months'));
  expect(series('Actual')).toEqual([72, 25, 65]);
  await click(textButton('1 Month'));
  expect(series('Actual')).toEqual([72]);
  expect(option().xAxis.data).toEqual(['Jan']);
});

test('keyboard focus and arrow navigation expose the correct milestone month, year and values', async () => {
  points = [
    { month: '2028-01', target: 100, actual: 60 },
    { month: '2028-02', target: 90, actual: 70 },
  ];
  await renderMilestones();
  const february = host.querySelector<HTMLButtonElement>(
    '[aria-label="February 2028: target 90 tasks, actual 70 tasks"]',
  );
  expect(february).toBeTruthy();
  await act(async () => february!.focus());
  expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('February 2028');
  expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('70 Tasks');
  await act(async () =>
    february!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })),
  );
  expect(document.activeElement?.getAttribute('aria-label')).toBe(
    'January 2028: target 100 tasks, actual 60 tasks',
  );
  expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('January 2028');
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    ),
  );
  expect(host.querySelector('[role="tooltip"]')).toBeNull();
});

test('milestone menu navigation reaches newly added next-year values and reset returns to the first reference period', async () => {
  await renderMilestones();
  points = [...points, { month: '2028-01', target: 210, actual: 185 }];
  await renderMilestones();
  expect(
    host.querySelector('[aria-label="January 2028: target 210 tasks, actual 185 tasks"]'),
  ).toBeNull();

  await selectMilestoneOption('Next period');
  expect(
    host.querySelector(
      '[aria-label="6 Months milestone target and actual tasks, July 2027 to December 2027"]',
    ),
  ).not.toBeNull();
  await selectMilestoneOption('Next period');
  const january = host.querySelector<HTMLButtonElement>(
    '[aria-label="January 2028: target 210 tasks, actual 185 tasks"]',
  );
  expect(january).not.toBeNull();
  expect(series('Target')).toEqual([210, 0, 0, 0, 0, 0]);
  expect(series('Actual')).toEqual([185, 0, 0, 0, 0, 0]);
  await act(async () => january!.focus());
  expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('January 2028');
  expect(host.querySelector('[role="tooltip"]')?.textContent).toContain('185 Tasks');

  await selectMilestoneOption('Previous period');
  expect(
    host.querySelector(
      '[aria-label="6 Months milestone target and actual tasks, July 2027 to December 2027"]',
    ),
  ).not.toBeNull();
  await selectMilestoneOption('Reset view');
  expect(
    host.querySelector(
      '[aria-label="6 Months milestone target and actual tasks, January 2027 to June 2027"]',
    ),
  ).not.toBeNull();
  expect(series('Actual')).toEqual([72, 25, 65, 82, 112, 50]);
  expect(
    host.querySelector('[aria-label="January 2028: target 210 tasks, actual 185 tasks"]'),
  ).toBeNull();
});

test('empty milestone data offers the parent editor and new values render after the empty state', async () => {
  points = [];
  await renderMilestones();
  expect(host.textContent).toContain('No milestone data yet.');
  await click(textButton('Add targets'));
  expect(editCalls).toBe(1);
  points = [{ month: '2028-04', target: 120, actual: 75 }];
  await renderMilestones();
  expect(host.textContent).not.toContain('No milestone data yet.');
  expect(series('Actual')[0]).toBe(75);
  expect(
    host.querySelector('[aria-label="April 2028: target 120 tasks, actual 75 tasks"]'),
  ).not.toBeNull();
});
