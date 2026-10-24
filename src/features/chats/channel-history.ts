import type { ChannelMessage, ChannelMessagePage, ChannelSnapshot } from '@fouc/shared/chats';

export type ChannelHistory = { messages: ChannelMessage[]; loaded: boolean; hasMore: boolean };
export const emptyChannelHistory: ChannelHistory = { messages: [], loaded: false, hasMore: false };

export function compareChannelMessages(a: Pick<ChannelMessage, 'createdAt' | 'id'>, b: Pick<ChannelMessage, 'createdAt' | 'id'>): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** A current snapshot wins over overlapping earlier pages, including edits and reactions. */
export function mergeChannelMessages(earlier: readonly ChannelMessage[], latest: readonly ChannelMessage[]): ChannelMessage[] {
  const messages = new Map(earlier.map(message => [message.id, message]));
  for (const message of latest) messages.set(message.id, message);
  return [...messages.values()].sort(compareChannelMessages);
}

/** Keep messages that leave the live window; never resurrect deletions inside that window. */
export function retainChannelHistory(history: ChannelHistory, previous: ChannelSnapshot | undefined, next: ChannelSnapshot): ChannelHistory {
  if (!history.loaded) return history;
  const oldest = next.messages[0];
  if (!oldest || next.hasMoreMessages === false) return { loaded: true, messages: [], hasMore: false };
  const messages = mergeChannelMessages(history.messages, previous?.messages ?? [])
    .filter(message => compareChannelMessages(message, oldest) < 0);
  return { ...history, messages };
}

export function prependChannelPage(history: ChannelHistory, page: ChannelMessagePage): ChannelHistory {
  return { loaded: true, messages: mergeChannelMessages(history.messages, page.items), hasMore: page.hasMore };
}
