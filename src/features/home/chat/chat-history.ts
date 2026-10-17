"use client";

import { useSyncExternalStore } from "react";
import type { ChatSubmission } from "./chat-types";
import { useProjectResources } from '@/features/project/project-resources';

export type ChatHistoryEntry = {
  id: string;
  submissions: ChatSubmission[];
  updatedAt: Date;
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
  histories.set(scopeKey, [entry, ...history.filter((item) => item.id !== entry.id)]);
  listeners.forEach((listener) => listener());
}

export function useChatHistory() {
  const { scopeKey } = useProjectResources();
  return useSyncExternalStore(subscribe, () => scopeKey ? histories.get(scopeKey) ?? emptyHistory : emptyHistory, () => emptyHistory);
}
