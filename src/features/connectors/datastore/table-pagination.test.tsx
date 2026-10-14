import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { RelationalTablePage, RelationalTableQuery } from '@fouc/shared';
import type { TablePagination as Pagination } from './table-pagination';
import type { AppAlertProvider as AlertProvider } from '@/components/app-alert-provider';

type Pending = { signal: AbortSignal; body: string; resolve: (response: Response) => void };
let browser: Window,
  root: Root,
  TablePagination: typeof Pagination,
  AppAlertProvider: typeof AlertProvider;
let requests: Pending[] = [],
  navigated: number[] = [];
const originalFetch = globalThis.fetch;
const query = (name: string): RelationalTableQuery => ({
  filter: { kind: 'condition', column: 'name', operator: 'equals', value: name },
  sort: [],
});
function page(value: RelationalTableQuery): RelationalTablePage {
  return {
    connectionId: 'session',
    database: 'fixture',
    table: 'items',
    columns: [],
    rows: [[1], [2], [3]],
    offset: 0,
    limit: 3,
    hasMore: true,
    query: value,
    statement: { sql: 'SELECT * FROM items LIMIT 4', parameters: [] },
    stableOrder: true,
  };
}

beforeAll(async () => {
  browser = new Window();
  const globals = globalThis as Record<string, unknown>;
  for (const name of [
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'MutationObserver',
  ])
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = ((_url: string, init: RequestInit) =>
    new Promise<Response>((resolve) =>
      requests.push({ signal: init.signal!, body: String(init.body), resolve }),
    )) as typeof fetch;
  TablePagination = (await import('./table-pagination')).TablePagination;
  AppAlertProvider = (await import('@/components/app-alert-provider')).AppAlertProvider;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
}, 20000);
afterAll(async () => {
  if (root) await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  await browser.happyDOM.abort();
});

async function render(key: string, filter = 'a', disabled = false) {
  const value = query(filter);
  await act(async () =>
    root.render(
      <AppAlertProvider>
        <TablePagination
          key={key}
          base="/api/fixture"
          schema="main"
          page={page(value)}
          query={value}
          revision={0}
          offset={0}
          limit={3}
          defaultSize={100}
          loadTimeMs={12}
          disabled={disabled}
          onNavigate={(offset) => navigated.push(offset)}
          onLimit={() => undefined}
          onDefault={() => undefined}
          onClose={() => undefined}
          exportAction={null}
        />
      </AppAlertProvider>,
    ),
  );
}
function button(name: string) {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function reply(index: number, totalRows: string) {
  await act(async () => requests[index].resolve(Response.json({ ok: true, data: { totalRows } })));
}

test('a changed query aborts a late count and prevents navigation into the old filter', async () => {
  requests = [];
  navigated = [];
  await render('query');
  await click('末页数据');
  expect(JSON.parse(requests[0].body)).toEqual(query('a'));
  expect(button('刷新总行数').getAttribute('aria-busy')).toBe('true');
  await render('query', 'b');
  expect(requests[0].signal.aborted).toBe(true);
  expect(button('刷新总行数').getAttribute('aria-busy')).not.toBe('true');
  await reply(0, '999');
  expect(navigated).toEqual([]);
  expect(document.body.textContent).toContain('总计 — 行');
  await click('末页数据');
  await reply(1, '8');
  expect(JSON.parse(requests[1].body)).toEqual(query('b'));
  expect(navigated).toEqual([6]);
  expect(document.body.textContent).toContain('总计 8 行');
});

test('pending edits disable query-changing controls and cancel an already requested last-page count', async () => {
  requests = [];
  navigated = [];
  await render('pending');
  await click('末页数据');
  await render('pending', 'a', true);
  expect(requests[0].signal.aborted).toBe(true);
  for (const name of [
    '刷新总行数',
    '每页行数',
    '首页数据',
    '上一页数据',
    '下一页数据',
    '末页数据',
    '关闭数据表',
  ])
    expect(button(name).disabled).toBe(true);
  expect(document.querySelector<HTMLInputElement>('input[aria-label="跳转数据页"]')!.disabled).toBe(
    true,
  );
  await reply(0, '9');
  expect(navigated).toEqual([]);
  await render('pending', 'a', false);
  expect(button('每页行数').disabled).toBe(false);
});
