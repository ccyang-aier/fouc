'use client';

import { CalendarBlank, Clock, LinkSimple } from '@phosphor-icons/react';
import type { TaskSchedule } from '@fouc/shared/tasks';
import { useTranslation } from '@/lib/i18n';
import { localDateTime } from './timeline-model';
import { messages } from './timeline.messages';
import styles from './timeline.module.css';

export function ScheduleFields({ value, onChange, disabled = false }: {
  value: TaskSchedule; onChange: (value: TaskSchedule) => void; disabled?: boolean;
}) {
  const { t } = useTranslation(messages);
  function changeStart(local: string) {
    const startsAt = local ? new Date(local).toISOString() : '';
    const duration = Math.max(15 * 60_000, Date.parse(value.endsAt) - Date.parse(value.startsAt) || 60 * 60_000);
    onChange({ ...value, startsAt, endsAt: startsAt ? new Date(Date.parse(startsAt) + duration).toISOString() : value.endsAt });
  }
  return <>
    <label className={styles.formRow}><span><CalendarBlank size={16} />{t('startsAt')}</span><input type="datetime-local" required disabled={disabled} aria-label={t('startsAt')} value={localDateTime(value.startsAt)} onChange={event => changeStart(event.target.value)} /></label>
    <label className={styles.formRow}><span><Clock size={16} />{t('endsAt')}</span><input type="datetime-local" required disabled={disabled} aria-label={t('endsAt')} value={localDateTime(value.endsAt)} onChange={event => onChange({ ...value, endsAt: event.target.value ? new Date(event.target.value).toISOString() : '' })} /></label>
    <label className={styles.formRow}><span><LinkSimple size={16} />{t('link')}</span><input type="url" disabled={disabled} aria-label={t('link')} value={value.url} placeholder={t('linkPlaceholder')} maxLength={2048} onChange={event => onChange({ ...value, url: event.target.value })} /></label>
  </>;
}
