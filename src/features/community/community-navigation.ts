'use client';

import { pushWorkbenchLocation, replaceWorkbenchLocation } from '@/lib/navigation-history';

export function openSkillsMarket() {
  const url = new URL(window.location.href);
  const fromSettings = url.searchParams.get('view') === 'settings';
  url.searchParams.set('view', 'community');
  url.searchParams.set('communityType', 'skills');
  url.searchParams.delete('section');
  url.searchParams.delete('returnView');
  if (fromSettings) replaceWorkbenchLocation(url);
  else pushWorkbenchLocation(url);
}
