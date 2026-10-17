"use client";

import { useSyncExternalStore } from "react";
import type { ChatSubmission } from "./chat-types";
import { useProjectResources } from '@/features/project/project-resources';

export type ChatHistoryEntry = {
  id: string;
  submissions: ChatSubmission[];
  updatedAt: Date;
  title?: string;
  pinned?: boolean;
};

// The home conversation is a UI preview. Keep its history in this app session,
// without presenting it as a persisted device Agent session.
const emptyHistory: ChatHistoryEntry[] = [];
const histories = new Map<string, ChatHistoryEntry[]>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function saveChatConversation(scopeKey: string, entry: ChatHistoryEntry) {
  const history = histories.get(scopeKey) ?? emptyHistory;
  const previous = history.find(item => item.id === entry.id);
  publish(scopeKey, [{ ...entry, title: previous?.title ?? entry.title, pinned: previous?.pinned ?? entry.pinned }, ...history.filter((item) => item.id !== entry.id)]);
}

function publish(scopeKey: string, entries: ChatHistoryEntry[]) {
  histories.set(scopeKey, entries.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.getTime() - a.updatedAt.getTime()));
  listeners.forEach((listener) => listener());
}

export function chatConversationTitle(entry: ChatHistoryEntry) {
  const first = entry.submissions[0];
  return entry.title ?? first?.attachments[0]?.file.name ?? first?.text ?? '';
}

export function renameChatConversation(scopeKey: string, id: string, title: string) {
  if (!title.trim()) return;
  publish(scopeKey, (histories.get(scopeKey) ?? emptyHistory).map(entry => entry.id === id ? { ...entry, title: title.trim() } : entry));
}

export function pinChatConversation(scopeKey: string, id: string, pinned: boolean) {
  publish(scopeKey, (histories.get(scopeKey) ?? emptyHistory).map(entry => entry.id === id ? { ...entry, pinned } : entry));
}

export function deleteChatConversation(scopeKey: string, id: string) {
  publish(scopeKey, (histories.get(scopeKey) ?? emptyHistory).filter(entry => entry.id !== id));
}

export function useChatHistory() {
  const { scopeKey } = useProjectResources();
  return useSyncExternalStore(subscribe, () => scopeKey ? histories.get(scopeKey) ?? emptyHistory : emptyHistory, () => emptyHistory);
}
