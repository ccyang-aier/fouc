"use client";

import { useRef, useState } from 'react';
import { CaretRight, ClipboardText, Graph, Paperclip, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuGroup, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from './chat-picker';
import { ChatExecutionLogo } from './chat-execution-logo';
import { getChatExecutionOption } from './chat-execution-options';
import { chatModeOrder, chatModes } from './chat-modes';
import { reasoningLabels } from './chat-reasoning';
import type { ChatContext, ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';
import styles from './chat-add-menu.module.css';
import picker from './chat-picker.module.css';

export function ChatAddMenu({ mode, context, onModeChange, onFiles, onPaste, onModels, onConnectors, t, className }: {
  mode: ChatMode | null;
  context: ChatContext;
  onModeChange: (mode: ChatMode) => void;
  onFiles: () => void;
  onPaste: () => void;
  onModels: () => void;
  onConnectors: () => void;
  t: ChatText;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const nextAction = useRef<(() => void) | null>(null);
  const execution = getChatExecutionOption(context.execution);
  const effort = context.execution.kind === 'auto' ? context.autoRules.reasoningEffort
    : context.execution.kind === 'model' ? context.execution.reasoningEffort : null;
  const normalized = query.trim().toLocaleLowerCase();
  const matches = (...text: string[]) => text.join(' ').toLocaleLowerCase().includes(normalized);
  const modes = chatModeOrder.filter(id => {
    const item = chatModes[id];
    return matches(id, t(item.label), t(item.description));
  });
  const showFiles = matches('files attachments upload', t('actionFiles'), t('files'));
  const showPaste = matches('paste clipboard', t('paste'));
  const showModels = matches('model agent auto', t('modelLabel'), t('executionSelector'), execution.name, effort ? t(reasoningLabels[effort]) : '');
  const showMcp = matches('mcp connectors', t('mcp'), t('connectTools'));
  const hasActions = showFiles || showPaste || showModels || showMcp;

  function afterClose(action: () => void) {
    nextAction.current = action;
  }

  return <DropdownMenu open={open} onOpenChange={next => {
    setOpen(next);
    if (next) { setQuery(''); nextAction.current = null; }
  }}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" size="icon" className={className}
        aria-label={t('attach')} title={t('composerActions')}><Plus size={19} /></Button>
    </DropdownMenuTrigger>
    <ChatPickerContent className={styles.menu} aria-label={t('composerActions')}
      onCloseAutoFocus={event => {
        const action = nextAction.current;
        if (action) {
          event.preventDefault();
          nextAction.current = null;
          requestAnimationFrame(action);
        }
      }}>
      <div className={styles.search}>
        <ChatPickerSearch value={query} aria-label={t('searchActions')} placeholder={t('searchActions')}
          onChange={event => setQuery(event.target.value)} />
      </div>
      <ScrollArea className={styles.list} viewportClassName={styles.viewport}>
        {modes.length ? <DropdownMenuGroup aria-label={t('executionMode')}>
          {modes.map(id => {
            const { icon: Icon, label, description } = chatModes[id];
            return <ChatPickerItem key={id} className={styles.item} role="menuitemradio"
              aria-checked={mode === id} data-current={mode === id} textValue={t(label)}
              onSelect={() => afterClose(() => onModeChange(id))}>
              <Icon className={styles.modeIcon} data-mode={id} data-static-color aria-hidden="true" />
              <span className={styles.name}>{t(label)}</span>
              <span className={styles.description}>{t(description)}</span>
            </ChatPickerItem>;
          })}
        </DropdownMenuGroup> : null}
        {modes.length && hasActions ? <DropdownMenuSeparator className={styles.separator} /> : null}
        {hasActions ? <DropdownMenuGroup>
          {showFiles ? <ChatPickerItem className={styles.item} textValue={t('actionFiles')} onSelect={onFiles}>
            <Paperclip className={styles.neutralIcon} aria-hidden="true" /><span>{t('actionFiles')}</span>
          </ChatPickerItem> : null}
          {showPaste ? <ChatPickerItem className={styles.item} textValue={t('paste')} onSelect={() => { void onPaste(); }}>
            <ClipboardText className={styles.neutralIcon} aria-hidden="true" /><span>{t('paste')}</span>
          </ChatPickerItem> : null}
          {showModels ? <ChatPickerItem className={styles.item} textValue={execution.name} onSelect={() => afterClose(onModels)}>
            <ChatExecutionLogo option={execution} size={16} /><span className={styles.modelName}>{execution.name}</span>
            {effort ? <span className={styles.effort}>{t(reasoningLabels[effort])}</span> : null}
            <CaretRight className={styles.chevron} aria-hidden="true" />
          </ChatPickerItem> : null}
          {showMcp ? <ChatPickerItem className={styles.item} textValue={t('mcp')} onSelect={() => afterClose(onConnectors)}>
            <Graph className={styles.neutralIcon} aria-hidden="true" /><span>{t('mcp')}</span>
            <CaretRight className={styles.chevron} aria-hidden="true" />
          </ChatPickerItem> : null}
        </DropdownMenuGroup> : null}
        {!modes.length && !hasActions ? <p className={picker.empty} role="status">{t('noExecutionResults')}</p> : null}
      </ScrollArea>
    </ChatPickerContent>
  </DropdownMenu>;
}
