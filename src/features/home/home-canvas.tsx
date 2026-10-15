"use client";

import { useTranslation } from "@/lib/i18n/react";
import { chatMessages } from "./chat/chat-messages";
import { HomeChat } from "./chat/home-chat";

export function HomeCanvas({ onOpenConnectors }: { onOpenConnectors: () => void }) {
  const { t, locale } = useTranslation(chatMessages);
  return <HomeChat t={t} locale={locale} onOpenConnectors={onOpenConnectors} />;
}
