'use client';

import { CalendarBlank, Clock, LinkSimple } from '@phosphor-icons/react';
import type { TaskSchedule } from '@fouc/shared/tasks';
import { useTranslation } from '@/lib/i18n';
import { localDateTime } from './calendar-model';
import { messages } from './calendar.messages';
import { DatePicker } from '@/components/ui/date-picker';
import styles from './calendar.module.css';

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
    <label className={styles.formRow}><span><CalendarBlank size={14} />{t('startsAt')}</span><DatePicker type="datetime-local" required disabled={disabled} aria-label={t('startsAt')} value={localDateTime(value.startsAt)} onValueChange={changeStart} /></label>
    <label className={styles.formRow}><span><Clock size={14} />{t('endsAt')}</span><DatePicker type="datetime-local" required disabled={disabled} aria-label={t('endsAt')} value={localDateTime(value.endsAt)} onValueChange={local => onChange({ ...value, endsAt: local ? new Date(local).toISOString() : '' })} /></label>
    <label className={styles.formRow}><span><LinkSimple size={14} />{t('link')}</span><input type="url" disabled={disabled} aria-label={t('link')} value={value.url} placeholder={t('linkPlaceholder')} maxLength={2048} onChange={event => onChange({ ...value, url: event.target.value })} /></label>
  </>;
}
