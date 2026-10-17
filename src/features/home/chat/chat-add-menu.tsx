"use client";

import { useRef, useState } from 'react';
import { Paperclip, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuGroup, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatPickerContent, ChatPickerItem, ChatPickerSearch } from './chat-picker';
import { chatModeOrder, chatModes } from './chat-modes';
import { ChatResourceMenu } from './chat-resource-menu';
import { ChatResourceCreate } from './chat-resource-create';
import { openSettings } from '@/lib/settings-navigation';
import { openSkillsMarket } from '@/features/community/community-navigation';
import type { ComposerResource, ComposerResourceKind, ComposerResourceReference } from '@/features/community/composer-catalog';
import type { ChatMode } from './chat-types';
import type { ChatText } from './chat-messages';
import styles from './chat-add-menu.module.css';
import picker from './chat-picker.module.css';

export function ChatAddMenu({ mode, resources, onModeChange, onFiles, onResourceToggle, t, className }: {
  mode: ChatMode | null;
  resources: ComposerResourceReference[];
  onModeChange: (mode: ChatMode) => void;
  onFiles: () => void;
  onResourceToggle: (resource: ComposerResource) => void;
  t: ChatText;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<ComposerResourceKind | null>(null);
  const nextAction = useRef<(() => void) | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = (...text: string[]) => text.join(' ').toLocaleLowerCase().includes(normalized);
  const modes = chatModeOrder.filter(id => {
    const item = chatModes[id];
    return matches(id, t(item.label), t(item.description));
  });
  const showFiles = matches('files attachments upload', t('actionFiles'), t('files'));
  const showSkills = matches('skills skill 技能');
  const showMcp = matches('mcp connectors', t('mcp'), t('connectTools'));
  const hasActions = showFiles || showSkills || showMcp;

  function afterClose(action: () => void) {
    nextAction.current = action;
  }

  function closeFor(action: () => void) {
    afterClose(action);
    setOpen(false);
  }

  return <><DropdownMenu open={open} onOpenChange={next => {
    setOpen(next);
    if (next) { setQuery(''); nextAction.current = null; }
  }}>
    <DropdownMenuTrigger asChild>
      <Button ref={trigger} type="button" variant="outline" size="icon" className={className}
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
          {showSkills ? <ChatResourceMenu kind="skills" selected={resources} onToggle={onResourceToggle}
            onCreate={() => closeFor(() => setCreating('skills'))} onConfigure={() => closeFor(() => openSettings('skills'))}
            onOpenMarket={() => closeFor(openSkillsMarket)} /> : null}
          {showMcp ? <ChatResourceMenu kind="mcp" selected={resources} onToggle={onResourceToggle}
            onCreate={() => closeFor(() => setCreating('mcp'))} /> : null}
        </DropdownMenuGroup> : null}
        {!modes.length && !hasActions ? <p className={picker.empty} role="status">{t('noExecutionResults')}</p> : null}
      </ScrollArea>
    </ChatPickerContent>
  </DropdownMenu>
  {creating ? <ChatResourceCreate kind={creating} onCreated={onResourceToggle} onClose={() => {
    setCreating(null);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }} /> : null}
  </>;
}
