'use client';

export const CHANNEL_NAVIGATION = 'fouc:channel-navigation';
type ChannelNavigation = { scope: string; channelId: string | null; create: boolean; mode?: 'settings' | 'delete'; revision: number };
let intent: ChannelNavigation | null = null;
let revision = 0;
const listeners = new Set<() => void>();
export function requestChannelOpen(scope: string, channelId: string | null = null, create = false, mode?: 'settings' | 'delete') {
  intent = { scope, channelId, create, mode, revision: ++revision };
  listeners.forEach(listener => listener());
  window.dispatchEvent(new Event(CHANNEL_NAVIGATION));
}
export const channelNavigation = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => intent,
  getServerSnapshot: () => null,
  consume(revision: number) {
    if (intent?.revision !== revision) return;
    intent = null;
    listeners.forEach(listener => listener());
  },
};
