import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { closeSettings, openSettings, setSettingsSection } from './settings-navigation';
import { getNavigationSnapshot, goBack, goForward, pushWorkbenchLocation, replaceWorkbenchLocation, startNavigationHistory, subscribeNavigationHistory } from './navigation-history';

let browser: Window;
let unsubscribe: () => void;
let sequence = 0;
beforeEach(() => {
  browser = new Window({ url: 'http://localhost:3000/?view=home' });
  const globals = globalThis as Record<string, unknown>;
  globals.window = browser;
  globals.Event = browser.Event;
  unsubscribe = subscribeNavigationHistory(() => {});
  startNavigationHistory(`guest:local:history-${++sequence}`);
});
afterEach(async () => { unsubscribe(); await browser.happyDOM.abort(); });
const navigate = (view: string) => pushWorkbenchLocation(new URL(`?view=${view}`, browser.location.href));
const navigationMarker = () => (browser.history.state as { foucNavigation: unknown }).foucNavigation;
function traverse(action: () => void) {
  return new Promise<void>(resolve => { browser.addEventListener('popstate', () => resolve(), { once: true }); action(); });
}

test('native back/forward follows pages, skips duplicates and truncates the forward branch', async () => {
  expect(getNavigationSnapshot()).toEqual({ canGoBack: false, canGoForward: false });
  const initialLength = browser.history.length;
  navigate('members');
  navigate('members');
  navigate('assets');
  expect(browser.history.length).toBe(initialLength + 2);
  expect(getNavigationSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
  await traverse(goBack);
  expect(browser.location.search).toBe('?view=members');
  expect(getNavigationSnapshot()).toEqual({ canGoBack: true, canGoForward: true });
  await traverse(goBack);
  expect(browser.location.search).toBe('?view=home');
  expect(getNavigationSnapshot()).toEqual({ canGoBack: false, canGoForward: true });
  await traverse(goForward);
  expect(browser.location.search).toBe('?view=members');
  navigate('tasks');
  expect(getNavigationSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
  goForward();
  expect(browser.location.search).toBe('?view=tasks');
});

test('settings and in-page replacements preserve the navigation entry', async () => {
  navigate('assets');
  const length = browser.history.length;
  const marker = navigationMarker();
  openSettings('appearance');
  expect(browser.location.search).toContain('returnView=assets');
  setSettingsSection('general');
  closeSettings();
  const target = new URL(browser.location.href);
  target.searchParams.set('detail', 'document');
  replaceWorkbenchLocation(target);
  expect(browser.history.length).toBe(length);
  expect(navigationMarker()).toEqual(marker);
  expect(browser.location.search).toBe('?view=assets&detail=document');
  await traverse(goBack);
  expect(browser.location.search).toBe('?view=home');
  await traverse(goForward);
  expect(browser.location.search).toBe('?view=assets&detail=document');
});

test('project and identity boundaries start a fresh toolbar session', async () => {
  navigate('members');
  navigate('assets');
  startNavigationHistory('other-user:server:other-project');
  expect(getNavigationSnapshot()).toEqual({ canGoBack: false, canGoForward: false });
  goBack();
  expect(browser.location.search).toBe('?view=assets');
  navigate('chats');
  startNavigationHistory('other-user:server:other-project');
  expect(getNavigationSnapshot().canGoBack).toBe(true);
  await traverse(goBack);
  expect(browser.location.search).toBe('?view=assets');
  expect(getNavigationSnapshot()).toEqual({ canGoBack: false, canGoForward: true });
  // The native browser can leave this session; the app toolbar cannot follow it.
  await traverse(() => browser.history.back());
  expect(getNavigationSnapshot()).toEqual({ canGoBack: false, canGoForward: false });
  navigate('tasks');
  expect(getNavigationSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
});
