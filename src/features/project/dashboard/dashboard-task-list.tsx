'use client';
import { translateFixed } from '../i18n/display';

import { useTranslation, type Locale } from '@/lib/i18n';
import { fixtureField } from '../i18n/display';
import { messages } from './i18n/dashboard-task-list';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, DotsThree, Plus, Star, Trash } from '@phosphor-icons/react';
import {
  DashboardMenu as DropdownMenu,
  DashboardMenuContent as DropdownMenuContent,
} from './dashboard-menu';
import type { DashboardProject, DashboardTask } from './dashboard-model';
import styles from './dashboard-task-list.module.css';
import { AvatarGroup, DashboardButton, IconButton } from './dashboard-ui';

interface DashboardTaskListProps {
  tasks: DashboardTask[];
  projects: DashboardProject[];
  onOpen: (taskId: string) => void;
  onCreate: () => void;
  onSave: (task: DashboardTask) => void;
  onDelete: (task: DashboardTask) => void;
}

function dueDate(value: string, locale: Locale) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DashboardTaskList({
  tasks,
  projects,
  onOpen,
  onCreate,
  onSave,
  onDelete,
}: DashboardTaskListProps) {
  const { t, locale } = useTranslation(messages);
  const uiLabel = (value: string) => translateFixed(value, locale);

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <section className={styles.panel} aria-label={t('Tasks')}>
      <header className={styles.header}>
        <h2>
          {t('Tasks')}
          <span>{tasks.length}</span>
        </h2>
        <DashboardButton onClick={onCreate}>
          <Plus size={14} />
          {t('Create Task')}
        </DashboardButton>
      </header>
      {tasks.length ? (
        <div className={styles.rows}>
          <div className={styles.columnHeaders} aria-hidden="true">
            <span>{t('Task')}</span>
            <span>{t('Status')}</span>
            <span>{t('Progress')}</span>
            <span>{t('Due date')}</span>
            <span>{t('Assignees')}</span>
            <span />
          </div>
          {tasks.map((task) => (
            <article key={task.id} className={styles.row}>
              <div className={styles.taskInfo}>
                <button type="button" onClick={() => onOpen(task.id)}>
                  <span>{fixtureField(task, 'title', locale)}</span>
                  {task.starred ? (
                    <Star size={12} weight="fill" aria-label={t('Favourite')} />
                  ) : null}
                </button>
                <span className={styles.taskMeta}>
                  <span title={projectNames.get(task.projectId)}>
                    {projectNames.get(task.projectId) ||
                      translateFixed('Unassigned project', locale)}
                  </span>
                  <small data-priority={task.priority}>{uiLabel(task.priority)}</small>
                </span>
              </div>
              <span className={styles.status} data-status={task.status}>
                <span />
                {uiLabel(task.status)}
              </span>
              <div className={styles.progress}>
                <div
                  role="progressbar"
                  aria-label={t('{v0} progress', { v0: fixtureField(task, 'title', locale) })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={task.progress}
                >
                  <span style={{ width: `${task.progress}%` }} />
                </div>
                <span>{task.progress}%</span>
              </div>
              <time className={styles.dueDate} dateTime={task.dueDate}>
                {dueDate(task.dueDate, locale)}
              </time>
              <AvatarGroup
                ids={task.assignees.slice(0, 3)}
                size={24}
                extra={Math.max(0, task.assignees.length - 3)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    label={t('{v0} options', { v0: fixtureField(task, 'title', locale) })}
                  >
                    <DotsThree size={18} weight="bold" />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onOpen(task.id)}>
                    {t('Open task')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onSave({ ...task, starred: !task.starred })}>
                    <Star weight={task.starred ? 'fill' : 'regular'} />
                    {task.starred ? t('Remove from favourites') : t('Add to favourites')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      onSave({
                        ...task,
                        status: task.status === 'Completed' ? 'To Do' : 'Completed',
                        progress: task.status === 'Completed' ? 0 : 100,
                      })
                    }
                  >
                    <Check />
                    {task.status === 'Completed' ? t('Reopen task') : t('Mark as complete')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
                    <Trash />
                    {t('Delete task')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>{t('No tasks found')}</p>
          <DashboardButton tone="neutral" onClick={onCreate}>
            {t('Create Task')}
          </DashboardButton>
        </div>
      )}
    </section>
  );
}
