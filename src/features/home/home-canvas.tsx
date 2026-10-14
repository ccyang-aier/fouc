"use client";

import { useTranslation } from "@/lib/i18n/react";
import { chatMessages } from "./chat/chat-messages";
import { HomeChat } from "./chat/home-chat";

export function HomeCanvas() {
  const { t, locale } = useTranslation(chatMessages);
  return <HomeChat t={t} locale={locale} />;
}
