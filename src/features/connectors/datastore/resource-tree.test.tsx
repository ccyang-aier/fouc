import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DatabaseObjectInfo, RelationalTableStructure } from '@fouc/shared';
import type { ResourceTree as Tree } from './resource-tree';

type Request = { url: string; signal: AbortSignal | null; resolve: (response: Response) => void };
let browser: Window, root: Root, ResourceTree: typeof Tree;
let requests: Request[] = [],
  opened: string[] = [],
  details: unknown[][] = [];
const originalFetch = globalThis.fetch;
const base = '/api/database/relational/sessions/resource-tree-test';
const tables: DatabaseObjectInfo[] = [
  {
    connectionId: 'test',
    database: 'test.sqlite',
    schema: 'main',
    name: 'customers',
    kind: 'table',
    comment: null,
  },
  {
    connectionId: 'test',
    database: 'test.sqlite',
    schema: 'main',
    name: 'orders',
    kind: 'table',
    comment: null,
  },
  {
    connectionId: 'test',
    database: 'test.sqlite',
    schema: 'main',
    name: 'order/overview',
    kind: 'view',
    comment: null,
  },
];

function catalog(
  table: string,
  patch: Partial<RelationalTableStructure> = {},
): RelationalTableStructure {
  return {
    connectionId: 'test',
    provider: 'sqlite',
    schema: 'main',
    table,
    kind: table === 'order/overview' ? 'view' : 'table',
    columns: [
      {
        name: 'id',
        dataType: 'INTEGER',
        isNullable: true,
        isPrimaryKey: true,
        isUnique: false,
        columnDefault: null,
        extra: null,
        comment: null,
        numericPrecision: null,
        numericScale: null,
        characterMaximumLength: null,
      },
      {
        name: 'name',
        dataType: 'VARCHAR(120)',
        isNullable: false,
        isPrimaryKey: false,
        isUnique: false,
        columnDefault: null,
        extra: null,
        comment: null,
        numericPrecision: null,
        numericScale: null,
        characterMaximumLength: 120,
      },
    ],
    indexes: [
      {
        name: 'name_unique',
        method: 'btree',
        unique: true,
        primary: false,
        valid: true,
        visible: null,
        constraintBacked: false,
        parts: [
          {
            position: 1,
            column: 'name',
            expression: null,
            role: 'key',
            descending: false,
            nulls: null,
            prefixLength: null,
            collation: null,
          },
        ],
        predicate: null,
        definition: null,
        comment: null,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_customer',
        nameSource: 'catalog',
        columns: ['customer_id'],
        referencedSchema: 'main',
        referencedTable: 'customers',
        referencedColumns: ['id'],
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
        match: 'NONE',
        deferrable: null,
        initiallyDeferred: null,
        validated: true,
        definition: null,
      },
    ],
    triggers: [
      {
        name: 'audit_insert',
        timing: 'AFTER',
        events: ['INSERT'],
        orientation: 'ROW',
        enabled: null,
        definition: 'CREATE TRIGGER audit_insert',
      },
    ],
    constraints: [],
    properties: {},
    definition: { sql: '', origin: 'native', warnings: [] },
    ...patch,
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
  globalThis.fetch = ((url: string, init?: RequestInit) =>
    new Promise<Response>((resolve) =>
      requests.push({ url, signal: init?.signal ?? null, resolve }),
    )) as typeof fetch;
  ResourceTree = (await import('./resource-tree')).ResourceTree;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
}, 20000);

afterAll(async () => {
  if (root) await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  await browser.happyDOM.abort();
});

async function render(key: string, table = 'customers', revision = 0, schema = 'main') {
  await act(async () =>
    root.render(
      <ResourceTree
        key={key}
        base={base}
        name="Test"
        schemas={[schema]}
        schema={schema}
        tables={tables}
        table={table}
        revision={revision}
        search=""
        hidden={false}
        onHide={() => undefined}
        onSearch={() => undefined}
        onSchema={() => undefined}
        onTable={(value) => opened.push(value)}
        onRefresh={() => undefined}
        onStructure={(...args) => details.push(args)}
      />,
    ),
  );
}
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.getAttribute('aria-label') === label,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function reply(index: number, data: RelationalTableStructure) {
  await act(async () => requests[index].resolve(Response.json({ ok: true, data })));
}
function reset() {
  requests = [];
  opened = [];
  details = [];
}

test('catalog expansion is lazy and independent; all kinds expose real counts and node navigation', async () => {
  reset();
  await render('independent');
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(
    `http://127.0.0.1:8710${base}/schemas/main/tables/customers/structure`,
  );
  expect(document.querySelector('[aria-label="字段数量"]')!.textContent).toBe('—');
  await reply(0, catalog('customers', { foreignKeys: [], triggers: [] }));
  expect(document.querySelector('[aria-label="字段数量"]')!.textContent).toBe('2');
  expect(document.querySelector('[aria-label="索引数量"]')!.textContent).toBe('1');
  await click('展开 customers 字段');
  await click('展开 customers 索引');
  await click('展开 customers 外键');
  expect(document.body.textContent).toContain('暂无外键');
  await click('查看 customers 字段 name (VARCHAR(120)) · 非空');
  await click('查看 customers 索引 name_unique');
  expect(details).toEqual([
    ['customers', 'columns', 'name'],
    ['customers', 'indexes', 'name_unique'],
  ]);
  await click('展开 orders 对象');
  expect(opened).toEqual([]); // Inspecting another object does not query or select its data.
  expect(document.querySelector('[aria-label="收起 customers 对象"]')).not.toBeNull();
  expect(requests).toHaveLength(2);
  await reply(1, catalog('orders'));
  await click('展开 orders 外键');
  await click('展开 orders 触发器');
  await click('查看 orders 外键 fk_customer');
  await click('查看 orders 触发器 audit_insert');
  expect(details.slice(2)).toEqual([
    ['orders', 'foreignKeys', 'fk_customer'],
    ['orders', 'triggers', 'audit_insert'],
  ]);
  await click('收起 orders 对象');
  await click('展开 orders 对象');
  expect(requests).toHaveLength(2);
  expect(document.querySelector('[aria-label="查看 orders 外键 fk_customer"]')).not.toBeNull();
});

test('view metadata is encoded and cached independently, and refresh reads visited objects again', async () => {
  reset();
  await render('views');
  await reply(0, catalog('customers'));
  await click('展开 order/overview 对象');
  expect(requests[1].url).toContain('tables/order%2Foverview/structure');
  await reply(1, catalog('order/overview', { indexes: [], foreignKeys: [], triggers: [] }));
  await click('展开 order/overview 字段');
  await click('展开 order/overview 索引');
  expect(document.querySelector('[aria-label="order/overview 字段列表"]')!.textContent).toContain(
    '(INTEGER)',
  );
  expect(document.querySelector('[aria-label="order/overview 索引列表"]')!.textContent).toContain(
    '暂无索引',
  );
  await render('views', 'customers', 1);
  expect(requests).toHaveLength(4);
  await reply(2, catalog('customers', { indexes: [] }));
  await reply(
    3,
    catalog('order/overview', { columns: [], indexes: [], foreignKeys: [], triggers: [] }),
  );
  expect(document.querySelector('[aria-label="order/overview 字段列表"]')!.textContent).toContain(
    '暂无字段',
  );
  expect(
    document.querySelector('[data-resource-object="customers"] [aria-label="索引数量"]')!
      .textContent,
  ).toBe('0');
});

test('schema switches abort old catalog reads; errors offer retry without fabricating an empty count', async () => {
  reset();
  await render('old-schema');
  await render('new-schema', 'customers', 0, 'other/schema');
  expect(requests[0].signal!.aborted).toBe(true);
  expect(requests[1].url).toContain('schemas/other%2Fschema/');
  await reply(0, catalog('customers', { columns: [] }));
  expect(document.querySelector('[aria-label="字段数量"]')!.textContent).toBe('—');
  await act(async () =>
    requests[1].resolve(
      Response.json({ ok: false, error: { message: 'catalog unavailable' } }, { status: 500 }),
    ),
  );
  expect(document.body.textContent).toContain('读取结构失败');
  expect(document.querySelector('[aria-label="字段数量"]')).toBeNull();
  const retry = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === '重试',
  )!;
  await act(async () => retry.click());
  expect(requests).toHaveLength(3);
  await reply(2, catalog('customers', { schema: 'other/schema' }));
  expect(document.querySelector('[aria-label="字段数量"]')!.textContent).toBe('2');
  expect(document.body.textContent).not.toContain('读取结构失败');
});
