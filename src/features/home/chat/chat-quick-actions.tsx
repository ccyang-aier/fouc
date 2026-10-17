"use client";

import { useRef } from 'react';
import { Check } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ChatText } from './chat-messages';
import { useLocale } from '@/lib/i18n/react';
import { getComposerPlugins } from '@/features/community/composer-extensions';
import type { ComposerResourceReference } from '@/features/community/composer-catalog';
import { ResourceIcon } from './chat-resource-info';
import styles from './chat-quick-actions.module.css';
import tones from './chat-resource-tones.module.css';

function animatePress(button: HTMLButtonElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  button.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(0.95)', offset: 0.35 },
    { transform: 'scale(1)' },
  ], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
}

export function ChatQuickActions({ resources, onToggle, t }: {
  resources: ComposerResourceReference[];
  onToggle: (plugin: ComposerResourceReference) => void;
  t: ChatText;
}) {
  const plugins = getComposerPlugins(useLocale());
  const selectedFromMore = useRef(false);
  const primary = plugins.slice(0, 4);
  const more = plugins.slice(4);
  const selected = (id: string) => resources.some(resource => resource.kind === 'plugins' && resource.id === id);
  return <div className={`${styles.actions} ${tones.tone}`} data-resource-kind="plugins" role="group" aria-label={t('quickActions')}>
    {primary.map(plugin => {
      return <Button key={plugin.id} type="button" variant="outline" className={styles.action}
        aria-pressed={selected(plugin.id)} onClick={event => {
          animatePress(event.currentTarget);
          onToggle(plugin);
        }}>
        <ResourceIcon resource={plugin} />{plugin.name}
      </Button>;
    })}
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className={styles.action}
          data-selected={more.some(plugin => selected(plugin.id))} onClick={event => animatePress(event.currentTarget)}>{t('moreTasks')}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} onCloseAutoFocus={event => {
        if (selectedFromMore.current) event.preventDefault();
        selectedFromMore.current = false;
      }}>
        {more.map(plugin => {
          return <DropdownMenuItem key={plugin.id} role="menuitemcheckbox" aria-checked={selected(plugin.id)} onSelect={() => {
            selectedFromMore.current = true;
            onToggle(plugin);
          }}>
            <ResourceIcon resource={plugin} />{plugin.name}
            {selected(plugin.id) ? <Check className="ml-auto" size={14} aria-hidden="true" /> : null}
          </DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
