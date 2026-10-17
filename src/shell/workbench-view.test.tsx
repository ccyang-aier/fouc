import { afterAll, beforeAll, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { closeSettings } from '@/lib/settings-navigation';
import { openSkillsMarket } from '@/features/community/community-navigation';
import { useWorkbenchView } from './workbench-view';

let browser: Window;
let root: Root;
let current: ReturnType<typeof useWorkbenchView>;
let scope = 'principal:local:project-a';
function Capture() {
  const value = useWorkbenchView(scope);
  useEffect(() => { current = value; }, [value]);
  return null;
}

beforeAll(() => {
  browser = new Window({ url: 'http://localhost:3000/?view=home' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

test('page state follows native history while settings remain an overlay and scopes reset the toolbar', async () => {
  await act(async () => root.render(<Capture />));
  expect(current[0]).toBe('home');
  await act(async () => current[1]('members'));
  await act(async () => current[1]('assets'));
  expect(current[0]).toBe('assets');
  const length = browser.history.length;
  await act(async () => current[1]('assets'));
  expect(browser.history.length).toBe(length);
  await act(async () => current[1]('settings'));
  expect(current[0]).toBe('assets');
  expect(current[2]).toBe(true);
  await act(async () => closeSettings());
  expect(current[2]).toBe(false);
  expect(current[0]).toBe('assets');
  expect(browser.history.length).toBe(length);
  await act(async () => {
    await new Promise<void>(resolve => {
      browser.addEventListener('popstate', () => resolve(), { once: true });
      current[3].goBack();
    });
  });
  expect(current[0]).toBe('members');
  expect(current[3].canGoForward).toBe(true);
  await act(async () => openSkillsMarket());
  expect(current[0]).toBe('community');
  expect(browser.location.search).toContain('communityType=skills');
  expect(current[3].canGoForward).toBe(false);
  scope = 'other-principal:server:project-b';
  await act(async () => root.render(<Capture />));
  expect(current[3].canGoBack).toBe(false);
  expect(current[3].canGoForward).toBe(false);
});
