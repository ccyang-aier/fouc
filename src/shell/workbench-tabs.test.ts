import { expect, test } from 'bun:test';
import { addWorkbenchTab, closeWorkbenchTab, createWorkbenchTabs, openWorkbenchTab, pinWorkbenchTab, promoteConversationTab, reloadWorkbenchTab, reorderWorkbenchTabs, restoreWorkbenchTabs, tabTarget } from './workbench-tabs';

test('menus reuse existing tabs without changing their instances or opening settings', () => {
  let state = createWorkbenchTabs('user:local:a', tabTarget('home'));
  state = openWorkbenchTab(state, tabTarget('connectors'));
  const instance = state.tabs[1].instance;
  state = openWorkbenchTab(state, tabTarget('home'));
  state = openWorkbenchTab(state, tabTarget('connectors', '?view=settings&returnView=connectors&section=general'));
  expect(state.tabs.map(tab => tab.key)).toEqual(['home', 'connectors']);
  expect(state.tabs[1].instance).toBe(instance);
  expect(state.tabs[1].search).toBe('?view=connectors');
  expect(state.active).toBe('connectors');
});

test('closing inactive and active tabs selects a neighbor; the last tab becomes a fresh draft', () => {
  let state = createWorkbenchTabs('scope', tabTarget('home'));
  state = openWorkbenchTab(state, tabTarget('members'));
  state = openWorkbenchTab(state, tabTarget('assets'));
  state = closeWorkbenchTab(state, 'members');
  expect(state.active).toBe('assets');
  state = closeWorkbenchTab(state, 'assets');
  expect(state.active).toBe('home');
  const original = state.tabs[0].instance;
  state = closeWorkbenchTab(state, 'home');
  expect(state.tabs).toHaveLength(1);
  expect(state.active).toBe('home');
  expect(state.tabs[0].instance).not.toBe(original);
});

test('the first message promotes a draft in place and distinct conversations have distinct tabs', () => {
  let state = createWorkbenchTabs('scope', tabTarget('home'));
  const draftInstance = state.tabs[0].instance;
  state = promoteConversationTab(state, draftInstance, 'chat-a');
  expect(state.active).toBe('chat:chat-a');
  expect(state.tabs[0].instance).toBe(draftInstance);
  expect(state.tabs[0].search).toBe('?view=home&conversation=chat-a');
  state = openWorkbenchTab(state, tabTarget('home'));
  state = openWorkbenchTab(state, tabTarget('home', '?conversation=chat-b'));
  expect(state.tabs.map(tab => tab.key)).toEqual(['chat:chat-a', 'home', 'chat:chat-b']);
  expect(tabTarget('knowledge', '?view=home&conversation=chat-a').conversationId).toBeUndefined();
});

test('reordering retains instances and selection, and bulk closes use the displayed order and target tab', () => {
  let state = createWorkbenchTabs('scope', tabTarget('home'));
  for (const page of ['community', 'connectors', 'knowledge'] as const) state = openWorkbenchTab(state, tabTarget(page));
  const [home, community, connectors, knowledge] = state.tabs;
  state = reorderWorkbenchTabs(state, [knowledge.instance, home.instance, connectors.instance, community.instance]);
  expect(state.tabs).toEqual([knowledge, home, connectors, community]);
  expect(state.tabs[0]).toBe(knowledge);
  expect(state.active).toBe('knowledge');
  expect(reorderWorkbenchTabs(state, state.tabs.map(tab => tab.instance))).toBe(state);
  const others = closeWorkbenchTab(state, 'connectors', 'others');
  expect(others.tabs).toEqual([connectors]);
  expect(others.tabs[0]).toBe(connectors);
  expect(others.active).toBe('connectors');
  const all = closeWorkbenchTab(state, 'connectors', 'all');
  expect(all.tabs.map(tab => tab.key)).toEqual(['home']);
  expect(all.tabs[0].instance).toBe(state.nextInstance);
  expect(all.active).toBe('home');
});

test('fresh and duplicate tabs have independent identities, while sidebar and history reuse the intended page', () => {
  let state = createWorkbenchTabs('scope', tabTarget('home'));
  state = addWorkbenchTab(state, state.tabs[0], 'home');
  const copy = state.tabs[1];
  expect(copy.key).not.toBe('home');
  expect(copy.search).toContain('tab=');
  expect(openWorkbenchTab(state, tabTarget('home')).active).toBe(copy.key);
  state = addWorkbenchTab(state, tabTarget('home'));
  expect(new Set(state.tabs.map(tab => tab.instance)).size).toBe(3);
  state = openWorkbenchTab(state, copy);
  expect(state.active).toBe(copy.key);
  expect(state.tabs).toHaveLength(3);
  state = promoteConversationTab(state, copy.instance, 'message');
  const conversation = state.tabs.find(tab => tab.instance === copy.instance)!;
  state = addWorkbenchTab(state, conversation, conversation.key);
  const restored = restoreWorkbenchTabs('scope', structuredClone(state))!;
  expect(restored.tabs.filter(tab => tab.conversationId === 'message')).toHaveLength(2);
  expect(restored.active).toBe(state.active);
  expect(openWorkbenchTab(restored, restored.tabs.find(tab => tab.key === restored.active)!).tabs).toHaveLength(4);
});

test('pinning keeps a stable left group through dragging and restoration; reload affects only its target', () => {
  let state = createWorkbenchTabs('scope', tabTarget('home'));
  state = openWorkbenchTab(state, tabTarget('community'));
  state = openWorkbenchTab(state, tabTarget('connectors'));
  state = pinWorkbenchTab(state, 'connectors');
  expect(state.tabs.map(tab => tab.key)).toEqual(['connectors', 'home', 'community']);
  const copyOfPinned = addWorkbenchTab(state, state.tabs[0], 'connectors');
  expect(Boolean(copyOfPinned.tabs.find(tab => tab.key === copyOfPinned.active)!.pinned)).toBe(false);
  expect(copyOfPinned.tabs[0].key).toBe('connectors');
  state = reorderWorkbenchTabs(state, [1, 0, 2]);
  expect(state.tabs.map(tab => tab.key)).toEqual(['connectors', 'community', 'home']);
  const home = state.tabs[2];
  const reloaded = reloadWorkbenchTab(state, 'community');
  expect(reloaded.tabs.find(tab => tab.key === 'community')!.revision).toBe(1);
  expect(reloaded.tabs[2]).toBe(home);
  expect(reloaded.active).toBe(state.active);
  state = restoreWorkbenchTabs('scope', reloaded)!;
  expect(state.tabs[0].pinned).toBe(true);
  expect(state.tabs[1].revision).toBe(1);
  state = pinWorkbenchTab(state, 'connectors');
  expect(state.tabs[0].pinned).toBe(false);
  expect(closeWorkbenchTab(state, 'connectors', 'others').tabs).toHaveLength(1);
  expect(closeWorkbenchTab(state, 'connectors', 'all').tabs[0].conversationId).toBeUndefined();
});

test('restoring validates scope and page targets while retaining order, selection and instance sequence', () => {
  let state = createWorkbenchTabs('alice:local:a', tabTarget('home'));
  state = openWorkbenchTab(state, tabTarget('knowledge', '?view=knowledge&kb=example'));
  state = reorderWorkbenchTabs(state, [1, 0]);
  const restored = restoreWorkbenchTabs(state.scope, structuredClone(state))!;
  expect(restored.tabs.map(tab => tab.key)).toEqual(['knowledge', 'home']);
  expect(restored.active).toBe('knowledge');
  expect(restored.nextInstance).toBe(2);
  expect(restoreWorkbenchTabs('alice:server:a', state)).toBeNull();
  expect(restoreWorkbenchTabs('bob:local:a', state)).toBeNull();
  expect(restoreWorkbenchTabs(state.scope, { ...state, tabs: [{ view: 'settings', instance: 4, search: '?view=settings' }] })).toBeNull();
});
