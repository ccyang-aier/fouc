'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ClockCounterClockwise, Emoji } from '@/components/icons';
import { emojiGroups, findEmoji, normalizeEmoji } from '@/components/icons/emoji-catalog';
import { useTranslation } from '@/lib/i18n';
import { messages } from './emoji-picker.messages';
import styles from './emoji-picker.module.css';

const recentKey = 'fouc.emoji.recent';
function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(recentKey) ?? '[]');
    return Array.isArray(saved) ? [...new Set(saved.filter((value): value is string => typeof value === 'string' && Boolean(findEmoji(value))))].slice(0, 32) : [];
  } catch { return []; }
}

/** Shared searchable palette for callouts, messages and future emoji entry points. */
export function EmojiPalette({ onSelect, value, disabled = false }: { onSelect: (emoji: string) => void; value?: string; disabled?: boolean }) {
  const { locale, t } = useTranslation(messages);
  const language = locale === 'zh-CN' ? 'zh' : 'en';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [recent, setRecent] = useState(readRecent);
  const optionsRef = useRef<HTMLDivElement>(null);
  const search = query.trim().toLocaleLowerCase();
  const groups = category === 'recent' && !search
    ? [{ id: 'recent', label: { zh: t('recentEmoji'), en: t('recentEmoji') }, items: recent.flatMap(value => { const entry = findEmoji(value); return entry ? [entry] : []; }) }]
    : emojiGroups.filter(group => search || !category || category === group.id).map(group => ({ ...group, items: group.items.filter(entry => !search || `${entry.emoji} ${entry.name.zh} ${entry.name.en} ${entry.keywords}`.toLocaleLowerCase().includes(search)) })).filter(group => group.items.length);

  function choose(emoji: string) {
    const next = [emoji, ...recent.filter(item => item !== emoji)].slice(0, 32);
    setRecent(next);
    try { window.localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Selection also works without preference storage. */ }
    onSelect(emoji);
  }

  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing) return;
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const options = [...optionsRef.current?.querySelectorAll<HTMLButtonElement>('button[data-emoji]:not(:disabled)') ?? []];
    if (!options.length) return;
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = index < 0 ? (event.key === 'ArrowUp' ? options.length - 1 : 0)
      : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % options.length
          : event.key === 'ArrowLeft' ? (index - 1 + options.length) % options.length
            : event.key === 'ArrowDown' ? Math.min(index + 8, options.length - 1) : Math.max(index - 8, 0);
    options[next].focus();
    options[next].scrollIntoView({ block: 'nearest' });
  }

  return <div className={styles.picker}>
    <input data-autofocus type="search" className={styles.search} value={query} autoComplete="off" aria-label={t('searchEmoji')} placeholder={t('searchEmoji')} onChange={event => setQuery(event.target.value)} onKeyDown={navigate} />
    <div className={styles.categories} role="group" aria-label={t('emojiCategories')}>
      <button type="button" className={`fouc-action ${styles.categoryButton}`} data-surface="plain" aria-label={t('recentEmoji')} title={t('recentEmoji')} aria-pressed={category === 'recent'} onClick={() => { setCategory(category === 'recent' ? null : 'recent'); setQuery(''); }}><ClockCounterClockwise size={16} aria-hidden /></button>
      {emojiGroups.map(group => <button key={group.id} type="button" className={`fouc-action ${styles.categoryButton}`} data-surface="plain" aria-label={group.label[language]} title={group.label[language]} aria-pressed={category === group.id} onClick={() => setCategory(category === group.id ? null : group.id)}><Emoji value={group.items[0].emoji} size={24} /></button>)}
    </div>
    <div ref={optionsRef} className={styles.options} role="group" aria-label={t('chooseEmoji')} onKeyDown={navigate}>
      {groups.map(group => <section key={group.id}>
        <h3 className={styles.categoryLabel}>{group.label[language]}</h3>
        <div className={styles.grid}>{group.items.map(entry => <button key={entry.hexcode} type="button" className={`fouc-action ${styles.emoji}`} data-surface="plain" data-emoji={entry.emoji} disabled={disabled} aria-label={entry.name[language]} aria-pressed={normalizeEmoji(value ?? '') === normalizeEmoji(entry.emoji)} title={entry.name[language]} onClick={() => choose(entry.emoji)}><Emoji value={entry.emoji} size={28} /></button>)}</div>
      </section>)}
      {!groups.some(group => group.items.length) && <p className={styles.empty} role="status">{t(category === 'recent' && !search ? 'noRecentEmoji' : 'noResults')}</p>}
    </div>
  </div>;
}
