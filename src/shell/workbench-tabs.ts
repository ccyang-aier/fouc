import type { WorkbenchPage } from './workbench-pages';

export type TabTarget = { key: string; view: WorkbenchPage; search: string; conversationId?: string };
export type WorkbenchTab = TabTarget & { instance: number };
export type WorkbenchTabsState = { scope: string | null; tabs: WorkbenchTab[]; active: string; nextInstance: number };
export type TabCloseAction = 'current' | 'others' | 'right' | 'all';
export const workbenchTabId = (instance: number) => `workbench-tab-${instance}`;
export const workbenchPanelId = (instance: number) => `workbench-panel-${instance}`;

export function tabTarget(view: WorkbenchPage, search = ''): TabTarget {
  const params = new URLSearchParams(search);
  params.delete('returnView');
  params.delete('section');
  if (view === 'workbench') params.delete('view');
  else params.set('view', view);
  const conversationId = view === 'home' ? params.get('conversation') ?? undefined : undefined;
  if (!conversationId) params.delete('conversation');
  const query = params.toString();
  return { key: conversationId ? `chat:${conversationId}` : view, view, search: query ? `?${query}` : '', ...(conversationId ? { conversationId } : {}) };
}

export function createWorkbenchTabs(scope: string | null, target: TabTarget): WorkbenchTabsState {
  return { scope, tabs: [{ ...target, instance: 0 }], active: target.key, nextInstance: 1 };
}

export function openWorkbenchTab(state: WorkbenchTabsState, target: TabTarget): WorkbenchTabsState {
  const existing = state.tabs.find(tab => tab.key === target.key);
  if (existing && state.active === target.key && existing.search === target.search) return state;
  return {
    ...state,
    tabs: existing ? state.tabs.map(tab => tab.key === target.key ? { ...tab, ...target } : tab) : [...state.tabs, { ...target, instance: state.nextInstance }],
    active: target.key,
    nextInstance: state.nextInstance + Number(!existing),
  };
}

export function reorderWorkbenchTabs(state: WorkbenchTabsState, instances: readonly number[]): WorkbenchTabsState {
  const positions = new Map(instances.map((instance, index) => [instance, index]));
  const tabs = [...state.tabs].sort((a, b) => (positions.get(a.instance) ?? instances.length) - (positions.get(b.instance) ?? instances.length));
  return tabs.every((tab, index) => tab === state.tabs[index]) ? state : { ...state, tabs };
}

export function closeWorkbenchTab(state: WorkbenchTabsState, key: string, action: TabCloseAction = 'current'): WorkbenchTabsState {
  const index = state.tabs.findIndex(tab => tab.key === key);
  if (index < 0) return state;
  const tabs = state.tabs.filter((tab, position) => action === 'current' ? tab.key !== key : action === 'others' ? tab.key === key : action === 'right' ? position <= index : false);
  if (tabs.length === state.tabs.length) return state;
  if (!tabs.length) return { ...state, tabs: [{ ...tabTarget('home'), instance: state.nextInstance }], active: 'home', nextInstance: state.nextInstance + 1 };
  const activeIndex = state.tabs.findIndex(tab => tab.key === state.active);
  const neighbor = state.tabs.slice(0, activeIndex).reverse().find(tab => tabs.includes(tab)) ?? tabs[0];
  return { ...state, tabs, active: tabs.some(tab => tab.key === state.active) ? state.active : neighbor.key };
}

/** Promotion keeps the mounted draft/editor instance when its first message is sent. */
export function promoteConversationTab(state: WorkbenchTabsState, instance: number, conversationId: string): WorkbenchTabsState {
  const current = state.tabs.find(tab => tab.instance === instance);
  if (!current || current.conversationId === conversationId) return state;
  const params = new URLSearchParams(current.search);
  params.set('conversation', conversationId);
  const target = tabTarget('home', params.toString());
  return {
    ...state,
    tabs: state.tabs.filter(tab => tab.key !== target.key || tab.instance === instance).map(tab => tab.instance === instance ? { ...tab, ...target } : tab),
    active: state.active === current.key ? target.key : state.active,
  };
}
