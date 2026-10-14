'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-project-dialog';

import { Plus, Trash } from '@phosphor-icons/react';
import { useId, useState } from 'react';
import { DashboardModal } from './dashboard-modal';
import type { DashboardPriority, DashboardProject, DashboardTask } from './dashboard-model';
import styles from './dashboard-project-dialog.module.css';
import { AvatarGroup, DashboardButton } from './dashboard-ui';

interface DashboardProjectDialogProps {
  project: DashboardProject;
  tasks: DashboardTask[];
  onClose: () => void;
  onSave: (project: DashboardProject) => void;
  onOpenTask: (taskId: string) => void;
  onCreateTask: () => void;
  onDelete: (project: DashboardProject) => void;
}

export function DashboardProjectDialog({
  project,
  tasks,
  onClose,
  onSave,
  onOpenTask,
  onCreateTask,
  onDelete,
}: DashboardProjectDialogProps) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const [draft, setDraft] = useState(project);
  const [error, setError] = useState('');
  const nameId = useId();
  const descriptionId = useId();
  const priorityId = useId();

  function save() {
    if (!draft.name.trim()) {
      setError('Enter a project name.');
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
    });
    onClose();
  }

  return (
    <DashboardModal title={t('Project details')} onClose={onClose} wide>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className={styles.body}>
          <label className={styles.field} htmlFor={nameId}>
            {t('Project name')}
            <input
              id={nameId}
              autoFocus
              value={draft.name}
              maxLength={120}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${nameId}-error` : undefined}
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
                setError('');
              }}
            />
          </label>
          {error ? (
            <p id={`${nameId}-error`} className={styles.error} role="alert">
              {translateFixed(error, locale)}
            </p>
          ) : null}
          <label className={styles.field} htmlFor={descriptionId}>
            {t('Description')}
            <textarea
              id={descriptionId}
              value={draft.description}
              rows={3}
              placeholder={t('What are you working on?')}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label className={styles.field} htmlFor={priorityId}>
            {t('Priority')}
            <select
              id={priorityId}
              value={draft.priority}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  priority: event.target.value as DashboardPriority,
                }))
              }
            >
              {(['Low', 'Medium', 'High', 'Urgent'] as const).map((priority) => (
                <option value={priority} key={priority}>
                  {uiLabel(priority)}
                </option>
              ))}
            </select>
          </label>
          <section className={styles.tasks} aria-label={t('Project tasks')}>
            <header>
              <h3>
                {t('Tasks')}
                <span>{tasks.length}</span>
              </h3>
              <DashboardButton tone="neutral" type="button" onClick={onCreateTask}>
                <Plus size={14} />
                {t('Add task')}
              </DashboardButton>
            </header>
            {tasks.length ? (
              <div className={styles.taskRows}>
                {tasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`fouc-action ${styles.taskRow}`}
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span className={styles.taskName}>
                      <strong>{fixtureField(task, 'title', locale)}</strong>
                      <small>
                        {uiLabel(task.status)} · {task.progress}%
                      </small>
                    </span>
                    <AvatarGroup
                      ids={task.assignees.slice(0, 3)}
                      size={24}
                      extra={Math.max(0, task.assignees.length - 3)}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>{t('Add the first task to track this project.')}</p>
            )}
          </section>
        </div>
        <footer className={styles.footer}>
          <DashboardButton
            type="button"
            tone="neutral"
            className={styles.delete}
            onClick={() => onDelete(project)}
          >
            <Trash size={14} />
            {t('Delete project')}
          </DashboardButton>
          <div>
            <DashboardButton type="button" tone="neutral" onClick={onClose}>
              {t('Cancel')}
            </DashboardButton>
            <DashboardButton type="submit">{t('Save changes')}</DashboardButton>
          </div>
        </footer>
      </form>
    </DashboardModal>
  );
}
