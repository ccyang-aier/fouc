'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-management-dialogs';

import { Star } from '@phosphor-icons/react';
import { useState } from 'react';
import styles from './dashboard-management.module.css';
import { DashboardModal } from './dashboard-modal';
import type { DashboardMilestone, DashboardState, DashboardTarget } from './dashboard-model';
import { selectFavorites } from './dashboard-selectors';
import { DashboardButton } from './dashboard-ui';

export function DashboardFavoritesDialog({
  state,
  onClose,
  onSave,
}: {
  state: DashboardState;
  onClose: () => void;
  onSave: (targets: DashboardTarget[]) => void;
}) {
  const { t, locale } = useTranslation(messages);

  const [selected, setSelected] = useState(
    () => new Set(selectFavorites(state).map((item) => item.id)),
  );
  const options = [
    ...state.projects.map((project) => ({
      id: `project:${project.id}`,
      title: fixtureField(project, 'name', locale),
      type: 'Project',
      target: { kind: 'project', id: project.id } as const,
    })),
    ...state.tasks.map((task) => ({
      id: `task:${task.id}`,
      title: fixtureField(task, 'title', locale),
      type: 'Task',
      target: { kind: 'task', id: task.id } as const,
    })),
    ...state.documents.map((document) => ({
      id: `document:${document.id}`,
      title: fixtureField(document, 'title', locale),
      type: document.kind[0].toUpperCase() + document.kind.slice(1),
      target: { kind: 'document', id: document.id } as const,
    })),
  ];

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DashboardModal title={t('Manage favourites')} onClose={onClose}>
      <div className={styles.favoriteList}>
        {options.map((option) => (
          <label key={option.id} className="fouc-action">
            <Star size={18} weight={selected.has(option.id) ? 'fill' : 'regular'} />
            <span>
              <strong>{fixtureField(option, 'title', locale)}</strong>
              <small>{option.type}</small>
            </span>
            <input
              type="checkbox"
              checked={selected.has(option.id)}
              onChange={() => toggle(option.id)}
            />
          </label>
        ))}
        {!options.length ? <p>{t('No items to add yet.')}</p> : null}
      </div>
      <footer>
        <DashboardButton tone="neutral" onClick={onClose}>
          {t('Cancel')}
        </DashboardButton>
        <DashboardButton
          onClick={() => {
            onSave(
              options.filter((option) => selected.has(option.id)).map((option) => option.target),
            );
            onClose();
          }}
        >
          {t('Save favourites')}
        </DashboardButton>
      </footer>
    </DashboardModal>
  );
}

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
