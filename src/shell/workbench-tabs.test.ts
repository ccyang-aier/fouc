import { expect, test } from 'bun:test';
import { closeWorkbenchTab, createWorkbenchTabs, openWorkbenchTab, promoteConversationTab, reorderWorkbenchTabs, tabTarget } from './workbench-tabs';

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
  const right = closeWorkbenchTab(state, 'home', 'right');
  expect(right.tabs).toEqual([knowledge, home]);
  expect(right.active).toBe('knowledge');
  expect(closeWorkbenchTab(right, 'home', 'right')).toBe(right);
  const others = closeWorkbenchTab(state, 'connectors', 'others');
  expect(others.tabs).toEqual([connectors]);
  expect(others.tabs[0]).toBe(connectors);
  expect(others.active).toBe('connectors');
  const selectedRight = closeWorkbenchTab({ ...state, active: 'community' }, 'home', 'right');
  expect(selectedRight.active).toBe('home');
  const all = closeWorkbenchTab(state, 'connectors', 'all');
  expect(all.tabs.map(tab => tab.key)).toEqual(['home']);
  expect(all.tabs[0].instance).toBe(state.nextInstance);
  expect(all.active).toBe('home');
});
