"use client";

import { ClipboardText, PencilSimple, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAppAlert } from "@/components/app-alert-provider";
import { ChatAttachments } from "./chat-attachments";
import { ChatTaskTag } from "./chat-quick-actions";
import { ChatModeTag } from "./chat-modes";
import { ChatResourceTags } from './chat-resource-tags';
import type { ChatSubmission } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat.module.css";
import { getChatExecutionOption } from "./chat-execution-options";
import { reasoningLabels } from './chat-reasoning';

export function ChatConversation({
  submissions,
  onEdit,
  onRefine,
  t,
  locale,
}: {
  submissions: ChatSubmission[];
  onEdit: (submission: ChatSubmission) => void;
  onRefine: () => void;
  t: ChatText;
  locale: string;
}) {
  const { notify } = useAppAlert();
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("success", t("copied"));
    } catch {
      notify("info", t("clipboardError"));
    }
  }
  return (
    <div className={styles.conversation} aria-label={t("conversation")}>
      <div className={styles.date}>
        {t("today")}
        <span>
          {submissions[0].createdAt.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {submissions.map((submission) => {
        const reasoningEffort = submission.context.execution.kind === 'auto' ? submission.context.autoRules.reasoningEffort
          : submission.context.execution.kind === 'model' ? submission.context.execution.reasoningEffort : null;
        return (
        <article className={styles.turn} key={submission.id}>
          <div className={styles.userMessage}>
            {submission.attachments.length ? (
              <ChatAttachments attachments={submission.attachments} t={t} />
            ) : null}
            {submission.mode || submission.task ? <div className={styles.messageTags}>
              {submission.mode ? <ChatModeTag mode={submission.mode} t={t} /> : null}
              {submission.task ? <ChatTaskTag task={submission.task} t={t} /> : null}
            </div> : null}
            <p>{submission.text}</p>
            <ChatResourceTags resources={submission.context.resources ?? []} />
            <div className={styles.messageActions}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("copy")}
                onClick={() => void copy(submission.text)}
              >
                <ClipboardText size={15} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("edit")}
                onClick={() => onEdit(submission)}
              >
                <PencilSimple size={15} />
              </Button>
            </div>
          </div>
          <div className={styles.assistantMessage}>
            <span className={styles.assistantBadge}>
              <Sparkle size={16} weight="fill" />
            </span>
            <div className={styles.assistantContent}>
              <h2>{t("ready")}</h2>
              <p>{t("readyDescription")}</p>
              <dl className={styles.contextSummary}>
                <div>
                  <dt>{t(submission.context.execution.kind === "agent" ? "agentLabel" : "modelLabel")}</dt>
                  <dd>{getChatExecutionOption(submission.context.execution).name}</dd>
                </div>
                {submission.context.execution.kind === 'auto' ? <div>
                  <dt>{t('autoPool')}</dt><dd>{submission.context.autoRules.modelIds === null ? t('autoAllModels') : t('autoModelCount', { count: submission.context.autoRules.modelIds.length })}</dd>
                </div> : null}
                {reasoningEffort ? <div>
                  <dt>{t('reasoningEffort')}</dt><dd>{t(reasoningLabels[reasoningEffort])}</dd>
                </div> : null}
                <div>
                  <dt>{t("project")}</dt>
                  <dd>{submission.context.projectName ?? t("noProject")}</dd>
                </div>
                {submission.context.knowledgeIncluded ? (
                  <div>
                    <dt>{t("knowledge")}</dt>
                    <dd>{t("teamKnowledge")}</dd>
                  </div>
                ) : null}
                {submission.context.localEnvironment?.createWorktree ? <div>
                  <dt>{t('localEnvironment')}</dt><dd>{t('worktreeRequested')}</dd>
                </div> : null}
              </dl>
              <p className={styles.previewNote}>{t("preview")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.refineButton}
                onClick={onRefine}
              >
                {t("continue")}
              </Button>
            </div>
          </div>
        </article>
        );
      })}
    </div>
  );
}
