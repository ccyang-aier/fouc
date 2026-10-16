"use client";

import { GearSix } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openSettings } from "@/lib/settings-navigation";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-context-toolbar.module.css";
import { ChatProjectSelector } from "./chat-project-selector";
import { ChatKnowledgeSelector } from "./chat-knowledge-selector";

export function ChatContextSelectors({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.resources}>
        <ChatProjectSelector context={context} onChange={onChange} t={t} />
        <ChatKnowledgeSelector context={context} onChange={onChange} t={t} />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" className={styles.settingsButton} aria-label={t("chatSettings")} onClick={() => openSettings("agents")}>
            <GearSix size={17} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("chatSettings")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
