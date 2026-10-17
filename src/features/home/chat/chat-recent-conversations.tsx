"use client";

import { useState } from "react";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/relative-time";
import type { Locale } from "@/lib/i18n";
import { chatConversationTitle, useChatHistory, type ChatHistoryEntry } from "./chat-history";
import type { ChatText } from "./chat-messages";
import styles from "./chat-recent-conversations.module.css";

export function ChatRecentConversations({ onOpen, t, locale }: {
  onOpen: (entry: ChatHistoryEntry) => void;
  t: ChatText;
  locale: Locale;
}) {
  const conversations = useChatHistory();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? conversations : conversations.slice(0, 3);

  return (
    <section className={styles.recent} aria-labelledby="recent-conversations-title">
      <h2 id="recent-conversations-title">
        <ClockCounterClockwise size={17} />
        {t("recentConversations")}
      </h2>
      {visible.length ? (
        <ul className={styles.recentList} id="recent-conversations-list">
          {visible.map((entry, index) => {
            const title = chatConversationTitle(entry);
            return (
              <li key={entry.id}>
                <Button variant="ghost" className={styles.recentRow} onClick={() => onOpen(entry)}>
                  <span className={styles.recentDot} data-color={index % 3} aria-hidden="true" />
                  <span className={styles.recentTitle} title={title}>{title}</span>
                  <time dateTime={entry.updatedAt.toISOString()}>
                    {formatRelativeTime(entry.updatedAt.getTime(), locale)}
                  </time>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.recentEmpty}>{t("noRecentConversations")}</p>
      )}
      {conversations.length > 3 ? (
        <Button
          variant="ghost"
          className={styles.recentMore}
          aria-expanded={expanded}
          aria-controls="recent-conversations-list"
          onClick={() => setExpanded(!expanded)}
        >
          {t(expanded ? "showLess" : "seeMore")}
        </Button>
      ) : null}
    </section>
  );
}
