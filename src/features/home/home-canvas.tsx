"use client";

import { useTranslation } from "@/lib/i18n/react";
import { chatMessages } from "./chat/chat-messages";
import { HomeChat } from "./chat/home-chat";
import type { ChatHistoryEntry } from './chat/chat-history';

export function HomeCanvas({ onOpenConnectors, conversation, onOpenConversation, onNewConversation, onConversationStarted }: {
  onOpenConnectors: () => void; conversation?: ChatHistoryEntry;
  onOpenConversation?: (entry: ChatHistoryEntry) => void; onNewConversation?: () => void; onConversationStarted?: (id: string) => void;
}) {
  const { t, locale } = useTranslation(chatMessages);
  return <HomeChat t={t} locale={locale} onOpenConnectors={onOpenConnectors} conversation={conversation} onOpenConversation={onOpenConversation} onNewConversation={onNewConversation} onConversationStarted={onConversationStarted} />;
}
