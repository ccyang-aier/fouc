'use client';

import { useSyncExternalStore } from 'react';
import type { SettingsSection } from '@/features/settings/settings-canvas';

export const WORKBENCH_VIEW_CHANGED = 'fouc:view-changed';
function notify() {
  window.dispatchEvent(new Event(WORKBENCH_VIEW_CHANGED));
}

export function openSettings(section: SettingsSection = 'general') {
  const url = new URL(window.location.href);
  if (url.searchParams.get('view') !== 'settings') {
    url.searchParams.set('returnView', url.searchParams.get('view') ?? 'workbench');
  }
  url.searchParams.set('view', 'settings');
  url.searchParams.set('section', section);
  window.history.replaceState(null, '', url);
  notify();
}

export function setSettingsSection(section: SettingsSection) {
  const url = new URL(window.location.href);
  url.searchParams.set('section', section);
  window.history.replaceState(null, '', url);
  notify();
}

export function closeSettings() {
  const url = new URL(window.location.href);
  const target = url.searchParams.get('returnView');
  if (target && target !== 'workbench' && target !== 'settings') url.searchParams.set('view', target);
  else url.searchParams.delete('view');
  url.searchParams.delete('returnView');
  url.searchParams.delete('section');
  window.history.replaceState(null, '', url);
  notify();
}

function readSection(): SettingsSection {
  const section = new URLSearchParams(window.location.search).get('section');
  return ['appearance', 'general', 'agents', 'skills', 'about'].includes(section ?? '')
    ? (section as SettingsSection)
    : 'appearance';
}
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener(WORKBENCH_VIEW_CHANGED, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(WORKBENCH_VIEW_CHANGED, listener);
  };
}
export function useSettingsSection() {
  return useSyncExternalStore(subscribe, readSection, () => 'appearance' as SettingsSection);
}
