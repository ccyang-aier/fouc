'use client';

import { AirplaneTilt, ClockCounterClockwise, Flag, ForkKnife, HandWaving, Heart, Leaf, Lightbulb, MagnifyingGlass, Smiley, SoccerBall } from '@phosphor-icons/react';
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnchoredPopover } from '@/components/ui/anchored-popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { EmojiGlyph } from './emoji-glyph';
import { emojiGroups, recentEmojiEntry, searchEmoji, type EmojiEntry, type EmojiGroup } from './emoji-catalog';
import { messages } from './emoji.messages';
import styles from './picker.module.css';

export type ModernEmojiPickerProps = {
  onSelect: (emoji: string) => void; disabled?: boolean; label?: string; className?: string;
  mode?: 'composer' | 'reaction'; open?: boolean; onOpenChange?: (open: boolean) => void;
};
const recentKey = 'fouc.chat-emoji.recent';
const groups: readonly EmojiGroup[] = ['recent', ...emojiGroups];
const icons = [ClockCounterClockwise, Smiley, HandWaving, Leaf, ForkKnife, AirplaneTilt, SoccerBall, Lightbulb, Heart, Flag];
function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try { const value: unknown = JSON.parse(window.localStorage.getItem(recentKey) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(recentEmojiEntry(item))).slice(0, 32) : []; }
  catch { return []; }
}

export function ModernEmojiPicker({ onSelect, disabled, label, className, mode = 'composer', open, onOpenChange }: ModernEmojiPickerProps) {
  const { t, locale } = useTranslation(messages);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const bindTrigger = useCallback((node: HTMLButtonElement | null) => setAnchor(node), []);
  const [localOpen, setLocalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<EmojiGroup>('Smileys & Emotion');
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const options = useRef<HTMLDivElement>(null);
  const shown = !disabled && (open ?? localOpen);
  const entries = useMemo(() => searchEmoji(query, group, recent), [query, group, recent]);
  const current = entries.find(entry => entry.emoji === active);
  const title = label ?? t(mode === 'reaction' ? 'react' : 'add');
  const name = (entry: EmojiEntry) => locale === 'zh-CN' ? entry.zh : entry.name;
  function close() { setLocalOpen(false); onOpenChange?.(false); }
  function choose(emoji: string) {
    const next = [emoji, ...recent.filter(item => item !== emoji)].slice(0, 32);
    setRecent(next);
    try { window.localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Choosing an emoji works even without preference storage. */ }
    close();
    onSelect(emoji);
  }
  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...options.current?.querySelectorAll<HTMLButtonElement>('[data-emoji-option]') ?? []];
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = index < 0 ? event.key === 'ArrowUp' ? buttons.length - 1 : 0
      : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index - 1 + buttons.length) % buttons.length
          : event.key === 'ArrowDown' ? Math.min(index + 8, buttons.length - 1) : Math.max(index - 8, 0);
    buttons[next].focus();
    buttons[next].scrollIntoView({ block: 'nearest' });
  }
  return <><Tooltip><TooltipTrigger asChild><button ref={bindTrigger} type="button" className={cn('fouc-action', styles.trigger, className)} data-surface="plain" disabled={disabled}
    aria-label={title} aria-haspopup="dialog" aria-expanded={shown} onClick={() => {
      if (shown) close();
      else { const saved = readRecent(); setQuery(''); setActive(null); setRecent(saved); setGroup('Smileys & Emotion'); setLocalOpen(true); onOpenChange?.(true); }
    }}><Smiley size={16} aria-hidden /></button></TooltipTrigger><TooltipContent>{title}</TooltipContent></Tooltip>
    {shown && anchor && <AnchoredPopover anchor={anchor} onClose={close} label={title} width={340} className={styles.surface}>
      <div className={styles.picker} data-emoji-picker="">
        <div className={styles.searchWrap}><MagnifyingGlass size={15} aria-hidden /><input className={styles.search} type="search" data-autofocus autoComplete="off"
          value={query} onChange={event => { setQuery(event.target.value); setActive(null); }} onKeyDown={navigate} aria-label={t('search')} placeholder={t('search')} /></div>
        <div className={styles.categories} role="group" aria-label={t('choose')}>
          {groups.map((item, index) => { const Icon = icons[index]; return <Tooltip key={item}><TooltipTrigger asChild><button type="button" className={`fouc-action ${styles.category}`} data-surface="plain" data-active={!query && group === item} aria-pressed={!query && group === item} aria-label={t(item)} onClick={() => { setGroup(item); setQuery(''); setActive(null); }}><Icon size={18} aria-hidden /></button></TooltipTrigger><TooltipContent>{t(item)}</TooltipContent></Tooltip>; })}
        </div>
        <div className={styles.groupName}><span>{t(query.trim() ? 'results' : group)}</span><span>{entries.length}</span></div>
        <div className={styles.results}>
          <div ref={options} className={styles.grid} role="group" aria-label={t('choose')} onKeyDown={navigate}>
            {entries.map((entry, index) => <button key={entry.emoji} type="button" data-emoji-option="" className={`fouc-action ${styles.option}`} data-surface="plain" aria-label={name(entry)}
              tabIndex={active === entry.emoji || active === null && index === 0 ? 0 : -1} onMouseEnter={() => setActive(entry.emoji)} onFocus={() => setActive(entry.emoji)} onClick={() => choose(entry.emoji)}>
              <EmojiGlyph emoji={entry.emoji} size={28} />
            </button>)}
          </div>
          {!entries.length && <div className={styles.empty} role="status"><strong>{t(query.trim() || group !== 'recent' ? 'noResults' : 'noRecent')}</strong><span>{t(query.trim() || group !== 'recent' ? 'noResultsHint' : 'recentHint')}</span></div>}
        </div>
        <div className={styles.preview}>{current ? <><EmojiGlyph emoji={current.emoji} size={27} /><span>{name(current)}</span></> : <span className={styles.previewHint}>{t('choose')}</span>}<a className={styles.attribution} href="/emoji/ATTRIBUTION.txt" target="_blank" rel="noreferrer" title={t('license')}>Fluent Emoji · Twemoji</a></div>
      </div>
    </AnchoredPopover>}
  </>;
}
