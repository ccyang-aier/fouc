'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { pushWorkbenchLocation, replaceWorkbenchLocation } from '@/lib/navigation-history';
import { closeSettings } from '@/lib/settings-navigation';
import type { WorkbenchPage } from './workbench-pages';
import { closeWorkbenchTab, createWorkbenchTabs, openWorkbenchTab, promoteConversationTab, reorderWorkbenchTabs, tabTarget, type TabCloseAction, type WorkbenchTab, type WorkbenchTabsState } from './workbench-tabs';

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function useWorkbenchTabs(scope: string | null, view: WorkbenchPage, search: string, conversationIds: readonly string[]) {
  const ready = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const [initialized, setInitialized] = useState(ready);
  const requested = tabTarget(view, search);
  const unavailable = Boolean(requested.conversationId && !conversationIds.includes(requested.conversationId));
  const target = unavailable ? tabTarget('home') : requested;
  const [stored, setStored] = useState(() => createWorkbenchTabs(scope, target));
  // The SSR fallback route must not become a real tab after the URL hydrates.
  let remaining = stored.scope === scope && initialized === ready ? stored : createWorkbenchTabs(scope, target);
  if (initialized !== ready) setInitialized(ready);
  for (const tab of remaining.tabs) {
    if (tab.conversationId && !conversationIds.includes(tab.conversationId)) remaining = closeWorkbenchTab(remaining, tab.key);
  }
  const state = openWorkbenchTab(remaining, target);
  if (state !== stored) setStored(state);
  useEffect(() => {
    if (!unavailable) return;
    const url = new URL(window.location.href);
    url.search = target.search;
    replaceWorkbenchLocation(url);
  }, [unavailable, target.search]);

  function rememberLocation(current: WorkbenchTabsState) {
    return openWorkbenchTab(current, tabTarget(view, window.location.search));
  }
  function navigate(tab: WorkbenchTab, replace = false) {
    const url = new URL(window.location.href);
    url.search = tab.search;
    url.hash = '';
    if (replace) replaceWorkbenchLocation(url);
    else {
      if (new URLSearchParams(window.location.search).get('view') === 'settings') closeSettings();
      pushWorkbenchLocation(url);
    }
  }
  function commit(next: WorkbenchTabsState, replace = false) {
    // Re-selecting the current page also reveals its tab after manual scrolling.
    setStored(next === state ? { ...next, tabs: [...next.tabs] } : next);
    navigate(next.tabs.find(tab => tab.key === next.active)!, replace);
  }
  function open(view: WorkbenchPage, conversationId?: string) {
    const remembered = rememberLocation(state);
    const key = conversationId ? `chat:${conversationId}` : view;
    const existing = remembered.tabs.find(tab => tab.key === key);
    const next = existing ?? tabTarget(view, conversationId ? new URLSearchParams({ conversation: conversationId }).toString() : '');
    commit(openWorkbenchTab(remembered, next));
  }
  function activate(key: string) {
    const remembered = rememberLocation(state);
    const tab = remembered.tabs.find(tab => tab.key === key);
    if (tab) commit(openWorkbenchTab(remembered, tab));
  }
  function close(key: string, action: TabCloseAction = 'current') {
    const remembered = rememberLocation(state);
    const next = closeWorkbenchTab(remembered, key, action);
    const previous = remembered.tabs.find(tab => tab.key === remembered.active);
    const selected = next.tabs.find(tab => tab.key === next.active);
    if (previous?.instance !== selected?.instance) commit(next, true);
    else setStored(next);
  }
  function reorder(instances: number[]) {
    setStored(current => current.scope === scope ? reorderWorkbenchTabs(current, instances) : current);
  }
  function promote(instance: number, id: string) {
    const next = promoteConversationTab(state, instance, id);
    if (next.active !== state.active) commit(next, true);
    else setStored(next);
  }

  return { ...state, ready, open, activate, close, promote, reorder };
}
