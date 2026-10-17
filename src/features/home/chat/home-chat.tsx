"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
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
import { ChatGreeting } from "./chat-greeting";
import { ChatRecentConversations } from "./chat-recent-conversations";
import { chatConversationTitle, saveChatConversation, useChatHistory, type ChatHistoryEntry } from "./chat-history";
import type { ChatContext, ChatSubmission } from "./chat-types";
import type { ChatText } from "./chat-messages";
import { autoReasoning } from './chat-reasoning';
import styles from "./chat.module.css";

export function HomeChat({
  t,
  locale = "zh-CN",
  onOpenConnectors,
  conversation,
}: {
  t: ChatText;
  locale?: Locale;
  onOpenConnectors: () => void;
  conversation?: ChatHistoryEntry;
}) {
  const { selectedProject, scopeKey } = useProjectResources();
  const history = useChatHistory();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationViewport = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ChatDraft>({ text: "", attachments: [], mode: null });
  const [context, setContext] = useState<ChatContext>({
    execution: { kind: "auto" },
    autoRules: { modelIds: null, reasoningEffort: autoReasoning.defaultLevel },
    projectId: selectedProject?.id ?? null,
    projectName: selectedProject?.name ?? null,
    knowledgeBaseId: null,
    knowledgeBaseName: null,
    localEnvironment: { createWorktree: false },
    ...conversation?.submissions.at(-1)?.context,
  });
  const [submissions, setSubmissions] = useState<ChatSubmission[]>(conversation?.submissions ?? []);
  const [conversationId, setConversationId] = useState<string | null>(conversation?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const savedConversation = history.find(entry => entry.id === conversationId);
  // A deleted preview must stop being editable, including one started on this page.
  if (conversationId && !savedConversation) {
    setConversationId(null);
    setSubmissions([]);
    setEditingId(null);
    setDraft({ text: '', attachments: [], mode: null });
    setContext(current => ({ ...current, resources: [] }));
  }
  const inConversation = submissions.length > 0;
  function updateContext(change: Partial<ChatContext>) {
    setContext((current) => ({ ...current, ...change, projectId: selectedProject?.id ?? null, projectName: selectedProject?.name ?? null }));
  }
  function submit(submission: ChatSubmission) {
    const next = editingId
      ? submissions.map((item) => (item.id === editingId ? submission : item))
      : [...submissions, submission];
    const id = conversationId ?? crypto.randomUUID();
    setSubmissions(next);
    setConversationId(id);
    if (scopeKey) saveChatConversation(scopeKey, { id, submissions: next, updatedAt: submission.createdAt });
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
    setDraft({ text: submission.text, attachments: submission.attachments, mode: submission.mode });
    setContext(submission.context);
    setEditingId(submission.id);
    inputRef.current?.focus();
  }
  function openConversation(entry: ChatHistoryEntry) {
    setConversationId(entry.id);
    setSubmissions(entry.submissions);
    setContext({ ...entry.submissions.at(-1)!.context, resources: [] });
    setDraft({ text: "", attachments: [], mode: null });
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
              setDraft({ text: "", attachments: [], mode: null });
              setContext(current => ({ ...current, resources: [] }));
            }}
          >
            <ArrowLeft size={15} />
            {t("newConversation")}
          </Button>
          <span>
            <ChatIcon size={15} />
            {savedConversation ? chatConversationTitle(savedConversation) : null}
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
              <ChatGreeting key={locale} text={t("greeting")} />
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
