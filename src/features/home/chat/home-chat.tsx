"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import {
  ArrowLeft,
  ChatText as ChatIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectResources } from "@/features/project/project-resources";
import type { Locale } from "@/lib/i18n";
import { ChatComposer, type ChatDraft } from "./chat-composer";
import { ChatConversation } from "./chat-conversation";
import { ChatRecentConversations } from "./chat-recent-conversations";
import { saveChatConversation, type ChatHistoryEntry } from "./chat-history";
import type { ChatContext, ChatSubmission } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat.module.css";

export function HomeChat({
  t,
  locale = "zh-CN",
  onOpenConnectors,
}: {
  t: ChatText;
  locale?: Locale;
  onOpenConnectors: () => void;
}) {
  const { selectedProject } = useProjectResources();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationViewport = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ChatDraft>({ text: "", attachments: [] });
  const [context, setContext] = useState<ChatContext>({
    execution: { kind: "agent", id: "nova" },
    projectId: selectedProject?.id ?? null,
    projectName: selectedProject?.name ?? null,
    knowledgeIncluded: true,
    localEnvironment: { createWorktree: false },
  });
  const [submissions, setSubmissions] = useState<ChatSubmission[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inConversation = submissions.length > 0;
  function updateContext(change: Partial<ChatContext>) {
    setContext((current) => ({ ...current, ...change }));
  }
  function submit(submission: ChatSubmission) {
    const next = editingId
      ? submissions.map((item) => (item.id === editingId ? submission : item))
      : [...submissions, submission];
    const id = conversationId ?? crypto.randomUUID();
    setSubmissions(next);
    setConversationId(id);
    saveChatConversation({ id, submissions: next, updatedAt: submission.createdAt });
    setEditingId(null);
    requestAnimationFrame(() => {
      conversationViewport.current?.scrollTo({
        top: conversationViewport.current.scrollHeight,
        behavior: "smooth",
      });
      inputRef.current?.focus();
    });
  }
  function edit(submission: ChatSubmission) {
    setDraft({ text: submission.text, attachments: submission.attachments });
    setContext(submission.context);
    setEditingId(submission.id);
    inputRef.current?.focus();
  }
  function openConversation(entry: ChatHistoryEntry) {
    setConversationId(entry.id);
    setSubmissions(entry.submissions);
    setContext(entry.submissions.at(-1)!.context);
    setDraft({ text: "", attachments: [] });
    setEditingId(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  return (
    <section
      className={styles.page}
      data-conversation={inConversation}
      aria-label={t("home")}
    >
      {inConversation ? (
        <header className={styles.conversationHeader}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSubmissions([]);
              setEditingId(null);
              setConversationId(null);
              setDraft({ text: "", attachments: [] });
            }}
          >
            <ArrowLeft size={15} />
            {t("newConversation")}
          </Button>
          <span>
            <ChatIcon size={15} />
            {submissions[0].attachments[0]?.file.name ?? submissions[0].text}
          </span>
        </header>
      ) : null}
      <ScrollArea
        as="div"
        className={styles.pageScroll}
        viewportClassName={styles.viewport}
        viewportRef={conversationViewport}
      >
        <div className={styles.content}>
          {!inConversation ? (
            <header className={styles.greeting}>
              <Image
                className={styles.greetingMark}
                src="/brand/chat/conversation-mark.png"
                width={36}
                height={36}
                alt=""
              />
              <h1>{t("greeting")}</h1>
            </header>
          ) : (
            <ChatConversation
              submissions={submissions}
              onEdit={edit}
              onRefine={() => inputRef.current?.focus()}
              t={t}
              locale={locale}
            />
          )}
          <motion.div
            layout="position"
            transition={{ type: "spring", bounce: 0, duration: 0.48 }}
            className={styles.composerDock}
          >
            <ChatComposer
              draft={draft}
              setDraft={setDraft}
              context={context}
              setContext={updateContext}
              onSubmit={submit}
              inputRef={inputRef}
              compact={inConversation}
              onOpenConnectors={onOpenConnectors}
              t={t}
            />
          </motion.div>
          {!inConversation ? (
            <ChatRecentConversations onOpen={openConversation} t={t} locale={locale} />
          ) : null}
        </div>
      </ScrollArea>
    </section>
  );
}
