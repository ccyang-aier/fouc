import { expect, test } from 'bun:test';
import { closeWorkbenchTab, createWorkbenchTabs, openWorkbenchTab, promoteConversationTab, tabTarget } from './workbench-tabs';

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
