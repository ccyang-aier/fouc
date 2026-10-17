'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { messages } from './i18n/dashboard-management-dialogs';

import { useState } from 'react';
import styles from './dashboard-management.module.css';
import { DashboardModal } from './dashboard-modal';
import type { DashboardMilestone } from './dashboard-model';
import { DashboardButton } from './dashboard-ui';

export function DashboardMilestoneDialog({
  milestones,
  onClose,
  onSave,
}: {
  milestones: DashboardMilestone[];
  onClose: () => void;
  onSave: (milestones: DashboardMilestone[]) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const [draft, setDraft] = useState(() => milestones.map((item) => ({ ...item })));
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');

  function change(index: number, field: 'target' | 'completed', value: string) {
    setDraft((current) =>
      current.map((item, position) =>
        position === index ? { ...item, [field]: Number(value) } : item,
      ),
    );
  }

  function addMonth() {
    if (!month || draft.some((item) => item.month === month)) {
      setError('Choose a month that is not already listed.');
      return;
    }
    setDraft((current) =>
      [...current, { month, target: 0, completed: 0 }].sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    );
    setError('');
    setMonth('');
  }

  return (
    <DashboardModal title={t('Milestone targets and history')} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <div className={styles.milestoneFields}>
          <p>{t('Completed tasks are added to recorded history for their due month.')}</p>
          <div className={styles.tableHeading}>
            <span>{t('Month')}</span>
            <span>{t('Target')}</span>
            <span>{t('Recorded work')}</span>
          </div>
          {draft.map((item, index) => (
            <div className={styles.monthRow} key={item.month}>
              <time dateTime={item.month}>
                {new Date(`${item.month}-01T12:00:00`).toLocaleDateString(locale, {
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                required
                aria-label={t('{v0} target', { v0: item.month })}
                value={item.target}
                onChange={(event) => change(index, 'target', event.target.value)}
              />
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                required
                aria-label={t('{v0} recorded work', { v0: item.month })}
                value={item.completed}
                onChange={(event) => change(index, 'completed', event.target.value)}
              />
            </div>
          ))}
          <div className={styles.addMonth}>
            <input
              type="month"
              value={month}
              aria-label={t('Add milestone month')}
              onInput={(event) => setMonth(event.currentTarget.value)}
            />
            <DashboardButton tone="neutral" onClick={addMonth}>
              {t('Add month')}
            </DashboardButton>
          </div>
          {error ? (
            <p role="alert" className={styles.error}>
              {translateFixed(error, locale)}
            </p>
          ) : null}
        </div>
        <footer>
          <DashboardButton tone="neutral" onClick={onClose}>
            {t('Cancel')}
          </DashboardButton>
          <DashboardButton type="submit">{t('Save milestones')}</DashboardButton>
        </footer>
      </form>
    </DashboardModal>
  );
}
