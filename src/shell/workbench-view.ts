'use client';

import { useSyncExternalStore } from 'react';
import type { WorkbenchView } from './navigation-sidebar';
import { WORKBENCH_VIEW_CHANGED } from '@/lib/editor-settings-navigation';

const views: readonly WorkbenchView[] = ['home', 'settings', 'help', 'project-home', 'projects', 'community', 'automation', 'knowledge', 'connectors'];
const viewChanged = WORKBENCH_VIEW_CHANGED;
function readView(): WorkbenchView {
  const value = new URLSearchParams(window.location.search).get('view');
  return views.includes(value as WorkbenchView) ? value as WorkbenchView : 'home';
}
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(viewChanged, listener);
  return () => { window.removeEventListener('popstate', listener); window.removeEventListener(viewChanged, listener); };
}
export function useWorkbenchView() {
  const view = useSyncExternalStore(subscribe, readView, () => 'home' as WorkbenchView);
  return [view, (next: WorkbenchView) => {
    const url = new URL(window.location.href);
    if (next === 'home') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    if (next !== 'settings') { url.searchParams.delete('section'); url.searchParams.delete('returnView'); }
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(viewChanged));
  }] as const;
}
