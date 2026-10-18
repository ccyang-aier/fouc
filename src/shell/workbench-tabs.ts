import type { WorkbenchPage } from './workbench-pages';
import { workbenchPages } from './workbench-pages';

/** Target keys group routes; tab keys identify independent views of those routes. */
export type TabTarget = { key: string; view: WorkbenchPage; search: string; conversationId?: string };
export type WorkbenchTab = TabTarget & { instance: number; pinned?: boolean; revision?: number };
export type WorkbenchTabsState = { scope: string | null; tabs: WorkbenchTab[]; active: string; nextInstance: number };
export type TabCloseAction = 'current' | 'others' | 'all';
export type TabAction = TabCloseAction | 'pin' | 'reload' | 'duplicate';
export const newWorkbenchPages: readonly WorkbenchPage[] = ['home'];
export const workbenchTabId = (instance: number) => `workbench-tab-${instance}`;
export const workbenchPanelId = (instance: number) => `workbench-panel-${instance}`;

export function createWorkbenchStartup() {
  let consumed = false;
  return { isConsumed: () => consumed, consume: () => { consumed = true; } };
}

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
  return { scope, tabs: [identifyTab(target, target.key, 0)], active: target.key, nextInstance: 1 };
}

function identifyTab(target: TabTarget, key: string, instance: number): WorkbenchTab {
  const params = new URLSearchParams(target.search);
  if (key === tabTarget(target.view, target.search).key) params.delete('tab');
  else params.set('tab', key);
  const query = params.toString();
  return { key, view: target.view, instance, search: query ? `?${query}` : '', ...(target.conversationId ? { conversationId: target.conversationId } : {}) };
}

function pinnedFirst(tabs: WorkbenchTab[]) {
  return tabs.toSorted((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
}

export function findWorkbenchTab(state: WorkbenchTabsState, target: TabTarget) {
  const matches = state.tabs.filter(tab => tab.view === target.view && tab.conversationId === target.conversationId);
  const requested = new URLSearchParams(target.search).get('tab');
  return matches.find(tab => tab.key === requested) ?? matches.find(tab => tab.key === state.active) ?? matches[0];
}

export function restoreWorkbenchTabs(scope: string | null, value: unknown): WorkbenchTabsState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<WorkbenchTabsState>;
  if (raw.scope !== scope || !Array.isArray(raw.tabs)) return null;
  const tabs: WorkbenchTab[] = [];
  for (const item of raw.tabs) {
    if (!item || !Object.hasOwn(workbenchPages, item.view) || typeof item.key !== 'string' || !item.key || typeof item.search !== 'string' || !Number.isSafeInteger(item.instance) || item.instance < 0) continue;
    const target = tabTarget(item.view, item.search);
    if (!tabs.some(tab => tab.key === item.key || tab.instance === item.instance)) tabs.push({ ...identifyTab(target, item.key, item.instance), pinned: Boolean(item.pinned), revision: Number.isSafeInteger(item.revision) && item.revision! >= 0 ? item.revision : 0 });
  }
  if (!tabs.length) return null;
  const nextInstance = Math.max(...tabs.map(tab => tab.instance)) + 1;
  return { scope, tabs: pinnedFirst(tabs), active: tabs.some(tab => tab.key === raw.active) ? raw.active! : tabs[0].key, nextInstance: Math.max(nextInstance, Number.isSafeInteger(raw.nextInstance) ? raw.nextInstance! : 0) };
}

export function openWorkbenchTab(state: WorkbenchTabsState, target: TabTarget): WorkbenchTabsState {
  const existing = findWorkbenchTab(state, target);
  const next = identifyTab(target, existing?.key ?? target.key, existing?.instance ?? state.nextInstance);
  if (existing && state.active === existing.key && existing.search === next.search) return state;
  return {
    ...state,
    tabs: existing ? state.tabs.map(tab => tab === existing ? { ...tab, ...next } : tab) : [...state.tabs, next],
    active: next.key,
    nextInstance: state.nextInstance + Number(!existing),
  };
}

/** New and duplicate actions deliberately bypass sidebar target reuse. */
export function addWorkbenchTab(state: WorkbenchTabsState, target: TabTarget, afterKey?: string): WorkbenchTabsState {
  const key = state.tabs.some(tab => tab.key === target.key) ? `tab:${state.nextInstance}` : target.key;
  const tab = identifyTab(target, key, state.nextInstance);
  const tabs = [...state.tabs];
  const index = afterKey ? tabs.findIndex(item => item.key === afterKey) : -1;
  tabs.splice(index >= 0 ? index + 1 : tabs.length, 0, tab);
  return { ...state, tabs: pinnedFirst(tabs), active: tab.key, nextInstance: state.nextInstance + 1 };
}

export function pinWorkbenchTab(state: WorkbenchTabsState, key: string): WorkbenchTabsState {
  return { ...state, tabs: pinnedFirst(state.tabs.map(tab => tab.key === key ? { ...tab, pinned: !tab.pinned } : tab)) };
}

export function reloadWorkbenchTab(state: WorkbenchTabsState, key: string): WorkbenchTabsState {
  return { ...state, tabs: state.tabs.map(tab => tab.key === key ? { ...tab, revision: (tab.revision ?? 0) + 1 } : tab) };
}

export function reorderWorkbenchTabs(state: WorkbenchTabsState, instances: readonly number[]): WorkbenchTabsState {
  const positions = new Map(instances.map((instance, index) => [instance, index]));
  const tabs = pinnedFirst([...state.tabs].sort((a, b) => (positions.get(a.instance) ?? instances.length) - (positions.get(b.instance) ?? instances.length)));
  return tabs.every((tab, index) => tab === state.tabs[index]) ? state : { ...state, tabs };
}

export function closeWorkbenchTab(state: WorkbenchTabsState, key: string, action: TabCloseAction = 'current'): WorkbenchTabsState {
  const index = state.tabs.findIndex(tab => tab.key === key);
  if (index < 0) return state;
  const tabs = state.tabs.filter(tab => action === 'current' ? tab.key !== key : action === 'others' ? tab.key === key : false);
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
  const key = state.tabs.some(tab => tab.key === target.key && tab.instance !== instance) ? `tab:${instance}` : target.key;
  return {
    ...state,
    tabs: state.tabs.map(tab => tab.instance === instance ? { ...tab, ...identifyTab(target, key, instance) } : tab),
    active: state.active === current.key ? key : state.active,
  };
}
