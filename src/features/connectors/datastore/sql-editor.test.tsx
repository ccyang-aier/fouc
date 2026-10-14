import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  completionStatus,
  currentCompletions,
  selectedCompletionIndex,
  snippet,
} from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { Transaction } from '@codemirror/state';
import type { SqlEditor as SqlEditorComponent } from './sql-editor';
import { SqlMetadataCompletion } from './sql-metadata-completion';
import { setLocale } from '@/lib/i18n';

let browser: Window, root: Root, SqlEditor: typeof SqlEditorComponent;
const editorRef = createRef<EditorView>();
const nativeTables = ['order_items', 'orders'].map((name) => ({
  connectionId: 'test-connection',
  database: 'workbench.sqlite',
  schema: 'main',
  name,
  kind: 'table' as const,
  comment: null,
}));

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
    'KeyboardEvent',
    'MutationObserver',
    'ResizeObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ]) {
    globals[name] = (browser as unknown as Record<string, unknown>)[name];
  }
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  SqlEditor = (await import('./sql-editor')).SqlEditor;
});
beforeEach(() => {
  setLocale('zh-CN');
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  setLocale('zh-CN');
  document.body.replaceChildren();
});
afterAll(async () => {
  await browser.happyDOM.abort();
});

test('changing language updates the live editor while preserving document, selection and focus', async () => {
  const sql = "SELECT '原始用户数据';";
  const view = await mount(sql, { showRunGutter: true });
  view.dispatch({
    changes: { from: view.state.doc.length, insert: '\nSELECT 2;' },
    selection: { anchor: 4 },
  });
  view.focus();
  const documentBefore = view.state.doc.toString();
  const selectionBefore = view.state.selection.main.anchor;
  expect(view.contentDOM.getAttribute('aria-label')).toBe('SQL 编辑器');
  await act(async () => setLocale('en-US'));
  expect(editorRef.current).toBe(view);
  expect(view.state.doc.toString()).toBe(documentBefore);
  expect(view.state.selection.main.anchor).toBe(selectionBefore);
  expect(view.hasFocus).toBe(true);
  expect(view.contentDOM.getAttribute('aria-label')).toBe('SQL editor');
  expect(view.state.phrase('Find')).toBe('Find');
  expect(document.querySelector('.mw-sql-run-gutter button')?.getAttribute('aria-label')).toBe(
    'Run current statement',
  );
  await act(async () => setLocale('zh-CN'));
  expect(editorRef.current).toBe(view);
  expect(view.state.phrase('Find')).toBe('查找');
  expect(view.state.doc.toString()).toBe(documentBefore);
});

async function mount(value: string, extra: Partial<Parameters<typeof SqlEditorComponent>[0]> = {}) {
  await act(async () =>
    root.render(
      <SqlEditor
        value={value}
        provider="sqlite"
        editorRef={editorRef}
        onChange={() => {}}
        onRun={() => {}}
        snippets={[]}
        diagnostics={false}
        {...extra}
      />,
    ),
  );
  const view = editorRef.current!;
  view.dispatch({ selection: { anchor: value.length } });
  view.focus();
  return view;
}
function press(key: string, modifiers: KeyboardEventInit = {}) {
  const keyCode =
    (
      { Enter: 13, Tab: 9, Escape: 27, ArrowUp: 38, ArrowDown: 40, ' ': 32, '/': 191 } as Record<
        string,
        number
      >
    )[key] ?? key.toUpperCase().charCodeAt(0);
  const event = new KeyboardEvent('keydown', {
    key,
    keyCode,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  editorRef.current!.contentDOM.dispatchEvent(event);
  return event.defaultPrevented;
}
async function waitForCompletion() {
  const deadline = Date.now() + 2_000;
  while (completionStatus(editorRef.current!.state) !== 'active' && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 20));
  expect(completionStatus(editorRef.current!.state)).toBe('active');
  // Respect CodeMirror's guard against accepting a newly appeared popup accidentally.
  await new Promise((resolve) => setTimeout(resolve, 100));
}

test('Ctrl+Space opens SQL keyword completion with a native icon and an Enter key hint', async () => {
  const view = await mount('SELE');
  expect(press(' ', { ctrlKey: true })).toBe(true);
  await waitForCompletion();
  expect(currentCompletions(view.state)[selectedCompletionIndex(view.state)!].label).toBe('SELECT');
  const selected = document.querySelector('.fouc-sql-completion li[aria-selected]')!;
  expect(selected.querySelector('.fouc-sql-completion-key')?.textContent).toBe('↵ Enter');
  expect(
    selected.querySelector('.fouc-sql-completion-icon[data-kind="keyword"] svg path'),
  ).not.toBeNull();
  expect(selected.querySelector('.cm-completionIcon')).toBeNull();
  expect(press('Enter')).toBe(true);
  expect(view.state.doc.toString()).toBe('SELECT');
  expect(view.state.selection.main.head).toBe(6);
  expect(completionStatus(view.state)).toBeNull();
});

test('ordinary typing opens completion automatically and Enter inserts the keyword', async () => {
  const view = await mount('');
  view.dispatch({
    changes: { from: 0, insert: 'SELE' },
    selection: { anchor: 4 },
    annotations: Transaction.userEvent.of('input.type'),
  });
  await waitForCompletion();
  expect(press('Enter')).toBe(true);
  expect(view.state.doc.toString()).toBe('SELECT');
});

test('Alt+/ opens native table completion, arrow keys select candidates, Enter accepts and Escape dismisses', async () => {
  const metadata = new SqlMetadataCompletion('sqlite', {
    tables: async () => nativeTables,
    columns: async () => [],
  });
  const view = await mount('SELECT * FROM ord', {
    complete: (context) => metadata.complete(context, { schema: 'main', schemas: ['main'] }),
  });
  expect(press('/', { altKey: true })).toBe(true);
  await waitForCompletion();
  const options = currentCompletions(view.state);
  expect(options.some((option) => option.label === 'order_items')).toBe(true);
  const initial = selectedCompletionIndex(view.state)!;
  expect(press('ArrowDown')).toBe(true);
  expect(selectedCompletionIndex(view.state)).toBe((initial + 1) % options.length);
  expect(press('ArrowUp')).toBe(true);
  expect(selectedCompletionIndex(view.state)).toBe(initial);
  for (
    let index = 0;
    index < options.length &&
    currentCompletions(view.state)[selectedCompletionIndex(view.state)!].label !== 'order_items';
    index++
  )
    press('ArrowDown');
  expect(press('Enter')).toBe(true);
  expect(view.state.doc.toString()).toBe('SELECT * FROM order_items');
  press('/', { altKey: true });
  await waitForCompletion();
  expect(press('Escape')).toBe(true);
  expect(completionStatus(view.state)).toBeNull();
});

test('Tab still indents without a popup and Tab/Shift+Tab navigate actual snippet fields', async () => {
  const view = await mount('');
  expect(press('Tab')).toBe(true);
  expect(view.state.doc.toString()).toMatch(/^\s+$/);
  snippet('SELECT ${field} FROM ${table} WHERE id = ${id}')(
    view,
    { label: 'select' },
    0,
    view.state.doc.length,
  );
  expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
    'field',
  );
  expect(press('Tab')).toBe(true);
  expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
    'table',
  );
  expect(press('Tab', { shiftKey: true })).toBe(true);
  expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
    'field',
  );
});

test('Enter accepts table completion inside a snippet field', async () => {
  const metadata = new SqlMetadataCompletion('sqlite', {
    tables: async () => nativeTables,
    columns: async () => [],
  });
  const view = await mount('', {
    complete: (context) => metadata.complete(context, { schema: 'main', schemas: ['main'] }),
  });
  snippet('SELECT ${field} FROM ${table} WHERE id = ${id}')(view, { label: 'select' }, 0, 0);
  press('Tab');
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: 'order_' },
    selection: { anchor: from + 6 },
    annotations: Transaction.userEvent.of('input.type'),
  });
  await waitForCompletion();
  expect(press('Enter')).toBe(true);
  expect(view.state.doc.toString()).toBe('SELECT field FROM order_items WHERE id = id');
  expect(view.state.selection.main.empty).toBe(true);
});

test('more than eight completion candidates remain reachable by keyboard and Enter', async () => {
  const tables = Array.from({ length: 12 }, (_, index) => ({
    ...nativeTables[0],
    name: `order_items_${index}`,
  }));
  const metadata = new SqlMetadataCompletion('sqlite', {
    tables: async () => tables,
    columns: async () => [],
  });
  const view = await mount('SELECT * FROM order_', {
    complete: (context) => metadata.complete(context, { schema: 'main', schemas: ['main'] }),
  });
  press('/', { altKey: true });
  await waitForCompletion();
  expect(currentCompletions(view.state)).toHaveLength(12);
  expect(document.querySelectorAll('.fouc-sql-completion li').length).toBeGreaterThan(8);
  for (let index = 0; index < 9; index++) press('ArrowDown');
  expect(selectedCompletionIndex(view.state)).toBe(9);
  const selected = currentCompletions(view.state)[9].label;
  expect(press('Enter')).toBe(true);
  expect(view.state.doc.toString()).toBe(`SELECT * FROM ${selected}`);
});

test('execution, save, format and comment shortcuts reach the mounted editor without executing on completion', async () => {
  const runs: (string | undefined)[] = [];
  let saves = 0,
    formats = 0;
  const view = await mount('SELECT 1', {
    onRun: (mode) => {
      runs.push(mode);
    },
    onSave: () => {
      saves++;
    },
    onFormat: () => {
      formats++;
    },
  });
  expect(press('Enter', { ctrlKey: true })).toBe(true);
  expect(press('Enter', { ctrlKey: true, shiftKey: true })).toBe(true);
  expect(press('s', { ctrlKey: true })).toBe(true);
  expect(press('F', { ctrlKey: true, shiftKey: true })).toBe(true);
  expect(runs).toEqual([undefined, 'all']);
  expect(saves).toBe(1);
  expect(formats).toBe(1);
  expect(press('/', { ctrlKey: true })).toBe(true);
  expect(view.state.doc.toString()).toBe('-- SELECT 1');
  expect(press('z', { ctrlKey: true })).toBe(true);
  expect(view.state.doc.toString()).toBe('SELECT 1');
});

test('read-only SQL does not accept completion, indent, execute, save or format', async () => {
  let actions = 0;
  const view = await mount('SELECT 1', {
    readOnly: true,
    onRun: () => {
      actions++;
    },
    onSave: () => {
      actions++;
    },
    onFormat: () => {
      actions++;
    },
  });
  press('/', { altKey: true });
  press('Tab');
  press('Enter', { ctrlKey: true });
  press('s', { ctrlKey: true });
  press('F', { ctrlKey: true, shiftKey: true });
  expect(view.state.doc.toString()).toBe('SELECT 1');
  expect(completionStatus(view.state)).toBeNull();
  expect(actions).toBe(0);
});

test('run gutter preserves status badges and its busy feedback prevents a second execution', async () => {
  const sql = 'SELECT 1',
    runs: (string | undefined)[] = [];
  const mark = { sql, from: 0, to: sql.length };
  const onRun = (mode?: 'current' | 'all') => {
    runs.push(mode);
  };
  await mount(sql, { showRunGutter: true, executionMark: { ...mark, status: 'failed' }, onRun });
  expect(document.querySelector('.mw-sql-run-badge')?.textContent).toBe('!');
  document.querySelector<HTMLButtonElement>('.mw-sql-run-gutter button')!.click();
  expect(runs).toEqual(['current']);
  await mount(sql, { showRunGutter: true, executionMark: { ...mark, status: 'succeeded' }, onRun });
  expect(document.querySelector('.mw-sql-run-badge')?.textContent).toBe('✓');
  await mount(sql, { showRunGutter: true, executionMark: { ...mark, status: 'running' }, onRun });
  const busy = document.querySelector<HTMLButtonElement>('.mw-sql-run-gutter button')!;
  expect(busy.getAttribute('aria-busy')).toBe('true');
  expect(busy.disabled).toBe(true);
  expect(busy.querySelector('span')?.children).toHaveLength(3);
  busy.click();
  expect(runs).toEqual(['current']);
});
