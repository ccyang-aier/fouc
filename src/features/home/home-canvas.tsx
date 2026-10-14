"use client";

import { chatMessages, type ChatText } from "./chat/chat-messages";
import { HomeChat } from "./chat/home-chat";

const t: ChatText = (key, values) =>
  chatMessages[key][0].replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));

export function HomeCanvas() {
  return <HomeChat t={t} />;
}
