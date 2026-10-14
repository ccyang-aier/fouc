import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ConnectionSelectionDock as DockComponent } from './selection-dock';
import { createUiMessages } from '../../i18n/ui-message';
import { messages } from './batch.messages';
import { setLocale } from '@/lib/i18n';
import type { ConnectionBatchResult } from './batch';

let browser: Window;
let root: Root;
let ConnectionSelectionDock: typeof DockComponent;

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000' });
  const globals = globalThis as Record<string, unknown>;
  for (const key of [
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'MutationObserver',
  ])
    globals[key] = (browser as unknown as Record<string, unknown>)[key];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  setLocale('zh-CN');
  ConnectionSelectionDock = (await import('./selection-dock')).ConnectionSelectionDock;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
}, 30000);

afterAll(async () => {
  await act(async () => {
    setLocale('zh-CN');
    root?.unmount();
  });
  await browser.happyDOM.abort();
});

test('an expanded batch failure keeps its row and updates text when the language changes', async () => {
  const failure = createUiMessages(messages).message('operationFailed');
  const result: ConnectionBatchResult = {
    action: 'tags',
    completed: 1,
    total: 1,
    succeeded: [],
    failed: [{ id: 'keep-id', name: '连接 keep 42', message: failure }],
    stopped: false,
  };
  const noop = () => {};
  await act(async () =>
    root.render(
      <ConnectionSelectionDock
        count={1}
        progress={null}
        result={result}
        onTags={noop}
        onTest={noop}
        onDelete={noop}
        onClear={noop}
        onDismiss={noop}
      />,
    ),
  );
  const details = document.querySelector('details')!;
  const row = details.querySelector('li')!;
  details.open = true;
  expect(row.textContent).toBe('连接 keep 42操作失败');
  await act(async () => {
    setLocale('en-US');
  });
  expect(document.querySelector('details')).toBe(details);
  expect(details.open).toBe(true);
  expect(details.querySelector('li')).toBe(row);
  expect(row.textContent).toBe('连接 keep 42Operation failed');
  expect(document.body.textContent).toContain('Selected 1');
  expect(document.body.textContent).toContain('Tag update complete · 0 succeeded · 1 failed');
  expect(result.failed[0].id).toBe('keep-id');
  expect(result.failed[0].message).toBe(failure);
  await act(async () => {
    setLocale('zh-CN');
  });
  expect(row.textContent).toBe('连接 keep 42操作失败');
});
