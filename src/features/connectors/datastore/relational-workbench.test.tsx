import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  DATABASE_CAPABILITIES,
  defaultSqlEditorPreferences,
  type DatabaseCapabilities,
  type RelationalSession,
  type SqlDraftState,
} from '@fouc/shared';
import { newSqlTab } from './sql-tabs';
import type { RelationalWorkbench as Workbench } from './relational-workbench';
import type { AppAlertProvider as Alerts } from '@/components/app-alert-provider';

let browser: Window,
  root: Root,
  RelationalWorkbench: typeof Workbench,
  AppAlertProvider: typeof Alerts;
let session: RelationalSession, saved: SqlDraftState, writes: SqlDraftState[], unexpected: string[];
let restore: Promise<SqlDraftState> | null = null;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  browser = new Window();
  const globals = globalThis as Record<string, unknown>;
  for (const name of [
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Text',
    'Range',
    'DOMRect',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'StorageEvent',
    'CustomEvent',
    'MutationObserver',
    'ResizeObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ])
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  RelationalWorkbench = (await import('./relational-workbench')).RelationalWorkbench;
  AppAlertProvider = (await import('@/components/app-alert-provider')).AppAlertProvider;
}, 20000);

beforeEach(() => {
  const connectionId = crypto.randomUUID();
  session = {
    id: crypto.randomUUID(),
    connectionId,
    provider: 'sqlite',
    database: 'test.sqlite',
    info: {},
    capabilities: {
      connectionId,
      source: 'server',
      health: 'connected',
      checkedAt: 1,
      capabilities: Object.fromEntries(
        DATABASE_CAPABILITIES.map((key) => [key, false]),
      ) as DatabaseCapabilities,
      restrictions: { readOnly: true, production: false },
    },
  };
  saved = { tabs: [], activeTabId: null, version: null, updatedAt: null };
  writes = [];
  unexpected = [];
  restore = null;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    let data: unknown;
    if (path.endsWith('/sql-library/drafts')) {
      if (init?.method === 'PUT') {
        const snapshot = JSON.parse(init.body as string);
        saved = {
          tabs: snapshot.tabs,
          activeTabId: snapshot.activeTabId,
          version: crypto.randomUUID(),
          updatedAt: Date.now(),
        };
        writes.push(structuredClone(saved));
        data = saved;
      } else data = restore ? await restore : saved;
    } else if (path.endsWith('/sql-library/preferences')) data = defaultSqlEditorPreferences();
    else if (path.endsWith('/sql-library')) data = { folders: [], files: [] };
    else if (path.endsWith('/schemas')) data = ['main'];
    else if (path.endsWith('/schemas/main/tables')) data = [];
    else {
      unexpected.push(`${init?.method ?? 'GET'} ${path}`);
      return Response.json(
        { ok: false, error: { message: 'Unexpected request' } },
        { status: 500 },
      );
    }
    return Response.json({ ok: true, data });
  }) as typeof fetch;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  expect(unexpected).toEqual([]);
  document.body.replaceChildren();
  globalThis.fetch = originalFetch;
});
afterAll(async () => {
  await browser.happyDOM.abort();
});

async function mount(key = session.id) {
  await act(async () =>
    root.render(
      <StrictMode>
        <AppAlertProvider>
          <RelationalWorkbench key={key} session={session} name="Test SQLite" onBack={() => {}} />
        </AppAlertProvider>
      </StrictMode>,
    ),
  );
}
function queryTabs() {
  return [...document.querySelectorAll<HTMLElement>('[role="tab"][data-tab-id]')];
}
function newQuery() {
  return document.querySelector<HTMLButtonElement>('[aria-label="新建 SQL 查询"]')!;
}
async function clickNew() {
  await act(async () => newQuery().click());
}
function seed(count: number) {
  const tabs = Array.from({ length: count }, (_, index) => ({
    ...newSqlTab(session.database, 'main', `查询 ${index + 1}`),
    sql: index < 2 ? `SELECT ${index + 1};` : '',
    originalSql: '',
  }));
  saved = {
    tabs,
    activeTabId: tabs.at(-1)?.id ?? null,
    version: crypto.randomUUID(),
    updatedAt: 1,
  };
  return structuredClone(saved);
}

test('restored query tabs are visible before New; each click adds one and reconnect preserves edited SQL', async () => {
  const prior = seed(5);
  await mount();
  expect(queryTabs()).toHaveLength(5);
  expect(queryTabs().every((tab) => !tab.closest('[hidden]'))).toBe(true);
  expect(document.querySelector('[aria-label="数据浏览"]')?.getAttribute('aria-selected')).toBe(
    'true',
  );
  await clickNew();
  expect(queryTabs()).toHaveLength(6);
  expect(queryTabs().at(-1)?.textContent).toBe('查询 6');
  expect(queryTabs().filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  await act(async () => root.unmount());
  expect(saved.tabs.slice(0, 5)).toEqual(prior.tabs);
  expect(saved.tabs).toHaveLength(6);
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await mount('reconnect');
  expect(queryTabs()).toHaveLength(6);
  expect(queryTabs().every((tab) => !tab.closest('[hidden]'))).toBe(true);
  await clickNew();
  expect(queryTabs()).toHaveLength(7);
  await act(async () => root.unmount());
  expect(saved.tabs.slice(0, 5)).toEqual(prior.tabs);
  expect(writes.at(-1)?.tabs).toHaveLength(7);
});

test('a fresh connection does not silently create a query before New', async () => {
  await mount();
  const header = document.querySelector('.mw-breadcrumb')!;
  expect(header.querySelector('[aria-label="新建"]')).toBeNull();
  expect(header.querySelector('[aria-label="搜索对象"]')).toBeNull();
  expect(header.querySelector('[aria-label="SQLite 原生备份"]')).toBeNull();
  expect(header.querySelector('[aria-label="解锁表格写入"]')).not.toBeNull();
  expect(queryTabs()).toHaveLength(0);
  expect(writes).toHaveLength(0);
  await clickNew();
  expect(queryTabs()).toHaveLength(1);
  expect(queryTabs()[0].textContent).toBe('查询 1');
  expect(document.querySelector('.cm-content')?.textContent).toBe('');
  await clickNew();
  expect(queryTabs()).toHaveLength(2);
});

test('opening SQL from the view menu initializes once; closing the last query does not recreate it', async () => {
  await mount();
  const openSql = async () => {
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="工作台视图"]')!.click(),
    );
    const sql = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item) => item.textContent === 'SQL 查询',
    )!;
    await act(async () => sql.click());
  };
  await openSql();
  expect(queryTabs()).toHaveLength(1);
  expect(document.querySelector('.cm-content')?.textContent).toBe('SELECT 1 AS result;');
  await act(async () =>
    document.querySelector<HTMLButtonElement>('[aria-label="关闭 查询 1"]')!.click(),
  );
  expect(queryTabs()).toHaveLength(0);
  await openSql();
  expect(queryTabs()).toHaveLength(0);
  await clickNew();
  expect(queryTabs()).toHaveLength(1);
  expect(document.querySelector('.cm-content')?.textContent).toBe('');
});

test('New waits for asynchronous restoration, then adds one to the already visible tabs', async () => {
  const prior = seed(3);
  let release!: (value: SqlDraftState) => void;
  restore = new Promise((resolve) => {
    release = resolve;
  });
  await mount();
  expect(newQuery().disabled).toBe(true);
  await clickNew();
  await act(async () => release(prior));
  expect(queryTabs()).toHaveLength(3);
  expect(queryTabs().every((tab) => !tab.closest('[hidden]'))).toBe(true);
  expect(newQuery().disabled).toBe(false);
  await clickNew();
  expect(queryTabs()).toHaveLength(4);
});
