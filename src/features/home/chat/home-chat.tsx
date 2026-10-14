"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import {
  ArrowLeft,
  ChatText as ChatIcon,
  Scan,
  Warning,
  ChatCircleText,
  NotePencil,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectResources } from "@/features/project/project-resources";
import { ChatComposer, type ChatDraft } from "./chat-composer";
import { ChatConversation } from "./chat-conversation";
import type { ChatContext, ChatSubmission } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat.module.css";

const suggestions = [
  { label: "review", prompt: "reviewPrompt", icon: Scan },
  { label: "issues", prompt: "issuesPrompt", icon: Warning },
  { label: "explain", prompt: "explainPrompt", icon: ChatCircleText },
  { label: "improve", prompt: "improvePrompt", icon: NotePencil },
] as const;

export function HomeChat({
  t,
  locale = "zh-CN",
}: {
  t: ChatText;
  locale?: string;
}) {
  const { selectedProject } = useProjectResources();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationViewport = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<ChatDraft>({ text: "", attachments: [] });
  const [context, setContext] = useState<ChatContext>({
    agent: "Nova",
    mode: "Auto",
    permission: "defaultPermission",
    projectId: selectedProject?.id ?? null,
    projectName: selectedProject?.name ?? null,
    knowledgeIncluded: true,
  });
  const [submissions, setSubmissions] = useState<ChatSubmission[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inConversation = submissions.length > 0;
  function updateContext(change: Partial<ChatContext>) {
    setContext((current) => ({ ...current, ...change }));
  }
  function submit(submission: ChatSubmission) {
    setSubmissions((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? submission : item))
        : [...current, submission],
    );
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
  return (
    <section
      className={styles.page}
      data-conversation={inConversation}
      aria-label={t("home")}
    >
      <div className={styles.wallpaper} aria-hidden />
      {inConversation ? (
        <header className={styles.conversationHeader}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSubmissions([]);
              setEditingId(null);
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
              t={t}
            />
          </motion.div>
          {!inConversation ? (
            <div className={styles.suggestions}>
              <p>{t("suggestions")}</p>
              <div className={styles.suggestionButtons}>
                {suggestions.map(({ label, prompt, icon: Icon }) => (
                  <Button
                    type="button"
                    variant="outline"
                    className={styles.suggestionButton}
                    key={label}
                    onClick={() => {
                      setDraft({ ...draft, text: t(prompt) });
                      inputRef.current?.focus();
                    }}
                  >
                    <Icon size={17} />
                    <span>{t(label)}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  );
}
