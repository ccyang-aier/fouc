import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { saveSidebarChannels, useSidebarChannels, type SidebarChannel } from './sidebar-channels';

let browser: Window;
let root: Root;
let current: SidebarChannel[];

function Capture({ scope }: { scope: string | null }) {
  const channels = useSidebarChannels(scope);
  useEffect(() => { current = channels; }, [channels]);
  return null;
}
beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MutationObserver', 'getComputedStyle', 'localStorage']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });
async function render(scope: string | null) { await act(async () => root.render(<Capture scope={scope} />)); }

test('sidebar channels follow the complete principal, source and project scope', async () => {
  const scopes = ['alice:local:project-a', 'alice:local:project-b', 'bob:local:project-a', 'alice:server:project-a'];
  for (const [index, scope] of scopes.entries()) {
    await render(scope);
    expect(current).toEqual([]);
    await act(async () => saveSidebarChannels(scope, [{ id: String(index), name: `Channel ${index}` }]));
    expect(current[0].name).toBe(`Channel ${index}`);
  }
  for (const [index, scope] of scopes.entries()) {
    await render(scope);
    expect(current).toEqual([{ id: String(index), name: `Channel ${index}` }]);
    expect(JSON.parse(localStorage.getItem(`fouc.project.sidebar-tags.${scope}`)!)).toEqual(current);
  }
  await render(null);
  expect(current).toEqual([]);
});

test('a storage failure never publishes a channel change that was not saved', async () => {
  const scope = 'storage-failure:local:project';
  await render(scope);
  await act(async () => saveSidebarChannels(scope, [{ id: 'saved', name: 'Saved' }]));
  const storage = localStorage;
  const originalSetItem = storage.setItem;
  Object.defineProperty(storage, 'setItem', { configurable: true, value: () => { throw new Error('Storage full'); } });
  try {
    expect(() => saveSidebarChannels(scope, [])).toThrow('Storage full');
    expect(current).toEqual([{ id: 'saved', name: 'Saved' }]);
    await render(scope);
    expect(current).toEqual([{ id: 'saved', name: 'Saved' }]);
  } finally { Object.defineProperty(storage, 'setItem', { configurable: true, value: originalSetItem }); }
});
