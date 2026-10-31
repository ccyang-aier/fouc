'use client';

import { useState } from 'react';
import { Smiley } from '@/components/icons';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { AnchoredPopover } from './anchored-popover';
import { EmojiPalette } from './emoji-palette';
import { messages } from './emoji-picker.messages';
import styles from './emoji-picker.module.css';

export function EmojiPicker({ onSelect, disabled = false, className, label }: {
  onSelect: (emoji: string) => void; disabled?: boolean; className?: string; label?: string;
}) {
  const { t } = useTranslation(messages);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const title = label ?? t('chooseEmoji');
  return <>
    <button type="button" className={cn('fouc-action', styles.trigger, className)} data-surface="plain" disabled={disabled}
      aria-label={title} aria-haspopup="dialog" aria-expanded={Boolean(anchor) && !disabled}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}>
      <Smiley size={16} aria-hidden />
    </button>
    {anchor && !disabled && <AnchoredPopover anchor={anchor} onClose={() => setAnchor(null)} label={title} width={296} align="start">
      <EmojiPalette disabled={disabled} onSelect={emoji => { setAnchor(null); onSelect(emoji); }} />
    </AnchoredPopover>}
  </>;
}
