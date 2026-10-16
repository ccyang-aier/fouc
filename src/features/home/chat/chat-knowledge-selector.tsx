"use client";

import { useState } from "react";
import { BookOpen, Check, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from "./chat-picker";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import picker from "./chat-picker.module.css";
import styles from "./chat-context-toolbar.module.css";

export function ChatKnowledgeSelector({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const [query, setQuery] = useState("");
  const matches = t("teamKnowledge").toLowerCase().includes(query.trim().toLowerCase());
  return <DropdownMenu onOpenChange={(open) => { if (open) setQuery(""); }}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" className={styles.resourceButton} aria-label={t("knowledgeContext")}
        data-selected={context.knowledgeIncluded}>
        <BookOpen size={16} /><span>{t("knowledge")}</span>
      </Button>
    </DropdownMenuTrigger>
    <ChatPickerContent>
      <div className={picker.header}>
        <ChatPickerSearch value={query} aria-label={t("searchKnowledge")} placeholder={t("searchKnowledge")}
          onChange={(event) => setQuery(event.target.value)} />
      </div>
      {matches ? <ChatPickerItem role="menuitemcheckbox" aria-checked={context.knowledgeIncluded}
        data-selected={context.knowledgeIncluded} onSelect={() => onChange({ knowledgeIncluded: !context.knowledgeIncluded })}>
        <BookOpen /><span className={picker.name}>{t("teamKnowledge")}</span>
        {context.knowledgeIncluded ? <Check className={picker.check} /> : null}
      </ChatPickerItem> : <p className={picker.empty} role="status">{t("noKnowledgeResults")}</p>}
      <DropdownMenuSeparator className={picker.separator} />
      <ChatPickerItem role="menuitemradio" aria-checked={!context.knowledgeIncluded} data-selected={!context.knowledgeIncluded}
        onSelect={() => onChange({ knowledgeIncluded: false })}>
        <X /><span className={picker.name}>{t("withoutKnowledge")}</span>
      </ChatPickerItem>
    </ChatPickerContent>
  </DropdownMenu>;
}
