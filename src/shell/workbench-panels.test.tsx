import { afterAll, beforeAll, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act, useEffect, useState, type ReactNode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { indexedDB } from 'fake-indexeddb';
import { ProjectUiSession } from '@/lib/project-ui-session';
import { ProjectUiSessionContext, usePageSessionState } from '@/lib/page-session-state';
import { createWorkbenchStartup, createWorkbenchTabs, tabTarget } from './workbench-tabs';
import type { useWorkbenchTabs } from './use-workbench-tabs';
import type { useWorkbenchView } from './workbench-view';

let browser: Window;
let root: Root;
let host: HTMLDivElement;
let renderWorkspace: () => ReactNode;
let tabs: ReturnType<typeof useWorkbenchTabs>;
let route: ReturnType<typeof useWorkbenchView>;
let scope: string | null = '';
let chatIds: string[] = [];
let activeSession: ProjectUiSession | null = null;
let restorationReady = true;
let startupEntry: ReturnType<typeof createWorkbenchStartup> | undefined;
let serial = 0;
const mounts = new Map<string, number>();
const releases = new Map<string, number>();

function ExamplePage({ name }: { name: string }) {
  const [draft, setDraft] = usePageSessionState('draft', '');
  const [count, setCount] = useState(0);
  useEffect(() => {
    mounts.set(name, (mounts.get(name) ?? 0) + 1);
    return () => { releases.set(name, (releases.get(name) ?? 0) + 1); };
  }, [name]);
  return <div data-page={name}><input aria-label={`${name} draft`} value={draft} onInput={event => setDraft(event.currentTarget.value)} /><button onClick={() => setCount(value => value + 1)}>{count}</button><div data-scroll /></div>;
}

beforeAll(async () => {
  browser = new Window({ url: 'http://localhost:3000/?view=home' });
  const globals = globalThis as Record<string, unknown>;
  for (const name of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'ResizeObserver', 'MutationObserver']) globals[name] = (browser as unknown as Record<string, unknown>)[name];
  globals.window = browser;
  globals.indexedDB = indexedDB;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const icon = () => <svg />;
  mock.module('@phosphor-icons/react', () => Object.fromEntries(['Archive', 'BookOpenText', 'ChatCircleDots', 'ChatsCircle', 'ListChecks', 'Planet', 'PlugsConnected', 'Robot', 'SquaresFour', 'UsersThree', 'X'].map(name => [name, icon])));
  mock.module('@/features/project/project-resources', () => ({ useProjectResources: () => ({ scopeKey: scope, selectedProject: { id: 'project', name: 'Project' }, projects: [] }) }));
  mock.module('@/features/home/home-canvas', () => ({ HomeCanvas: () => <ExamplePage name="home" /> }));
  mock.module('@/features/community/community-canvas', () => ({ CommunityCanvas: () => <ExamplePage name="community" /> }));
  mock.module('@/features/connectors/connectors-canvas', () => ({ ConnectorsCanvas: () => <ExamplePage name="connectors" /> }));
  mock.module('@/features/knowledge/knowledge-page', () => ({ KnowledgePage: () => <ExamplePage name="knowledge" /> }));
  mock.module('@/features/project/dashboard/project-dashboard', () => ({ ProjectDashboard: () => <ExamplePage name="workbench" /> }));
  mock.module('@/features/project/project-workspace-pages', () => ({ ProjectChatsPage: () => null, ProjectEmptyPage: () => null, ProjectSelectionEmpty: () => null }));
  mock.module('@/features/settings/agent-settings', () => ({ AgentSettings: () => null }));
  const { WorkbenchPanels } = await import('./workbench-panels');
  const { useWorkbenchTabs } = await import('./use-workbench-tabs');
  const { useWorkbenchView } = await import('./workbench-view');
  function Workspace() {
    const view = useWorkbenchView(scope);
    const current = useWorkbenchTabs(scope, view[0], view[4], chatIds, restorationReady, startupEntry);
    useEffect(() => { tabs = current; route = view; });
    return current.ready ? <WorkbenchPanels tabs={current.tabs} active={current.active} history={[]} onNavigate={next => { if (next !== 'settings') current.open(next); }} onOpenChat={() => {}} onConversationStarted={current.promote} /> : null;
  }
  renderWorkspace = () => <ProjectUiSessionContext value={activeSession}><Workspace /></ProjectUiSessionContext>;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
beforeEach(async () => {
  await act(async () => root.render(null));
  browser.history.replaceState(null, '', '/?view=home');
  scope = `principal:local:project-${++serial}`;
  activeSession = null;
  restorationReady = true;
  startupEntry = undefined;
  chatIds = [];
  mounts.clear(); releases.clear();
  await act(async () => root.render(renderWorkspace()));
});
afterAll(async () => { await act(async () => root.unmount()); await browser.happyDOM.abort(); });

test('switching tabs preserves the actual DOM, draft, local state and scroll; closing releases just that page', async () => {
  const input = host.querySelector<HTMLInputElement>('input')!;
  const scroll = host.querySelector<HTMLElement>('[data-scroll]')!;
  await act(async () => { input.value = 'unfinished draft'; input.dispatchEvent(new Event('input', { bubbles: true })); host.querySelector('button')!.click(); });
  scroll.scrollTop = 120;
  await act(async () => tabs.open('community'));
  expect(host.querySelector('[data-page="home"]')!.closest('section')!.hidden).toBe(true);
  expect(host.querySelector('[data-page="home"]')!.closest('section')!.hasAttribute('inert')).toBe(true);
  expect(releases.get('home') ?? 0).toBe(0);
  await act(async () => tabs.open('home'));
  expect(host.querySelector('input')).toBe(input);
  expect(input.value).toBe('unfinished draft');
  expect(host.querySelector('button')!.textContent).toBe('1');
  expect(scroll.scrollTop).toBe(120);
  expect(mounts.get('home')).toBe(1);
  expect(host.querySelectorAll('section[role="tabpanel"]:not([hidden])')).toHaveLength(1);
  await act(async () => tabs.close('community'));
  expect(releases.get('community')).toBe(1);
  expect(releases.get('home') ?? 0).toBe(0);
  await act(async () => tabs.close('home'));
  expect(host.querySelector('input')).not.toBe(input);
  expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('');
});

test('history and settings select existing tabs, while project or identity changes release every old page', async () => {
  await act(async () => tabs.open('community'));
  await act(async () => tabs.open('connectors'));
  await act(async () => {
    await new Promise<void>(resolve => { browser.addEventListener('popstate', () => resolve(), { once: true }); route[3].goBack(); });
  });
  expect(tabs.active).toBe('community');
  expect(tabs.tabs).toHaveLength(3);
  await act(async () => route[1]('settings'));
  expect(tabs.active).toBe('community');
  expect(tabs.tabs).toHaveLength(3);
  await act(async () => tabs.open('connectors'));
  expect(route[2]).toBe(false);
  await act(async () => {
    await new Promise<void>(resolve => { browser.addEventListener('popstate', () => resolve(), { once: true }); route[3].goBack(); });
  });
  expect(tabs.active).toBe('community');
  expect(route[2]).toBe(false);
  scope = 'another-principal:server:project';
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.tabs).toHaveLength(1);
  expect(releases.get('home')).toBe(1);
  expect(releases.get('connectors')).toBe(1);
  expect(releases.get('community')).toBe(1);
  expect(mounts.get('community')).toBe(1);
  expect(tabs.active).toBe('workbench');
});

test('conversation promotion keeps its editor, and deleting a conversation removes its tab and URL', async () => {
  const input = host.querySelector('input');
  const instance = tabs.tabs[0].instance;
  chatIds = ['saved-chat'];
  await act(async () => root.render(renderWorkspace()));
  await act(async () => tabs.promote(instance, 'saved-chat'));
  expect(tabs.active).toBe('chat:saved-chat');
  expect(host.querySelector('input')).toBe(input);
  expect(browser.location.search).toContain('conversation=saved-chat');
  await act(async () => tabs.open('home'));
  expect(tabs.tabs).toHaveLength(2);
  await act(async () => tabs.activate('chat:saved-chat'));
  chatIds = [];
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('home');
  expect(tabs.tabs).toHaveLength(1);
  expect(browser.location.search).not.toContain('conversation');
});

test('drag order and bulk closing preserve retained page DOM and drafts without changing unrelated navigation', async () => {
  const home = host.querySelector<HTMLInputElement>('input')!;
  await act(async () => { home.value = 'keep this draft'; home.dispatchEvent(new Event('input', { bubbles: true })); tabs.open('community'); });
  const community = host.querySelector<HTMLInputElement>('[data-page="community"] input')!;
  const scroll = host.querySelector<HTMLElement>('[data-page="community"] [data-scroll]')!;
  scroll.scrollTop = 240;
  await act(async () => tabs.open('connectors'));
  const connector = host.querySelector('[data-page="connectors"] input');
  const [homeTab, communityTab, connectorTab] = tabs.tabs;
  const panels = [...host.querySelectorAll('[role="tabpanel"]')];
  const url = browser.location.href;
  await act(async () => tabs.reorder([connectorTab.instance, homeTab.instance, communityTab.instance]));
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['connectors', 'home', 'community']);
  expect([...host.querySelectorAll('[role="tabpanel"]')]).toEqual(panels);
  expect(browser.location.href).toBe(url);
  expect(host.querySelector('[data-page="home"] input')).toBe(home);
  expect(host.querySelector('[data-page="community"] input')).toBe(community);
  expect(host.querySelector('[data-page="connectors"] input')).toBe(connector);
  expect(scroll.scrollTop).toBe(240);
  expect([...releases.values()]).toEqual([]);
  await act(async () => tabs.close('home', 'right'));
  expect(tabs.active).toBe('connectors');
  expect(browser.location.href).toBe(url);
  expect(releases.get('community')).toBe(1);
  expect(host.querySelector('[data-page="home"] input')).toBe(home);
  await act(async () => tabs.close('home', 'others'));
  expect(tabs.active).toBe('home');
  expect(host.querySelector('input')).toBe(home);
  expect(home.value).toBe('keep this draft');
  expect(mounts.get('home')).toBe(1);
  expect(releases.get('connectors')).toBe(1);
  await act(async () => tabs.close('home', 'all'));
  expect(tabs.tabs).toHaveLength(1);
  expect(host.querySelector('input')).not.toBe(home);
  expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('');
});

test('hydration opens only the requested URL when there is no selected project', async () => {
  await act(async () => root.unmount());
  scope = null;
  browser.history.replaceState(null, '', '/?view=knowledge');
  host.innerHTML = renderToString(renderWorkspace());
  await act(async () => { root = hydrateRoot(host, renderWorkspace()); });
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['knowledge']);
  expect(tabs.active).toBe('knowledge');
});

test('reloads and project returns restore the ordered tabs, active page and drafts; explicit links take priority', async () => {
  await act(async () => root.render(null));
  const firstScope = scope!;
  activeSession = new ProjectUiSession(firstScope);
  await activeSession.loaded;
  await act(async () => root.render(renderWorkspace()));
  const home = host.querySelector<HTMLInputElement>('input')!;
  await act(async () => { home.value = 'saved across reopen'; home.dispatchEvent(new Event('input', { bubbles: true })); tabs.open('community'); });
  await act(async () => tabs.open('connectors'));
  const [homeTab, communityTab, connectorTab] = tabs.tabs;
  await act(async () => tabs.reorder([connectorTab.instance, homeTab.instance, communityTab.instance]));
  await act(async () => tabs.activate('community'));
  await act(async () => root.render(null));
  browser.history.replaceState(null, '', '/');
  activeSession = new ProjectUiSession(firstScope);
  await activeSession.loaded;
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['connectors', 'home', 'community']);
  expect(tabs.active).toBe('community');
  expect(browser.location.search).toBe('?view=community');
  expect(host.querySelector<HTMLInputElement>('[data-page="home"] input')!.value).toBe('saved across reopen');
  const second = new ProjectUiSession('principal:server:other-project');
  await second.loaded;
  scope = second.scope; activeSession = second;
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('workbench');
  await act(async () => tabs.open('knowledge'));
  scope = firstScope; activeSession = new ProjectUiSession(firstScope);
  await activeSession.loaded;
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('community');
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['connectors', 'home', 'community']);
  expect(host.querySelector<HTMLInputElement>('[data-page="home"] input')!.value).toBe('saved across reopen');
  scope = second.scope; activeSession = new ProjectUiSession(second.scope);
  await activeSession.loaded;
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('knowledge');
  await act(async () => root.render(null));
  scope = firstScope; activeSession = new ProjectUiSession(firstScope);
  await activeSession.loaded;
  browser.history.replaceState(null, '', '/?view=knowledge');
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('knowledge');
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['connectors', 'home', 'community', 'knowledge']);
});

test('identity checking cannot rewrite the startup URL or expose guest pages before the account restores', async () => {
  await act(async () => root.render(null));
  const guest = new ProjectUiSession('guest:local:startup');
  const user = new ProjectUiSession('user:local:startup');
  await Promise.all([guest.loaded, user.loaded]);
  guest.set('tabs', createWorkbenchTabs(guest.scope, tabTarget('community')), null);
  user.set('tabs', createWorkbenchTabs(user.scope, tabTarget('connectors')), null);
  scope = guest.scope; activeSession = guest; restorationReady = false; startupEntry = createWorkbenchStartup();
  browser.history.replaceState(null, '', '/');
  await act(async () => root.render(renderWorkspace()));
  expect(browser.location.search).toBe('');
  expect(host.querySelector('[role="tabpanel"]')).toBeNull();
  // ProjectResourceProvider remounts its children when the principal resolves.
  await act(async () => root.render(null));
  scope = user.scope; activeSession = user; restorationReady = true;
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('connectors');
  expect(browser.location.search).toBe('?view=connectors');
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['connectors']);
  expect(startupEntry.isConsumed()).toBe(true);
  await act(async () => root.render(null));
  scope = guest.scope; activeSession = guest;
  await act(async () => root.render(renderWorkspace()));
  expect(tabs.active).toBe('community');
  expect(tabs.tabs.map(tab => tab.key)).toEqual(['community']);
  expect(user.get<ReturnType<typeof createWorkbenchTabs> | null>('tabs', null)!.active).toBe('connectors');
});
