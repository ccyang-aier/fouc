import type { WorkbenchPage } from './workbench-pages';

export type TabTarget = { key: string; view: WorkbenchPage; search: string; conversationId?: string };
export type WorkbenchTab = TabTarget & { instance: number };
export type WorkbenchTabsState = { scope: string | null; tabs: WorkbenchTab[]; active: string; nextInstance: number };
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

export function closeWorkbenchTab(state: WorkbenchTabsState, key: string): WorkbenchTabsState {
  const index = state.tabs.findIndex(tab => tab.key === key);
  if (index < 0) return state;
  const tabs = state.tabs.filter(tab => tab.key !== key);
  if (!tabs.length) return { ...state, tabs: [{ ...tabTarget('home'), instance: state.nextInstance }], active: 'home', nextInstance: state.nextInstance + 1 };
  return { ...state, tabs, active: state.active === key ? tabs[Math.max(0, index - 1)].key : state.active };
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
