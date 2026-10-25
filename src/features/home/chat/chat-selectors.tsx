"use client";

import type { ChatContext } from "./chat-types";
import styles from "./chat-context-toolbar.module.css";
import { ChatLocalSettings } from "./chat-local-settings";

export function ChatContextSelectors({ context, onChange }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
}) {
  return (
    <div className={styles.toolbar}>
      <ChatLocalSettings context={context} onChange={onChange} />
    </div>
  );
}
