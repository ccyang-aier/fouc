import { AppAlertProvider } from '@/components/app-alert-provider';
import { setLocale, type MessageCatalog } from '@/lib/i18n';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { DashboardDocumentDialog } from '../dashboard/dashboard-document-dialog';
import { documentCsv, documentHtml } from '../dashboard/dashboard-document-export';
import { calendarFile } from '../dashboard/dashboard-meeting-dialog';
import type { DashboardInvoice } from '../dashboard/dashboard-model';
import { initialDashboardState } from '../dashboard/dashboard-seed';
import { projectCatalogs } from './catalogs';
import { fixtureArrayField, fixtureField, translateFixed } from './display';
import { messages as labelMessages } from './labels';

let browser: Window;
let root: Root | undefined;
let host: HTMLDivElement;
const previous = new Map<string, unknown>();

beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'MutationObserver',
    'getComputedStyle',
    'localStorage',
    'IS_REACT_ACT_ENVIRONMENT',
  ]) {
    previous.set(key, globals[key]);
    globals[key] =
      key === 'window'
        ? browser
        : key === 'IS_REACT_ACT_ENVIRONMENT'
          ? true
          : (browser as unknown as Record<string, unknown>)[key];
  }
  browser.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  browser.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  setLocale('zh-CN');
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host?.remove();
});
afterAll(async () => {
  await browser.happyDOM.abort();
  const globals = globalThis as Record<string, unknown>;
  for (const [key, value] of previous) {
    if (value === undefined) delete globals[key];
    else globals[key] = value;
  }
});

test('project catalogs always supply both languages', () => {
  const catalogs: readonly MessageCatalog[] = [labelMessages, ...projectCatalogs];
  const pairs = catalogs.flatMap((catalog) => Object.values(catalog));
  expect(pairs.every((pair) => pair.length === 2)).toBe(true);
  expect(
    pairs.every((pair) => pair.every((text) => typeof text === 'string' && text.trim().length > 0)),
  ).toBe(true);
});

test('seed display uses explicit object and field identities, preserving user content', () => {
  const task = structuredClone(initialDashboardState.tasks[0]);
  const english = fixtureField(task, 'title', 'en-US');
  expect(fixtureField(task, 'title', 'zh-CN')).not.toBe(english);
  expect(fixtureField({ id: task.id, title: english }, 'title', 'zh-CN')).toBe(task.title);
  expect(fixtureField({ id: 'user-owned-id', title: english }, 'title', 'zh-CN')).toBe(english);
  expect(fixtureField({ ...task, title: 'Custom user content' }, 'title', 'zh-CN')).toBe(
    'Custom user content',
  );
  expect(task.status).toBe('On Progress');
  expect(task.id).toBe(initialDashboardState.tasks[0].id);
  const form = initialDashboardState.documents.find((item) => item.kind === 'form')!;
  expect(fixtureArrayField(form, 'questions', 0, 'zh-CN')).toBe('你的项目叫什么？');
  expect(fixtureArrayField(form, 'questions', 0, 'en-US')).toBe('What is your project name?');
});

test('system activity and source dates render in the selected locale', () => {
  const event = {
    id: 'new-event',
    actionKey: 'created',
    text: 'created',
    time: '2027-02-08T11:23:00Z',
    subject: '',
    target: { kind: 'task', id: 'user-task' },
  };
  expect(fixtureField(event, 'text', 'zh-CN')).toBe('创建了');
  expect(fixtureField(event, 'text', 'en-US')).toBe('created');
  const activity = initialDashboardState.activities[0];
  expect(activity.time).toMatch(/^2027-02-08T/);
  expect(fixtureField(activity, 'time', 'zh-CN')).toContain('2027');
  expect(fixtureField(activity, 'time', 'en-US')).toContain('Feb');
  expect(fixtureField(activity, 'time', 'zh-CN')).not.toContain('Feb');
  const sourceTime = { id: activity.id, time: 'Feb 8, 2027 7:23PM' };
  expect(fixtureField(sourceTime, 'time', 'zh-CN')).not.toContain('Feb');
});

test('exports localize headers, dates and seed copy but preserve and escape user content', () => {
  const proposal = initialDashboardState.documents[0];
  const zh = documentHtml(proposal);
  expect(zh).toContain('lang="zh-CN"');
  expect(zh).toContain('提案');
  expect(zh).not.toContain('2027-02-28');
  setLocale('en-US');
  const en = documentHtml(proposal);
  expect(en).toContain('lang="en-US"');
  expect(en).toContain('Design Proposal');
  const invoice: DashboardInvoice = {
    id: 'user-invoice',
    kind: 'invoice',
    title: '<User & title>',
    status: 'Draft',
    starred: false,
    client: 'Customer',
    email: '',
    dueDate: '',
    currency: 'USD',
    notes: 'User notes',
    items: [{ id: 'line', description: 'User, item', quantity: 2, rate: 10 }],
  };
  expect(documentHtml(invoice)).toContain('&lt;User &amp; title&gt;');
  const englishCsv = documentCsv(invoice);
  expect(englishCsv).toContain('"Description","Quantity","Rate","Amount"');
  expect(englishCsv).toContain('"User, item"');
  setLocale('zh-CN');
  expect(documentCsv(invoice)).toContain('"说明","数量","单价","金额"');
  const calendar = calendarFile(initialDashboardState.meetings[0]);
  expect(calendar).toContain('SUMMARY:研发同步会议');
  expect(calendar).toContain('参与人:');
});

test('an open document keeps its draft and existing validation while language changes', async () => {
  const saved: DashboardInvoice = {
    id: 'draft-invoice',
    kind: 'invoice',
    title: 'My user invoice',
    status: 'Draft',
    starred: false,
    client: '',
    email: '',
    dueDate: '2027-02-09',
    currency: 'USD',
    notes: 'Do not translate my notes',
    items: [{ id: 'line', description: '', quantity: 1, rate: 0 }],
  };
  const view = (
    <AppAlertProvider>
      <DashboardDocumentDialog
        kind="invoice"
        scopeKey="local:my-project"
        document={saved}
        onClose={() => {}}
        onSave={() => {}}
      />
    </AppAlertProvider>
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(view));
  const title = host.querySelector<HTMLInputElement>('input')!;
  title.focus();
  const ready = [...host.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === '标记就绪',
  )!;
  expect(ready).toBeDefined();
  await act(async () => ready.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('客户');
  await act(async () => setLocale('en-US'));
  expect(host.querySelector('input')).toBe(title);
  expect(title.value).toBe('My user invoice');
  expect(host.querySelector('textarea')?.value).toBe('Do not translate my notes');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Enter a client name.');
  expect(host.textContent).toContain('Save draft');
  expect(translateFixed('Enter a client name.', 'zh-CN')).toContain('客户');
  // A persisted English preference must still produce the Chinese server snapshot.
  expect(renderToString(view)).toContain('保存草稿');
});
