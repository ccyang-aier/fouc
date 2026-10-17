"use client";

import { useRef } from 'react';
import { CaretDown, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChatPickerContent } from './chat-picker';
import { ChatModeItems, chatModes } from './chat-modes';
import type { ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';
import styles from './chat-modes.module.css';

export function ChatModeControl({ mode, onChange, t }: {
  mode: ChatMode;
  onChange: (mode: ChatMode | null) => void;
  t: ChatText;
}) {
  const selected = useRef<ChatMode | null>(null);
  const { icon: Icon, label, description } = chatModes[mode];
  return <div className={styles.control} role="group" aria-label={t('currentMode', { mode: t(label) })}>
    <DropdownMenu onOpenChange={open => { if (open) selected.current = null; }}>
      <Tooltip><TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className={styles.trigger} aria-label={t('currentMode', { mode: t(label) })}>
            <Icon size={15} className={styles.icon} data-mode={mode} data-static-color aria-hidden="true" /><span>{t(label)}</span><CaretDown size={10} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger><TooltipContent>{t(description)}</TooltipContent></Tooltip>
      <ChatPickerContent className={styles.menu} aria-label={t('modeSelector')} onCloseAutoFocus={event => {
        if (selected.current) {
          event.preventDefault();
          const next = selected.current;
          selected.current = null;
          onChange(next);
        }
      }}>
        <ChatModeItems selected={mode} onSelect={next => { selected.current = next; }} t={t} />
      </ChatPickerContent>
    </DropdownMenu>
    <Tooltip><TooltipTrigger asChild>
      <Button type="button" variant="ghost" className={styles.clear} aria-label={t('removeMode', { mode: t(label) })}
        onClick={() => onChange(null)}><X size={12} aria-hidden="true" /></Button>
    </TooltipTrigger><TooltipContent>{t('removeMode', { mode: t(label) })}</TooltipContent></Tooltip>
  </div>;
}
