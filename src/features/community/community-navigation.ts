'use client';

import { pushWorkbenchLocation, replaceWorkbenchLocation } from '@/lib/navigation-history';
export const COMMUNITY_SKILLS_REQUESTED = 'fouc:community-skills-requested';

export function openSkillsMarket() {
  const url = new URL(window.location.href);
  const fromSettings = url.searchParams.get('view') === 'settings';
  url.searchParams.set('view', 'community');
  url.searchParams.set('communityType', 'skills');
  url.searchParams.delete('section');
  url.searchParams.delete('returnView');
  if (fromSettings) replaceWorkbenchLocation(url);
  else pushWorkbenchLocation(url);
  window.dispatchEvent(new Event(COMMUNITY_SKILLS_REQUESTED));
}
