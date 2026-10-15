"use client";

import { useSyncExternalStore } from "react";
import type { ChatSubmission } from "./chat-types";

export type ChatHistoryEntry = {
  id: string;
  submissions: ChatSubmission[];
  updatedAt: Date;
};

// The home conversation is a UI preview. Keep its history in this app session,
// without presenting it as a persisted device Agent session.
const emptyHistory: ChatHistoryEntry[] = [];
let history = emptyHistory;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function saveChatConversation(entry: ChatHistoryEntry) {
  history = [entry, ...history.filter((item) => item.id !== entry.id)];
  listeners.forEach((listener) => listener());
}

export function useChatHistory() {
  return useSyncExternalStore(subscribe, () => history, () => emptyHistory);
}
