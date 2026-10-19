'use client';

import { Clock, Plus, X } from '@phosphor-icons/react';
import type { TaskSchedule } from '@fouc/shared/tasks';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { ScheduleFields } from './calendar-fields';
import { makeSchedule } from './calendar-model';
import { messages } from './calendar.messages';
import styles from './calendar.module.css';

export function TaskScheduleSection({ value, onChange, disabled }: {
  value: TaskSchedule | null; onChange: (value: TaskSchedule | null) => void; disabled: boolean;
}) {
  const { t } = useTranslation(messages);
  return <section className={styles.detailSchedule}><header><Clock size={16} />{t('schedule')}{value && !disabled && <Button type="button" variant="ghost" size="icon-sm" aria-label={t('removeSchedule')} onClick={() => onChange(null)}><X size={13} /></Button>}</header>
    {value ? <ScheduleFields value={value} disabled={disabled} onChange={onChange} /> : disabled ? <span>{t('noSchedule')}</span> : <button type="button" className={`fouc-action ${styles.scheduleEmpty}`} onClick={() => onChange(makeSchedule(new Date()))}><Plus size={14} />{t('addSchedule')}</button>}
  </section>;
}
