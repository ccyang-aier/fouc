"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getProjectUiSession } from '@/lib/project-ui-session';
import type { ChatSubmission } from "./chat-types";
import { useProjectResources } from '@/features/project/project-resources';
import { useIdentity } from '@/features/identity/identity-provider';

export type ChatHistoryEntry = {
  id: string;
  submissions: ChatSubmission[];
  updatedAt: Date;
  title?: string;
  pinned?: boolean;
};

// Durable local previews remain distinct from real device Agent sessions.
const emptyHistory: ChatHistoryEntry[] = [];
const historyKey = 'chat.history';
const subscribeEmpty = () => () => {};

export function saveChatConversation(scopeKey: string, entry: ChatHistoryEntry) {
  publish(scopeKey, history => {
    const previous = history.find(item => item.id === entry.id);
    return [{ ...entry, title: previous?.title ?? entry.title, pinned: previous?.pinned ?? entry.pinned }, ...history.filter(item => item.id !== entry.id)];
  });
}

function publish(scopeKey: string, change: (entries: ChatHistoryEntry[]) => ChatHistoryEntry[]) {
  getProjectUiSession(scopeKey).set<ChatHistoryEntry[]>(historyKey, entries => change(entries).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.getTime() - a.updatedAt.getTime()), emptyHistory);
}

export function chatConversationTitle(entry: ChatHistoryEntry) {
  const first = entry.submissions[0];
  return entry.title ?? first?.attachments[0]?.file.name ?? first?.text ?? '';
}

export function renameChatConversation(scopeKey: string, id: string, title: string) {
  if (!title.trim()) return;
  publish(scopeKey, entries => entries.map(entry => entry.id === id ? { ...entry, title: title.trim() } : entry));
}

export function pinChatConversation(scopeKey: string, id: string, pinned: boolean) {
  publish(scopeKey, entries => entries.map(entry => entry.id === id ? { ...entry, pinned } : entry));
}

export function deleteChatConversation(scopeKey: string, id: string) {
  publish(scopeKey, entries => entries.filter(entry => entry.id !== id));
}

export function useChatHistory() {
  const { scopeKey } = useProjectResources();
  const { session: identity } = useIdentity();
  const checking = identity.status === 'checking';
  const session = useMemo(() => scopeKey && !checking ? getProjectUiSession(scopeKey) : null, [scopeKey, checking]);
  return useSyncExternalStore(session?.subscribe ?? subscribeEmpty, () => session?.get(historyKey, emptyHistory) ?? emptyHistory, () => emptyHistory);
}
