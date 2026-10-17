'use client';

import { WORKBENCH_VIEW_CHANGED } from '@/lib/settings-navigation';

export function openSkillsMarket() {
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'community');
  url.searchParams.set('communityType', 'skills');
  url.searchParams.delete('section');
  url.searchParams.delete('returnView');
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new Event(WORKBENCH_VIEW_CHANGED));
}
