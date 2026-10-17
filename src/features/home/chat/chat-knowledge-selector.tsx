"use client";

import { useRef, useState } from "react";
import { BookOpen, Check, X } from "@phosphor-icons/react";
import { useAppAlert } from '@/components/app-alert-provider';
import { DropdownMenu, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from "./chat-picker";
import type { ChatContext } from "./chat-types";
import type { ChatText } from "./chat-messages";
import picker from "./chat-picker.module.css";
import { ChatContextChip } from './chat-context-chip';

export function ChatKnowledgeSelector({ context, onChange, t }: {
  context: ChatContext;
  onChange: (change: Partial<ChatContext>) => void;
  t: ChatText;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { notify } = useAppAlert();
  const matches = t("teamKnowledge").toLowerCase().includes(query.trim().toLowerCase());
  function clearKnowledge() {
    onChange({ knowledgeIncluded: false });
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    notify('info', t('knowledgeCleared'));
  }
  return <DropdownMenu open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }}>
    <ChatContextChip selected={context.knowledgeIncluded} triggerRef={trigger} icon={<BookOpen size={16} />}
      label={t(context.knowledgeIncluded ? 'knowledge' : 'selectKnowledge')}
      accessibleLabel={t('knowledgeContext')} clearLabel={t('clearKnowledge')} onClear={clearKnowledge} />
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
        onSelect={clearKnowledge}>
        <X /><span className={picker.name}>{t("withoutKnowledge")}</span>
        {!context.knowledgeIncluded ? <Check className={picker.check} /> : null}
      </ChatPickerItem>
    </ChatPickerContent>
  </DropdownMenu>;
}
