"use client";

import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-context-toolbar.module.css";
import { ChatKnowledgeSelector } from "./chat-knowledge-selector";
import { ChatLocalSettings } from "./chat-local-settings";

export function ChatContextSelectors({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.resources}>
        <ChatKnowledgeSelector context={context} onChange={onChange} t={t} />
      </div>
      <ChatLocalSettings context={context} onChange={onChange} />
    </div>
  );
}
