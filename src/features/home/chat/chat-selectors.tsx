"use client";

import { BookOpen, GearSix } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openSettings } from "@/lib/settings-navigation";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import styles from "./chat-context-toolbar.module.css";
import { ChatProjectSelector } from "./chat-project-selector";

export function ChatContextSelectors({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.resources}>
        <ChatProjectSelector context={context} onChange={onChange} t={t} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className={styles.resourceButton} aria-label={t("knowledgeContext")}
              data-selected={context.knowledgeIncluded}>
              <BookOpen size={16} />
              <span>{t("knowledge")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={styles.knowledgeMenu}>
            <DropdownMenuLabel>{t("knowledgeContext")}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={context.knowledgeIncluded} onCheckedChange={(knowledgeIncluded) => onChange({ knowledgeIncluded })}>
              {t("teamKnowledge")}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
